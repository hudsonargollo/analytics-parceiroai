/**
 * Dead-Letter Queue (DLQ) implementation for persistent failures
 * 
 * This module provides functionality to store events that fail processing
 * even after all retry attempts. Failed events are stored in KV with a
 * dlq: prefix for manual review and reprocessing.
 * 
 * Validates: Requirements 8.3
 */

export interface DLQEntry {
  event: unknown
  error: string
  attemptCount: number
  timestamp: string
  context?: Record<string, unknown>
}

/**
 * Write a failed event to the dead-letter queue
 * 
 * @param kv - KV namespace binding
 * @param event - The event that failed processing
 * @param error - Error message describing the failure
 * @param attemptCount - Number of retry attempts made
 * @param context - Optional additional context about the failure
 * @returns Promise that resolves when the event is written to DLQ
 * 
 * @example
 * ```typescript
 * await writeToDLQ(
 *   env.KV,
 *   payloadData,
 *   'Database connection timeout',
 *   3,
 *   { endpoint: '/webhooks/payment', customer_id: '123' }
 * )
 * ```
 */
export async function writeToDLQ(
  kv: KVNamespace,
  event: unknown,
  error: string,
  attemptCount: number,
  context?: Record<string, unknown>
): Promise<void> {
  const timestamp = new Date().toISOString()
  
  // Generate a unique key for this DLQ entry
  // Format: dlq:{timestamp}:{random-uuid}
  const key = `dlq:${Date.now()}:${crypto.randomUUID()}`
  
  const dlqEntry: DLQEntry = {
    event,
    error,
    attemptCount,
    timestamp,
    context
  }
  
  // Store in KV with 7-day TTL (7 * 24 * 60 * 60 = 604800 seconds)
  await kv.put(
    key,
    JSON.stringify(dlqEntry),
    { expirationTtl: 604800 }
  )
  
  // Log the DLQ write for monitoring
  console.error('Event written to DLQ:', {
    key,
    error,
    attemptCount,
    timestamp,
    context
  })
}

/**
 * List all entries in the dead-letter queue
 * 
 * @param kv - KV namespace binding
 * @param limit - Maximum number of entries to return (default: 100)
 * @returns Promise that resolves with array of DLQ entries with their keys
 * 
 * @example
 * ```typescript
 * const entries = await listDLQEntries(env.KV, 50)
 * console.log(`Found ${entries.length} failed events`)
 * ```
 */
export async function listDLQEntries(
  kv: KVNamespace,
  limit: number = 100
): Promise<Array<{ key: string; entry: DLQEntry }>> {
  // List all keys with dlq: prefix
  const list = await kv.list({ prefix: 'dlq:', limit })
  
  const entries: Array<{ key: string; entry: DLQEntry }> = []
  
  // Fetch each entry
  for (const key of list.keys) {
    const value = await kv.get(key.name, { type: 'json' })
    if (value) {
      entries.push({
        key: key.name,
        entry: value as DLQEntry
      })
    }
  }
  
  return entries
}

/**
 * Get a specific entry from the dead-letter queue
 * 
 * @param kv - KV namespace binding
 * @param key - The DLQ key to retrieve
 * @returns Promise that resolves with the DLQ entry or null if not found
 * 
 * @example
 * ```typescript
 * const entry = await getDLQEntry(env.KV, 'dlq:1234567890:abc-123')
 * if (entry) {
 *   console.log('Failed event:', entry.event)
 * }
 * ```
 */
export async function getDLQEntry(
  kv: KVNamespace,
  key: string
): Promise<DLQEntry | null> {
  const value = await kv.get(key, { type: 'json' })
  return value as DLQEntry | null
}

/**
 * Delete an entry from the dead-letter queue
 * 
 * @param kv - KV namespace binding
 * @param key - The DLQ key to delete
 * @returns Promise that resolves when the entry is deleted
 * 
 * @example
 * ```typescript
 * // After manually reprocessing a failed event
 * await deleteDLQEntry(env.KV, 'dlq:1234567890:abc-123')
 * ```
 */
export async function deleteDLQEntry(
  kv: KVNamespace,
  key: string
): Promise<void> {
  await kv.delete(key)
  console.info('DLQ entry deleted:', key)
}

/**
 * Get count of entries in the dead-letter queue
 * 
 * @param kv - KV namespace binding
 * @returns Promise that resolves with the count of DLQ entries
 * 
 * @example
 * ```typescript
 * const count = await getDLQCount(env.KV)
 * if (count > 100) {
 *   console.warn('DLQ has many entries, manual review needed')
 * }
 * ```
 */
export async function getDLQCount(
  kv: KVNamespace
): Promise<number> {
  const list = await kv.list({ prefix: 'dlq:' })
  return list.keys.length
}
