/**
 * Retry wrapper with exponential backoff for handling transient failures
 * 
 * This module provides a retry mechanism for database operations and external API calls
 * that may fail due to transient issues. It implements exponential backoff to avoid
 * overwhelming failing services.
 * 
 * Validates: Requirements 8.2, 8.3
 */

import { writeToDLQ } from './dlq'

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  onRetry?: (attempt: number, error: Error) => void
  onFinalFailure?: (error: Error, attemptCount: number) => Promise<void>
}

/**
 * Process a function with retry logic and exponential backoff
 * 
 * @param fn - The async function to execute with retry logic
 * @param options - Configuration options for retry behavior
 * @returns Promise that resolves with the function result or rejects after all retries fail
 * 
 * @example
 * ```typescript
 * await processWithRetry(
 *   async () => await db.insert(data),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * )
 * ```
 */
export async function processWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    onRetry,
    onFinalFailure
  } = options

  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Attempt to execute the function
      const result = await fn()
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // If this was the last attempt, handle final failure
      if (attempt === maxRetries - 1) {
        if (onFinalFailure) {
          await onFinalFailure(lastError, maxRetries)
        }
        break
      }

      // Call the onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError)
      }

      // Calculate exponential backoff delay: 1s, 2s, 4s
      const delayMs = baseDelayMs * Math.pow(2, attempt)
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  // All retries failed, throw the last error
  throw lastError
}

/**
 * Retry wrapper specifically for database operations
 * 
 * @param fn - The async database operation to execute
 * @returns Promise that resolves with the operation result
 */
export async function retryDatabaseOperation<T>(
  fn: () => Promise<T>
): Promise<T> {
  return processWithRetry(fn, {
    maxRetries: 3,
    baseDelayMs: 1000,
    onRetry: (attempt, error) => {
      console.warn(`Database operation failed (attempt ${attempt}/3):`, error.message)
    }
  })
}

/**
 * Retry wrapper specifically for external API calls
 * 
 * @param fn - The async API call to execute
 * @returns Promise that resolves with the API response
 */
export async function retryApiCall<T>(
  fn: () => Promise<T>
): Promise<T> {
  return processWithRetry(fn, {
    maxRetries: 3,
    baseDelayMs: 1000,
    onRetry: (attempt, error) => {
      console.warn(`API call failed (attempt ${attempt}/3):`, error.message)
    }
  })
}

/**
 * Process a function with retry logic and write to DLQ on persistent failure
 * 
 * This function combines retry logic with dead-letter queue functionality.
 * If all retry attempts fail, the event is automatically written to the DLQ.
 * 
 * @param fn - The async function to execute with retry logic
 * @param kv - KV namespace binding for DLQ storage
 * @param event - The event data to store in DLQ if all retries fail
 * @param context - Optional context about the operation (e.g., endpoint, customer_id)
 * @param options - Configuration options for retry behavior
 * @returns Promise that resolves with the function result or rejects after all retries fail
 * 
 * @example
 * ```typescript
 * await processWithRetryAndDLQ(
 *   async () => await db.insert(paymentEvent),
 *   env.KV,
 *   paymentEvent,
 *   { endpoint: '/webhooks/payment', customer_id: paymentEvent.customer_id }
 * )
 * ```
 */
export async function processWithRetryAndDLQ<T>(
  fn: () => Promise<T>,
  kv: KVNamespace,
  event: unknown,
  context?: Record<string, unknown>,
  options: RetryOptions = {}
): Promise<T> {
  return processWithRetry(fn, {
    ...options,
    onFinalFailure: async (error, attemptCount) => {
      // Write to DLQ when all retries fail
      await writeToDLQ(kv, event, error.message, attemptCount, context)
    }
  })
}
