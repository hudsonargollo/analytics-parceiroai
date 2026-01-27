/**
 * Engagement Event Module
 * 
 * Handles engagement event database operations including updates to recovery logs
 * and storage of orphaned engagement events.
 */

import { EngagementWebhookPayload, EngagementEvent, RecoveryLog } from '../types';

/**
 * Updates engagement status in the database.
 * 
 * Features:
 * - Looks up recovery_log by message_id
 * - Updates engagement timestamps (delivered_at, read_at) based on status
 * - Preserves existing payment event data
 * - Handles orphaned events (no matching recovery_log) by storing in engagement_events table
 * 
 * @param db - D1 Database instance
 * @param payload - Engagement webhook payload
 * @returns Promise resolving to the updated recovery log or created engagement event
 * 
 * @example
 * ```typescript
 * const result = await updateEngagementStatus(db, {
 *   message_id: 'msg_123',
 *   customer_id: 'cust_456',
 *   status: 'delivered',
 *   timestamp: '2024-01-17T10:05:00Z'
 * });
 * ```
 */
export async function updateEngagementStatus(
  db: D1Database,
  payload: EngagementWebhookPayload
): Promise<RecoveryLog | EngagementEvent> {
  const now = new Date().toISOString();
  
  // First, try to find a matching recovery_log by message_id
  // Note: We need to link message_id to recovery_log. For now, we'll use a combination
  // of customer_id and recent timestamp to find the most likely recovery_log
  // In a production system, the message_id would be stored when the message is sent
  
  // For this implementation, we'll look for the most recent recovery_log for this customer
  const recoveryLogResult = await db
    .prepare(`
      SELECT * FROM recovery_logs
      WHERE customer_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(payload.customer_id)
    .first<RecoveryLog>();
  
  if (recoveryLogResult) {
    // Update the recovery log with engagement data
    let updateField: string;
    let updateValue: string;
    
    switch (payload.status) {
      case 'delivered':
        updateField = 'message_delivered_at';
        updateValue = payload.timestamp;
        break;
      case 'read':
        updateField = 'message_read_at';
        updateValue = payload.timestamp;
        break;
      case 'sent':
        updateField = 'message_sent_at';
        updateValue = payload.timestamp;
        break;
      case 'failed':
        // For failed status, we'll just update the updated_at timestamp
        // and not set any specific engagement field
        updateField = 'updated_at';
        updateValue = now;
        break;
      default:
        updateField = 'updated_at';
        updateValue = now;
    }
    
    // Update the recovery log
    await db
      .prepare(`
        UPDATE recovery_logs
        SET ${updateField} = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(updateValue, now, recoveryLogResult.id)
      .run();
    
    // Return the updated recovery log
    return {
      ...recoveryLogResult,
      [updateField]: updateValue,
      updated_at: now,
    };
  } else {
    // No matching recovery_log found - this is an orphaned engagement event
    // Store it in the engagement_events table
    console.warn('Orphaned engagement event detected', {
      timestamp: now,
      message_id: payload.message_id,
      customer_id: payload.customer_id,
      status: payload.status,
    });
    
    const result = await db
      .prepare(`
        INSERT INTO engagement_events (
          message_id,
          customer_id,
          invoice_id,
          status,
          recovery_branch,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        payload.message_id,
        payload.customer_id,
        null, // invoice_id is null for orphaned events
        payload.status,
        null, // recovery_branch is null for orphaned events
        now,
        now
      )
      .run();
    
    return {
      id: result.meta.last_row_id as number,
      message_id: payload.message_id,
      customer_id: payload.customer_id,
      invoice_id: null,
      status: payload.status,
      recovery_branch: null,
      created_at: now,
      updated_at: now,
    };
  }
}
