/**
 * Payment Event Module
 * 
 * Handles payment event database operations including insertion and retrieval.
 */

import { PaymentWebhookPayload, PaymentEvent, RecoveryBranch } from '../types';
import { classifyRecoveryBranch } from './recovery-branch';

/**
 * Inserts a payment event into the database.
 * 
 * Features:
 * - Generates unique event_id if not provided (using crypto.randomUUID())
 * - Classifies recovery branch using classifyRecoveryBranch function
 * - Inserts into payment_events table with timestamps
 * - Handles duplicate event_id with UNIQUE constraint (returns error)
 * 
 * @param db - D1 Database instance
 * @param payload - Payment webhook payload
 * @returns Promise resolving to the inserted payment event with generated ID
 * @throws Error if duplicate event_id or database insertion fails
 * 
 * @example
 * ```typescript
 * const result = await insertPaymentEvent(db, {
 *   event_id: 'evt_123',
 *   customer_id: 'cust_456',
 *   invoice_id: 'inv_789',
 *   amount: 5000,
 *   payment_method: 'pix',
 *   status: 'pending',
 *   due_date: '2024-01-20',
 *   timestamp: '2024-01-17T10:00:00Z'
 * });
 * ```
 */
export async function insertPaymentEvent(
  db: D1Database,
  payload: PaymentWebhookPayload
): Promise<PaymentEvent> {
  // Generate unique event_id if not provided
  const eventId = payload.event_id || crypto.randomUUID();
  
  // Classify recovery branch (use explicit branch if provided, otherwise calculate)
  const recoveryBranch: RecoveryBranch = classifyRecoveryBranch(
    payload.due_date,
    payload.timestamp,
    payload.branch as RecoveryBranch | undefined
  );
  
  // Generate timestamps
  const now = new Date().toISOString();
  
  try {
    // Insert into payment_events table
    const result = await db
      .prepare(`
        INSERT INTO payment_events (
          event_id,
          customer_id,
          invoice_id,
          amount,
          payment_method,
          status,
          recovery_branch,
          due_date,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        eventId,
        payload.customer_id,
        payload.invoice_id,
        payload.amount,
        payload.payment_method,
        payload.status,
        recoveryBranch,
        payload.due_date,
        now,
        now
      )
      .run();
    
    // Check if insertion was successful
    if (!result.success) {
      throw new Error('Failed to insert payment event');
    }
    
    // Return the inserted event with the generated/provided ID
    return {
      id: result.meta.last_row_id as number,
      event_id: eventId,
      customer_id: payload.customer_id,
      invoice_id: payload.invoice_id,
      amount: payload.amount,
      payment_method: payload.payment_method,
      status: payload.status,
      recovery_branch: recoveryBranch,
      due_date: payload.due_date,
      created_at: now,
      updated_at: now,
    };
  } catch (error) {
    // Handle duplicate event_id (UNIQUE constraint violation)
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Duplicate event_id: ${eventId} already exists`);
    }
    
    // Re-throw other errors
    throw error;
  }
}
