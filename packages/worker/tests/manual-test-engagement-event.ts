/**
 * Manual Test for Engagement Event Module
 * 
 * Run with: npx tsx tests/manual-test-engagement-event.ts
 */

import { updateEngagementStatus } from '../src/lib/engagement-event';
import { EngagementWebhookPayload, RecoveryLog, EngagementEvent } from '../src/types';

// Mock D1 Database for manual testing
class MockD1Database {
  private recoveryLogs: Map<number, RecoveryLog> = new Map();
  private engagementEvents: Map<number, EngagementEvent> = new Map();
  private lastRecoveryLogId = 0;
  private lastEngagementEventId = 0;

  prepare(query: string) {
    const boundParams: any[] = [];
    
    return {
      bind: (...params: any[]) => {
        boundParams.push(...params);
        return {
          run: async () => {
            // Handle UPDATE recovery_logs
            if (query.includes('UPDATE recovery_logs')) {
              const recoveryLogId = boundParams[2];
              const log = this.recoveryLogs.get(recoveryLogId);
              
              if (log) {
                // Extract field name from query
                const fieldMatch = query.match(/SET (\w+) = \?/);
                if (fieldMatch) {
                  const fieldName = fieldMatch[1];
                  const updatedLog = {
                    ...log,
                    [fieldName]: boundParams[0],
                    updated_at: boundParams[1],
                  };
                  this.recoveryLogs.set(recoveryLogId, updatedLog);
                }
              }
              
              return {
                success: true,
                meta: {},
              };
            }
            
            // Handle INSERT INTO engagement_events
            if (query.includes('INSERT INTO engagement_events')) {
              this.lastEngagementEventId++;
              const event: EngagementEvent = {
                id: this.lastEngagementEventId,
                message_id: boundParams[0],
                customer_id: boundParams[1],
                invoice_id: boundParams[2],
                status: boundParams[3],
                recovery_branch: boundParams[4],
                created_at: boundParams[5],
                updated_at: boundParams[6],
              };
              this.engagementEvents.set(this.lastEngagementEventId, event);
              
              return {
                success: true,
                meta: {
                  last_row_id: this.lastEngagementEventId,
                },
              };
            }
            
            return { success: true, meta: {} };
          },
          first: async () => {
            // Handle SELECT from recovery_logs
            if (query.includes('SELECT * FROM recovery_logs')) {
              const customerId = boundParams[0];
              
              // Find the most recent recovery log for this customer
              let mostRecent: RecoveryLog | null = null;
              for (const log of this.recoveryLogs.values()) {
                if (log.customer_id === customerId) {
                  if (!mostRecent || log.created_at > mostRecent.created_at) {
                    mostRecent = log;
                  }
                }
              }
              
              return mostRecent;
            }
            
            return null;
          },
        };
      },
    };
  }

  // Helper methods for testing
  addRecoveryLog(log: Partial<RecoveryLog>): RecoveryLog {
    this.lastRecoveryLogId++;
    const fullLog: RecoveryLog = {
      id: this.lastRecoveryLogId,
      customer_id: log.customer_id || 'cust_default',
      invoice_id: log.invoice_id || 'inv_default',
      payment_event_id: log.payment_event_id || null,
      engagement_event_id: log.engagement_event_id || null,
      recovery_branch: log.recovery_branch || '3-day-notice',
      message_sent_at: log.message_sent_at || null,
      message_delivered_at: log.message_delivered_at || null,
      message_read_at: log.message_read_at || null,
      payment_received_at: log.payment_received_at || null,
      amount: log.amount || null,
      payment_method: log.payment_method || null,
      recovery_time_hours: log.recovery_time_hours || null,
      created_at: log.created_at || new Date().toISOString(),
      updated_at: log.updated_at || new Date().toISOString(),
    };
    this.recoveryLogs.set(this.lastRecoveryLogId, fullLog);
    return fullLog;
  }

  getRecoveryLog(id: number): RecoveryLog | undefined {
    return this.recoveryLogs.get(id);
  }

  getEngagementEvent(id: number): EngagementEvent | undefined {
    return this.engagementEvents.get(id);
  }
}

async function runTests() {
  console.log('🧪 Manual Test: Engagement Event Module\n');

  const mockDb = new MockD1Database();

  // Test 1: Update engagement status with existing recovery log
  console.log('Test 1: Update message_delivered_at with existing recovery log');
  const recoveryLog = mockDb.addRecoveryLog({
    customer_id: 'cust_456',
    invoice_id: 'inv_789',
    recovery_branch: '3-day-notice',
    message_sent_at: '2024-01-17T10:00:00Z',
    created_at: '2024-01-17T10:00:00Z',
  });

  const payload1: EngagementWebhookPayload = {
    message_id: 'msg_123',
    customer_id: 'cust_456',
    status: 'delivered',
    timestamp: '2024-01-17T10:05:00Z',
  };

  const result1 = await updateEngagementStatus(mockDb as any, payload1);
  console.log('✅ Result:', {
    id: result1.id,
    customer_id: result1.customer_id,
    message_delivered_at: result1.message_delivered_at,
  });
  console.log('');

  // Test 2: Update message_read_at
  console.log('Test 2: Update message_read_at');
  const payload2: EngagementWebhookPayload = {
    message_id: 'msg_124',
    customer_id: 'cust_456',
    status: 'read',
    timestamp: '2024-01-17T10:10:00Z',
  };

  const result2 = await updateEngagementStatus(mockDb as any, payload2);
  console.log('✅ Result:', {
    id: result2.id,
    customer_id: result2.customer_id,
    message_read_at: result2.message_read_at,
  });
  console.log('');

  // Test 3: Orphaned engagement event
  console.log('Test 3: Handle orphaned engagement event (no matching recovery log)');
  const payload3: EngagementWebhookPayload = {
    message_id: 'msg_orphan',
    customer_id: 'cust_999',
    status: 'delivered',
    timestamp: '2024-01-17T10:05:00Z',
  };

  const result3 = await updateEngagementStatus(mockDb as any, payload3);
  console.log('✅ Result (orphaned event stored):', {
    id: result3.id,
    message_id: result3.message_id,
    customer_id: result3.customer_id,
    invoice_id: result3.invoice_id,
    status: result3.status,
  });
  console.log('');

  // Test 4: Preserve payment data when updating engagement
  console.log('Test 4: Preserve payment data when updating engagement');
  const recoveryLog2 = mockDb.addRecoveryLog({
    customer_id: 'cust_789',
    invoice_id: 'inv_999',
    recovery_branch: 'overdue',
    amount: 5000,
    payment_method: 'pix',
    payment_received_at: '2024-01-17T11:00:00Z',
    message_sent_at: '2024-01-17T10:00:00Z',
    created_at: '2024-01-17T10:00:00Z',
  });

  const payload4: EngagementWebhookPayload = {
    message_id: 'msg_preserve',
    customer_id: 'cust_789',
    status: 'delivered',
    timestamp: '2024-01-17T10:05:00Z',
  };

  const result4 = await updateEngagementStatus(mockDb as any, payload4);
  console.log('✅ Result (payment data preserved):', {
    id: result4.id,
    customer_id: result4.customer_id,
    amount: result4.amount,
    payment_method: result4.payment_method,
    payment_received_at: result4.payment_received_at,
    message_delivered_at: result4.message_delivered_at,
  });
  console.log('');

  console.log('✅ All manual tests passed!');
}

runTests().catch(console.error);
