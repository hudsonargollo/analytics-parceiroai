import { describe, it, expect, beforeEach } from 'vitest';
import { insertPaymentEvent } from '../src/lib/payment-event';
import { PaymentWebhookPayload } from '../src/types';

// Mock D1 Database for testing
class MockD1Database {
  private data: Map<string, any> = new Map();
  private lastRowId = 0;

  prepare(query: string) {
    const boundParams: any[] = [];
    
    return {
      bind: (...params: any[]) => {
        boundParams.push(...params);
        return {
          run: async () => {
            // Check for duplicate event_id
            if (query.includes('INSERT INTO payment_events')) {
              const eventId = boundParams[0];
              if (this.data.has(eventId)) {
                throw new Error('UNIQUE constraint failed: payment_events.event_id');
              }
              
              // Store the event
              this.lastRowId++;
              this.data.set(eventId, {
                id: this.lastRowId,
                event_id: boundParams[0],
                customer_id: boundParams[1],
                invoice_id: boundParams[2],
                amount: boundParams[3],
                payment_method: boundParams[4],
                status: boundParams[5],
                recovery_branch: boundParams[6],
                due_date: boundParams[7],
                created_at: boundParams[8],
                updated_at: boundParams[9],
              });
              
              return {
                success: true,
                meta: {
                  last_row_id: this.lastRowId,
                },
              };
            }
            
            return { success: true, meta: {} };
          },
        };
      },
    };
  }

  reset() {
    this.data.clear();
    this.lastRowId = 0;
  }

  getData(eventId: string) {
    return this.data.get(eventId);
  }
}

describe('insertPaymentEvent', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  describe('Basic insertion', () => {
    it('should insert a payment event with all required fields', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_123',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result).toMatchObject({
        id: 1,
        event_id: 'evt_123',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        recovery_branch: '3-day-notice',
        due_date: '2024-01-20',
      });
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should generate event_id if not provided', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: '',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'boleto',
        status: 'confirmed',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.event_id).toBeDefined();
      expect(result.event_id).not.toBe('');
      expect(result.event_id.length).toBeGreaterThan(0);
    });
  });

  describe('Recovery branch classification', () => {
    it('should classify as "3-day-notice" when due in 3 days', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_3day',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.recovery_branch).toBe('3-day-notice');
    });

    it('should classify as "due-today" when due today', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_today',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-17',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.recovery_branch).toBe('due-today');
    });

    it('should classify as "overdue" when past due date', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_overdue',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-10',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.recovery_branch).toBe('overdue');
    });

    it('should use explicit branch when provided', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_explicit',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
        branch: 'overdue', // Explicit override
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.recovery_branch).toBe('overdue');
    });
  });

  describe('Duplicate handling', () => {
    it('should reject duplicate event_id', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_duplicate',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      // First insertion should succeed
      await insertPaymentEvent(mockDb as any, payload);

      // Second insertion with same event_id should fail
      await expect(
        insertPaymentEvent(mockDb as any, payload)
      ).rejects.toThrow('Duplicate event_id: evt_duplicate already exists');
    });

    it('should allow different event_ids for same customer', async () => {
      const payload1: PaymentWebhookPayload = {
        event_id: 'evt_001',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const payload2: PaymentWebhookPayload = {
        event_id: 'evt_002',
        customer_id: 'cust_456',
        invoice_id: 'inv_790',
        amount: 3000,
        payment_method: 'boleto',
        status: 'confirmed',
        due_date: '2024-01-21',
        timestamp: '2024-01-18T10:00:00Z',
      };

      const result1 = await insertPaymentEvent(mockDb as any, payload1);
      const result2 = await insertPaymentEvent(mockDb as any, payload2);

      expect(result1.event_id).toBe('evt_001');
      expect(result2.event_id).toBe('evt_002');
      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('Payment methods', () => {
    it('should handle Pix payment method', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_pix',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'confirmed',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.payment_method).toBe('pix');
    });

    it('should handle Boleto payment method', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_boleto',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'boleto',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.payment_method).toBe('boleto');
    });

    it('should handle credit card payment method', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_cc',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'credit_card',
        status: 'confirmed',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.payment_method).toBe('credit_card');
    });
  });

  describe('Payment statuses', () => {
    it('should handle pending status', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_pending',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.status).toBe('pending');
    });

    it('should handle confirmed status', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_confirmed',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'confirmed',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.status).toBe('confirmed');
    });

    it('should handle failed status', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_failed',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'credit_card',
        status: 'failed',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.status).toBe('failed');
    });
  });

  describe('Timestamps', () => {
    it('should set created_at and updated_at timestamps', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_timestamps',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
      expect(result.created_at).toBe(result.updated_at);
    });

    it('should use ISO 8601 format for timestamps', async () => {
      const payload: PaymentWebhookPayload = {
        event_id: 'evt_iso',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };

      const result = await insertPaymentEvent(mockDb as any, payload);

      // Check ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
      expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
