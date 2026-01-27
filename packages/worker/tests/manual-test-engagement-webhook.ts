/**
 * Manual Test for Engagement Webhook Endpoint
 * 
 * Run with: npx tsx tests/manual-test-engagement-webhook.ts
 */

import app from '../src/index';

// Mock environment
const mockEnv = {
  DB: null as any,
  KV: null as any,
  ENVIRONMENT: 'test',
  N8N_WEBHOOK_URL: 'https://test.n8n.com',
  WEBHOOK_SECRET: 'test-secret-key',
  ZUCKZAPGO_SECRET: 'test-zuckzapgo-secret',
  VALID_API_KEYS: 'test-key-1,test-key-2',
  CHATWOOT_TOKEN: 'test-chatwoot-token',
};

// Mock D1 Database
class MockD1Database {
  private recoveryLogs: Map<number, any> = new Map();
  private engagementEvents: Map<number, any> = new Map();
  private lastRecoveryLogId = 0;
  private lastEngagementEventId = 0;

  prepare(query: string) {
    const boundParams: any[] = [];
    
    return {
      bind: (...params: any[]) => {
        boundParams.push(...params);
        return {
          run: async () => {
            if (query.includes('UPDATE recovery_logs')) {
              const recoveryLogId = boundParams[2];
              const log = this.recoveryLogs.get(recoveryLogId);
              
              if (log) {
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
              
              return { success: true, meta: {} };
            }
            
            if (query.includes('INSERT INTO engagement_events')) {
              this.lastEngagementEventId++;
              const event = {
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
                meta: { last_row_id: this.lastEngagementEventId },
              };
            }
            
            return { success: true, meta: {} };
          },
          first: async () => {
            if (query.includes('SELECT * FROM recovery_logs')) {
              const customerId = boundParams[0];
              
              let mostRecent: any = null;
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

  addRecoveryLog(log: any) {
    this.lastRecoveryLogId++;
    const fullLog = {
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
}

// Helper to compute HMAC signature (matching the implementation)
async function computeHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const payloadData = encoder.encode(payload);
  const signature = await crypto.subtle.sign('HMAC', key, payloadData);
  
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function runTests() {
  console.log('🧪 Manual Test: Engagement Webhook Endpoint\n');

  const mockDb = new MockD1Database();
  mockEnv.DB = mockDb as any;

  // Test 1: Valid engagement webhook with existing recovery log
  console.log('Test 1: Valid engagement webhook (delivered status)');
  
  // Add a recovery log first
  mockDb.addRecoveryLog({
    customer_id: 'cust_456',
    invoice_id: 'inv_789',
    recovery_branch: '3-day-notice',
    message_sent_at: '2024-01-17T10:00:00Z',
    created_at: '2024-01-17T10:00:00Z',
  });

  const payload1 = {
    message_id: 'msg_123',
    customer_id: 'cust_456',
    status: 'delivered',
    timestamp: '2024-01-17T10:05:00Z',
  };
  const body1 = JSON.stringify(payload1);
  const signature1 = await computeHmacSignature(body1, mockEnv.WEBHOOK_SECRET);

  const request1 = new Request('http://localhost/webhooks/engagement', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature1,
    },
    body: body1,
  });

  const response1 = await app.fetch(request1, mockEnv);
  const result1 = await response1.json();

  console.log('✅ Status:', response1.status);
  console.log('✅ Response:', result1);
  console.log('');

  // Test 2: Valid engagement webhook with orphaned event
  console.log('Test 2: Valid engagement webhook (orphaned event)');

  const payload2 = {
    message_id: 'msg_orphan',
    customer_id: 'cust_999',
    status: 'delivered',
    timestamp: '2024-01-17T10:05:00Z',
  };
  const body2 = JSON.stringify(payload2);
  const signature2 = await computeHmacSignature(body2, mockEnv.WEBHOOK_SECRET);

  const request2 = new Request('http://localhost/webhooks/engagement', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature2,
    },
    body: body2,
  });

  const response2 = await app.fetch(request2, mockEnv);
  const result2 = await response2.json();

  console.log('✅ Status:', response2.status);
  console.log('✅ Response:', result2);
  console.log('');

  // Test 3: Invalid signature
  console.log('Test 3: Invalid webhook signature');

  const payload3 = {
    message_id: 'msg_invalid',
    customer_id: 'cust_456',
    status: 'read',
    timestamp: '2024-01-17T10:10:00Z',
  };
  const body3 = JSON.stringify(payload3);

  const request3 = new Request('http://localhost/webhooks/engagement', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': 'invalid-signature',
    },
    body: body3,
  });

  const response3 = await app.fetch(request3, mockEnv);
  const result3 = await response3.json();

  console.log('✅ Status:', response3.status);
  console.log('✅ Response:', result3);
  console.log('');

  // Test 4: Read status
  console.log('Test 4: Valid engagement webhook (read status)');

  const payload4 = {
    message_id: 'msg_read',
    customer_id: 'cust_456',
    status: 'read',
    timestamp: '2024-01-17T10:10:00Z',
  };
  const body4 = JSON.stringify(payload4);
  const signature4 = await computeHmacSignature(body4, mockEnv.WEBHOOK_SECRET);

  const request4 = new Request('http://localhost/webhooks/engagement', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature4,
    },
    body: body4,
  });

  const response4 = await app.fetch(request4, mockEnv);
  const result4 = await response4.json();

  console.log('✅ Status:', response4.status);
  console.log('✅ Response:', result4);
  console.log('');

  console.log('✅ All webhook endpoint tests passed!');
}

runTests().catch(console.error);
