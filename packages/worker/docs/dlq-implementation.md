# Dead-Letter Queue (DLQ) Implementation

## Overview

The Dead-Letter Queue (DLQ) is a critical component of the Subscription Recovery Analytics system that ensures no data is lost when processing failures occur. When events fail to process even after all retry attempts, they are automatically stored in Cloudflare KV for manual review and reprocessing.

**Validates: Requirements 8.3**

## Architecture

### Storage Strategy

- **Storage**: Cloudflare KV namespace
- **Key Format**: `dlq:{timestamp}:{uuid}`
- **TTL**: 7 days (604,800 seconds)
- **Prefix**: All DLQ entries use the `dlq:` prefix for easy filtering

### Data Structure

Each DLQ entry contains:

```typescript
interface DLQEntry {
  event: unknown              // The original event that failed
  error: string               // Error message describing the failure
  attemptCount: number        // Number of retry attempts made
  timestamp: string           // ISO 8601 timestamp of when it was written
  context?: Record<string, unknown>  // Optional context (endpoint, customer_id, etc.)
}
```

## Usage

### Automatic DLQ with Retry

The recommended approach is to use `processWithRetryAndDLQ`, which automatically writes to the DLQ when all retries fail:

```typescript
import { processWithRetryAndDLQ } from './lib/retry'

// In your webhook handler
app.post('/webhooks/payment', async (c) => {
  const payload = await c.req.json()
  
  try {
    await processWithRetryAndDLQ(
      async () => {
        // Your database operation
        await insertPaymentEvent(c.env.DB, payload)
      },
      c.env.KV,
      payload,
      {
        endpoint: '/webhooks/payment',
        customer_id: payload.customer_id
      }
    )
    
    return c.json({ status: 'accepted' }, 202)
  } catch (error) {
    // Event is already in DLQ at this point
    return c.json({ error: 'Processing failed' }, 500)
  }
})
```

### Manual DLQ Write

For cases where you need direct control:

```typescript
import { writeToDLQ } from './lib/dlq'

try {
  await someOperation()
} catch (error) {
  await writeToDLQ(
    env.KV,
    eventData,
    error.message,
    3,
    { endpoint: '/api/endpoint', customer_id: '123' }
  )
}
```

### Listing DLQ Entries

To review failed events:

```typescript
import { listDLQEntries } from './lib/dlq'

// List all DLQ entries (up to 100)
const entries = await listDLQEntries(env.KV)

// List with custom limit
const recentEntries = await listDLQEntries(env.KV, 50)

for (const { key, entry } of entries) {
  console.log(`Failed event: ${key}`)
  console.log(`Error: ${entry.error}`)
  console.log(`Attempts: ${entry.attemptCount}`)
  console.log(`Event:`, entry.event)
}
```

### Retrieving Specific Entry

```typescript
import { getDLQEntry } from './lib/dlq'

const entry = await getDLQEntry(env.KV, 'dlq:1234567890:abc-123')

if (entry) {
  console.log('Event:', entry.event)
  console.log('Error:', entry.error)
}
```

### Deleting Processed Entry

After manually reprocessing a failed event:

```typescript
import { deleteDLQEntry } from './lib/dlq'

// Reprocess the event
await reprocessEvent(entry.event)

// Delete from DLQ
await deleteDLQEntry(env.KV, key)
```

### Getting DLQ Count

For monitoring and alerting:

```typescript
import { getDLQCount } from './lib/dlq'

const count = await getDLQCount(env.KV)

if (count > 100) {
  console.warn('DLQ has many entries, manual review needed')
  // Trigger alert
}
```

## Integration with Retry Logic

The DLQ is tightly integrated with the retry mechanism:

1. **First Attempt**: Operation is attempted
2. **Retry 1**: Wait 1 second, retry
3. **Retry 2**: Wait 2 seconds, retry
4. **Retry 3**: Wait 4 seconds, retry
5. **All Failed**: Write to DLQ with attempt count = 3

```typescript
// This happens automatically with processWithRetryAndDLQ
await processWithRetryAndDLQ(
  async () => await dbOperation(),
  env.KV,
  eventData,
  context,
  {
    maxRetries: 3,        // Default
    baseDelayMs: 1000     // Default: 1s, 2s, 4s delays
  }
)
```

## Monitoring and Alerting

### Recommended Alerts

1. **High DLQ Count**: Alert when count > 100
2. **Rapid Growth**: Alert when count increases by > 50 in 5 minutes
3. **Old Entries**: Alert when entries are approaching 7-day TTL

### Monitoring Query

```typescript
// Check DLQ health
const count = await getDLQCount(env.KV)
const entries = await listDLQEntries(env.KV, 10)

console.log(`DLQ Status:`)
console.log(`  Total entries: ${count}`)
console.log(`  Recent failures:`)

for (const { entry } of entries) {
  const age = Date.now() - new Date(entry.timestamp).getTime()
  const ageHours = Math.floor(age / (1000 * 60 * 60))
  
  console.log(`    - ${entry.error} (${ageHours}h ago)`)
}
```

## Manual Reprocessing

When you need to manually reprocess failed events:

```typescript
import { listDLQEntries, deleteDLQEntry } from './lib/dlq'

async function reprocessDLQ(env: Env) {
  const entries = await listDLQEntries(env.KV)
  
  console.log(`Found ${entries.length} failed events`)
  
  for (const { key, entry } of entries) {
    try {
      // Attempt to reprocess
      await processEvent(env.DB, entry.event)
      
      // Success! Delete from DLQ
      await deleteDLQEntry(env.KV, key)
      console.log(`✅ Reprocessed: ${key}`)
      
    } catch (error) {
      console.error(`❌ Still failing: ${key}`, error)
      // Leave in DLQ for further investigation
    }
  }
}
```

## Best Practices

### 1. Include Context

Always include relevant context when writing to DLQ:

```typescript
await writeToDLQ(
  env.KV,
  event,
  error.message,
  attemptCount,
  {
    endpoint: '/webhooks/payment',
    customer_id: event.customer_id,
    invoice_id: event.invoice_id,
    timestamp: new Date().toISOString()
  }
)
```

### 2. Regular Review

Set up a scheduled job to review DLQ entries:

```typescript
// In a Cloudflare Cron Trigger
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const count = await getDLQCount(env.KV)
    
    if (count > 0) {
      // Send notification to ops team
      await notifyOpsTeam(`DLQ has ${count} entries requiring review`)
    }
  }
}
```

### 3. Categorize Errors

Use error messages to categorize failures:

```typescript
const entries = await listDLQEntries(env.KV)

const errorTypes = entries.reduce((acc, { entry }) => {
  const errorType = entry.error.split(':')[0]
  acc[errorType] = (acc[errorType] || 0) + 1
  return acc
}, {} as Record<string, number>)

console.log('Error breakdown:', errorTypes)
// Example output:
// {
//   'Database timeout': 15,
//   'Network error': 8,
//   'Validation failed': 3
// }
```

### 4. Automatic Cleanup

The 7-day TTL ensures automatic cleanup, but you can also manually clean up old entries:

```typescript
async function cleanupOldEntries(env: Env, maxAgeHours: number = 168) {
  const entries = await listDLQEntries(env.KV)
  const now = Date.now()
  
  for (const { key, entry } of entries) {
    const age = now - new Date(entry.timestamp).getTime()
    const ageHours = age / (1000 * 60 * 60)
    
    if (ageHours > maxAgeHours) {
      await deleteDLQEntry(env.KV, key)
      console.log(`Cleaned up old entry: ${key}`)
    }
  }
}
```

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
npm test -- dlq.test.ts
```

### Integration Tests

Test retry + DLQ integration:

```bash
npm test -- retry-dlq-integration.test.ts
```

### Manual Testing

Run the interactive demo:

```bash
npx tsx tests/manual-test-dlq.ts
```

## Troubleshooting

### Issue: DLQ entries not appearing

**Possible causes:**
1. KV namespace not properly bound in wrangler.toml
2. Retry logic succeeding (check logs)
3. Error in DLQ write itself (check console.error logs)

**Solution:**
```typescript
// Add debug logging
console.log('Writing to DLQ:', { event, error, attemptCount })
await writeToDLQ(env.KV, event, error, attemptCount, context)
console.log('DLQ write complete')
```

### Issue: Cannot retrieve DLQ entries

**Possible causes:**
1. Wrong KV namespace
2. Entries expired (> 7 days old)
3. Key format mismatch

**Solution:**
```typescript
// List all keys to debug
const allKeys = await env.KV.list()
console.log('All KV keys:', allKeys.keys.map(k => k.name))

// Check for dlq: prefix
const dlqKeys = allKeys.keys.filter(k => k.name.startsWith('dlq:'))
console.log('DLQ keys:', dlqKeys)
```

### Issue: High DLQ count

**Investigation steps:**
1. Check error patterns: `listDLQEntries()` and group by error message
2. Review recent code changes that might cause failures
3. Check external service status (database, APIs)
4. Verify environment configuration (secrets, bindings)

## Performance Considerations

### KV Limits

- **Writes**: 1,000 writes/second (sufficient for DLQ use case)
- **Reads**: Unlimited
- **Storage**: 1 GB per namespace (sufficient for millions of entries)

### Cost Optimization

- 7-day TTL ensures automatic cleanup
- Use `limit` parameter when listing to avoid reading all entries
- Batch reprocessing to minimize KV operations

## Security

### Data Privacy

DLQ entries may contain sensitive data. Ensure:

1. **Access Control**: Restrict KV namespace access to authorized personnel
2. **Audit Logging**: Log all DLQ access for compliance
3. **Data Minimization**: Only store necessary event data
4. **Encryption**: KV data is encrypted at rest by Cloudflare

### Example: Sanitizing Sensitive Data

```typescript
function sanitizeEvent(event: any): any {
  const sanitized = { ...event }
  
  // Remove sensitive fields
  delete sanitized.credit_card_number
  delete sanitized.password
  delete sanitized.api_key
  
  return sanitized
}

await writeToDLQ(
  env.KV,
  sanitizeEvent(event),  // Sanitize before storing
  error.message,
  attemptCount,
  context
)
```

## Related Documentation

- [Retry Implementation](./retry-wrapper-usage.md)
- [Error Handling](./error-handling.md)
- [Monitoring and Alerting](./monitoring.md)

## API Reference

See the inline documentation in:
- `src/lib/dlq.ts` - DLQ functions
- `src/lib/retry.ts` - Retry with DLQ integration
