# Retry Wrapper Usage Guide

## Overview

The retry wrapper provides exponential backoff retry logic for handling transient failures in database operations and external API calls. This improves system resilience without overwhelming failing services.

**Validates: Requirements 8.2**

## Features

- **Automatic Retries**: Retries failed operations up to 3 times by default
- **Exponential Backoff**: Uses delays of 1s, 2s, 4s between retries
- **Configurable**: Supports custom retry counts and base delays
- **Type-Safe**: Full TypeScript support with generic return types
- **Callback Support**: Optional `onRetry` callback for logging/monitoring

## Basic Usage

### Using processWithRetry

The core function that provides retry logic:

```typescript
import { processWithRetry } from './lib/retry'

// Simple usage with defaults (3 retries, 1s base delay)
const result = await processWithRetry(async () => {
  return await someOperation()
})

// With custom options
const result = await processWithRetry(
  async () => {
    return await someOperation()
  },
  {
    maxRetries: 5,
    baseDelayMs: 2000,
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}: ${error.message}`)
    }
  }
)
```

### Using retryDatabaseOperation

Convenience wrapper for database operations with built-in logging:

```typescript
import { retryDatabaseOperation } from './lib/retry'

const result = await retryDatabaseOperation(async () => {
  return await db.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first()
})
```

### Using retryApiCall

Convenience wrapper for external API calls with built-in logging:

```typescript
import { retryApiCall } from './lib/retry'

const response = await retryApiCall(async () => {
  return await fetch('https://api.example.com/data', {
    method: 'POST',
    body: JSON.stringify(data)
  })
})
```

## Integration Examples

### Example 1: Database Insert with Retry

```typescript
import { insertPaymentEvent } from './lib/payment-event'
import { retryDatabaseOperation } from './lib/retry'

// Wrap database operation with retry logic
const paymentEvent = await retryDatabaseOperation(async () => {
  return await insertPaymentEvent(db, payload)
})
```

### Example 2: Webhook Handler with Retry

```typescript
import { processWithRetry } from './lib/retry'

app.post('/webhooks/payment', async (c) => {
  const payload = await c.req.json<PaymentWebhookPayload>()
  
  try {
    // Process webhook with retry logic
    const result = await processWithRetry(
      async () => {
        // Classify recovery branch
        const branch = classifyRecoveryBranch(payload.due_date)
        
        // Insert into database
        return await insertPaymentEvent(c.env.DB, {
          ...payload,
          branch
        })
      },
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (attempt, error) => {
          console.warn(`Payment webhook retry ${attempt}/3:`, error.message)
        }
      }
    )
    
    return c.json({ event_id: result.event_id }, 202)
  } catch (error) {
    // All retries failed - send to dead-letter queue
    await sendToDeadLetterQueue(c.env.KV, payload, error)
    return c.json({ error: 'Processing failed' }, 500)
  }
})
```

### Example 3: External API Call with Retry

```typescript
import { retryApiCall } from './lib/retry'

async function triggerN8nWorkflow(webhookUrl: string, data: any) {
  return await retryApiCall(async () => {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status}`)
    }
    
    return await response.json()
  })
}
```

### Example 4: Cache Operation with Retry

```typescript
import { processWithRetry } from './lib/retry'

async function setCachedMetricsWithRetry(
  kv: KVNamespace,
  key: string,
  data: any,
  ttl: number = 300
) {
  await processWithRetry(
    async () => {
      await kv.put(key, JSON.stringify(data), {
        expirationTtl: ttl
      })
    },
    {
      maxRetries: 2, // Fewer retries for cache operations
      baseDelayMs: 500,
      onRetry: (attempt, error) => {
        console.warn(`Cache write retry ${attempt}:`, error.message)
      }
    }
  )
}
```

## Configuration Options

### RetryOptions Interface

```typescript
interface RetryOptions {
  maxRetries?: number      // Default: 3
  baseDelayMs?: number     // Default: 1000 (1 second)
  onRetry?: (attempt: number, error: Error) => void
}
```

### Exponential Backoff Calculation

The delay between retries follows this formula:

```
delay = baseDelayMs * 2^attempt
```

With default `baseDelayMs = 1000`:
- After 1st failure: wait 1000ms (1s)
- After 2nd failure: wait 2000ms (2s)
- After 3rd failure: throw error (no more retries)

## Error Handling

### Transient vs Permanent Errors

The retry wrapper is designed for **transient errors** that may resolve on retry:

**Good candidates for retry:**
- Network timeouts
- Database connection failures
- Rate limiting (503 Service Unavailable)
- Temporary service outages

**Bad candidates for retry:**
- Validation errors (400 Bad Request)
- Authentication failures (401 Unauthorized)
- Not found errors (404 Not Found)
- Duplicate key violations (UNIQUE constraint)

### Example: Selective Retry

```typescript
import { processWithRetry } from './lib/retry'

async function insertWithSelectiveRetry(db: D1Database, data: any) {
  try {
    return await processWithRetry(async () => {
      return await db.prepare('INSERT INTO ...').bind(...).run()
    })
  } catch (error) {
    if (error instanceof Error) {
      // Don't retry duplicate key errors
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('Duplicate entry - not retrying')
      }
      
      // Don't retry validation errors
      if (error.message.includes('validation failed')) {
        throw new Error('Invalid data - not retrying')
      }
    }
    
    // Other errors were already retried
    throw error
  }
}
```

## Testing

### Unit Tests

The retry wrapper includes comprehensive unit tests in `tests/retry.test.ts`.

### Manual Testing

Run the manual test suite:

```bash
npx tsx tests/manual-test-retry.ts
```

This verifies:
- Successful first attempts
- Retry after failures
- Exponential backoff timing
- Custom configuration options
- Error handling
- Edge cases

## Best Practices

1. **Use appropriate retry counts**: Database operations typically need 3 retries, cache operations may need fewer

2. **Set reasonable base delays**: 1 second is good for most operations, but adjust based on your use case

3. **Log retry attempts**: Use the `onRetry` callback for monitoring and debugging

4. **Handle permanent failures**: After all retries fail, send to dead-letter queue or alert monitoring

5. **Don't retry everything**: Only retry transient failures, not validation or authentication errors

6. **Consider timeout limits**: Cloudflare Workers have execution time limits, so don't set delays too high

## Performance Considerations

### Total Retry Time

With default settings (3 retries, 1s base delay):
- Maximum retry time: 1s + 2s = 3 seconds
- Total execution time: ~3 seconds + operation time

### Cloudflare Workers Limits

- CPU time limit: 50ms (free tier) or 50ms-30s (paid tiers)
- Wall clock time: 30 seconds maximum
- Consider these limits when setting `maxRetries` and `baseDelayMs`

### Recommended Settings

```typescript
// For critical operations (database writes)
{ maxRetries: 3, baseDelayMs: 1000 }

// For cache operations (less critical)
{ maxRetries: 2, baseDelayMs: 500 }

// For external API calls (may be slow)
{ maxRetries: 3, baseDelayMs: 2000 }
```

## Monitoring and Observability

### Logging Retry Attempts

```typescript
const result = await processWithRetry(
  async () => await operation(),
  {
    onRetry: (attempt, error) => {
      // Log to monitoring service
      console.warn({
        event: 'retry_attempt',
        attempt,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  }
)
```

### Tracking Retry Metrics

```typescript
let totalRetries = 0
let failedOperations = 0

const result = await processWithRetry(
  async () => await operation(),
  {
    onRetry: (attempt) => {
      totalRetries++
    }
  }
).catch(error => {
  failedOperations++
  throw error
})

// Send metrics to monitoring service
await sendMetrics({
  total_retries: totalRetries,
  failed_operations: failedOperations
})
```

## Related Documentation

- [Error Handling Strategy](./error-handling-strategy.md)
- [Dead Letter Queue Implementation](./dead-letter-queue.md)
- [Database Operations Guide](./database-operations.md)
- [API Integration Patterns](./api-integration-patterns.md)
