import { describe, it, expect, beforeEach } from 'vitest';
import { updateEngagementStatus } from '../src/lib/engagement-event';
import { EngagementWebhookPayload, RecoveryLog, EngagementEvent } from '../src/types';

// Mock D1 Database for testing
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

  reset() {
    this.recoveryLogs.clear();
    this.engagementEvents.clear();
    this.lastRecoveryLogId = 0;
    this.lastEngagementEventId = 0;
  }
}

describe('updateEngagementStatus', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  describe('Engagement status updates with existing recovery log', () => {
    it('should update message_delivered_at when status is delivered', async () => {
      // Create a recovery log
      const recoveryLog = mockDb.addRecoveryLog({
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        recovery_branch: '3-day-notice',
        message_sent_at: '2024-01-17T10:00:00Z',
        created_at: '2024-01-17T10:00:00Z',
      });

      const payload: EngagementWebhookPayload = {
        message_id: 'msg_123',
        customer_id: 'cust_456',
        status: 'delivered',
        timestamp: '2024-01-17T10:05:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      expect(result).toMatchObject({
        id: recoveryLog.id,
        customer_id: 'cust_456',
        message_delivered_at: '2024-01-17T10:05:00Z',
      });
      expect(result.updated_at).toBeDefined();
    });

    it('should update message_read_at when status is read', async () => {
      // Create a recovery log
      const recoveryLog = mockDb.addRecoveryLog({
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        recovery_branch: '3-day-notice',
        message_sent_at: '2024-01-17T10:00:00Z',
        message_delivered_at: '2024-01-17T10:05:00Z',
        created_at: '2024-01-17T10:00:00Z',
      });

      const payload: EngagementWebhookPayload = {
        message_id: 'msg_123',
        customer_id: 'cust_456',
        status: 'read',
        timestamp: '2024-01-17T10:10:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      expect(result).toMatchObject({
        id: recoveryLog.id,
        customer_id: 'cust_456',
        message_read_at: '2024-01-17T10:10:00Z',
      });
      expect(result.updated_at).toBeDefined();
    });

    it('should update message_sent_at when status is sent', async () => {
      // Create a recovery log
      const recoveryLog = mockDb.addRecoveryLog({
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        recovery_branch: '3-day-notice',
        created_at: '2024-01-17T10:00:00Z',
      });

      const payload: EngagementWebhookPayload = {
        message_id: 'msg_123',
        customer_id: 'cust_456',
        status: 'sent',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      expect(result).toMatchObject({
        id: recoveryLog.id,
        customer_id: 'cust_456',
        message_sent_at: '2024-01-17T10:00:00Z',
      });
      expect(result.updated_at).toBeDefined();
    });

    it('should preserve existing payment event data when updating engagement', async () => {
      // Create a recovery log with payment data
      const recoveryLog = mockDb.addRecoveryLog({
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        recovery_branch: 'overdue',
        amount: 5000,
        payment_method: 'pix',
        payment_received_at: '2024-01-17T11:00:00Z',
        message_sent_at: '2024-01-17T10:00:00Z',
        created_at: '2024-01-17T10:00:00Z',
      });

      const payload: EngagementWebhookPayload = {
        message_id: 'msg_123',
        customer_id: 'cust_456',
        status: 'delivered',
        timestamp: '2024-01-17T10:05:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      // Verify payment data is preserved
      expect(result).toMatchObject({
        id: recoveryLog.id,
        customer_id: 'cust_456',
        amount: 5000,
        payment_method: 'pix',
        payment_received_at: '2024-01-17T11:00:00Z',
        message_delivered_at: '2024-01-17T10:05:00Z',
      });
    });
  });

  describe('Orphaned engagement events', () => {
    it('should store orphaned event when no matching recovery_log exists', async () => {
      const payload: EngagementWebhookPayload = {
        message_id: 'msg_orphan',
        customer_id: 'cust_999',
        status: 'delivered',
        timestamp: '2024-01-17T10:05:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      expect(result).toMatchObject({
        id: 1,
        message_id: 'msg_orphan',
        customer_id: 'cust_999',
        invoice_id: null,
        status: 'delivered',
        recovery_branch: null,
      });
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should handle multiple orphaned events for same customer', async () => {
      const payload1: EngagementWebhookPayload = {
        message_id: 'msg_orphan_1',
        customer_id: 'cust_999',
        status: 'delivered',
        timestamp: '2024-01-17T10:05:00Z',
      };

      const payload2: EngagementWebhookPayload = {
        message_id: 'msg_orphan_2',
        customer_id: 'cust_999',
        status: 'read',
        timestamp: '2024-01-17T10:10:00Z',
      };

      const result1 = await updateEngagementStatus(mockDb as any, payload1);
      const result2 = await updateEngagementStatus(mockDb as any, payload2);

      expect(result1.message_id).toBe('msg_orphan_1');
      expect(result2.message_id).toBe('msg_orphan_2');
      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('Engagement statuses', () => {
    it('should handle sent status', async () => {
      mockDb.addRecoveryLog({
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        created_at: '2024-01-17T10:00:00Z',
      });

      const payload: EngagementWebhookPayload = {
        message_id: 'msg_sent',
        customer_id: 'cust_456',
        status: 'sent',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      expect(result.message_sent_at).toBe('2024-01-17T10:00:00Z');
    });

    it('should handle delivered status', async () => {
      mockDb.addRecoveryLog({
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        created_at: '2024-01-17T10:00:00Z',
      });

      const payload: EngagementWebhookPayload = {
        message_id: 'msg_delivered',
        customer_id: 'cust_456',
        status: 'delivered',
        timestamp: '2024-01-17T10:05:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      expect(result.message_delivered_at).toBe('2024-01-17T10:05:00Z');
    });

    it('should handle read status', async () => {
      mockDb.addRecoveryLog({
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        created_at: '2024-01-17T10:00:00Z',
      });

      const payload: EngagementWebhookPayload = {
        message_id: 'msg_read',
        customer_id: 'cust_456',
        status: 'read',
        timestamp: '2024-01-17T10:10:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      expect(result.message_read_at).toBe('2024-01-17T10:10:00Z');
    });

    it('should handle failed status', async () => {
      mockDb.addRecoveryLog({
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        created_at: '2024-01-17T10:00:00Z',
      });

      const payload: EngagementWebhookPayload = {
        message_id: 'msg_failed',
        customer_id: 'cust_456',
        status: 'failed',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      // For failed status, only updated_at should be set
      expect(result.updated_at).toBeDefined();
    });
  });

  describe('Field extraction', () => {
    it('should extract all required fields from engagement payload', async () => {
      const payload: EngagementWebhookPayload = {
        message_id: 'msg_extract',
        customer_id: 'cust_extract',
        status: 'delivered',
        timestamp: '2024-01-17T10:05:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      // Verify all fields are present (either in recovery log or engagement event)
      expect(result).toHaveProperty('customer_id');
      expect(result.customer_id).toBe('cust_extract');
    });
  });

  describe('Timestamps', () => {
    it('should set created_at and updated_at for orphaned events', async () => {
      const payload: EngagementWebhookPayload = {
        message_id: 'msg_timestamps',
        customer_id: 'cust_999',
        status: 'delivered',
        timestamp: '2024-01-17T10:05:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should update updated_at when updating recovery log', async () => {
      const recoveryLog = mockDb.addRecoveryLog({
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        created_at: '2024-01-17T10:00:00Z',
        updated_at: '2024-01-17T10:00:00Z',
      });

      const payload: EngagementWebhookPayload = {
        message_id: 'msg_update',
        customer_id: 'cust_456',
        status: 'delivered',
        timestamp: '2024-01-17T10:05:00Z',
      };

      const result = await updateEngagementStatus(mockDb as any, payload);

      expect(result.updated_at).toBeDefined();
      expect(result.updated_at).not.toBe(recoveryLog.updated_at);
    });
  });
});
