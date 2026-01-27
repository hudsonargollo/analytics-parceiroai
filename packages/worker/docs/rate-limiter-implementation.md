# Rate Limiting Middleware Implementation

## Overview

The rate limiting middleware provides per-API-key rate limiting using Cloudflare KV storage. It tracks request counts within 60-second windows and returns HTTP 429 responses when limits are exceeded.

## Features

- ✅ Per-API-key rate limiting (default: 100 requests per minute)
- ✅ Configurable request limits
- ✅ Automatic request count tracking in KV
- ✅ 60-second TTL on rate limit keys
- ✅ HTTP 429 responses with Retry-After header
- ✅ Descriptive error messages
- ✅ Security logging for rate limit violations

## Implementation Details

### File Location
- **Middleware**: `packages/worker/src/lib/rate-limiter.ts`
- **Tests**: `packages/worker/tests/rate-limiter.test.ts`
- **Manual Tests**: `packages/worker/tests/manual-test-rate-limiter.ts`

### How It Works

1. **Request Tracking**: Each request with an API key increments a counter in KV
2. **Window-Based**: Uses minute-based windows (Unix timestamp / 60000)
3. **Key Format**: `rate_limit:{apiKey}:{currentMinute}`
4. **TTL**: Keys expire after 60 seconds automatically
5. **Limit Check**: Compares current count against the configured limit
6. **429 Response**: Returns rate limit error when exceeded

### Rate Limit Key Structure

```
rate_limit:test-api-key-123:29876543
           └─────┬─────┘     └───┬───┘
              API Key      Current Minute
```

The current minute is calculated as: `Math.floor(Date.now() / 60000)`

This ensures that rate limits reset every minute automatically.

## Usage

### Basic Usage (Default 100 requests/minute)

```typescript
import { Hono } from 'hono';
import { authenticateApiKey } from './lib/api-key-auth';
import { rateLimiter } from './lib/rate-limiter';

const app = new Hono<{ Bindings: Env }>();

// Apply rate limiting to an endpoint
app.get('/api/metrics/recovery-rate',
  authenticateApiKey,    // Authenticate first
  rateLimiter(),         // Then rate limit (default: 100/min)
  async (c) => {
    // Handle request
    return c.json({ data: 'metrics' });
  }
);
```

### Custom Rate Limit

```typescript
// Allow only 50 requests per minute
app.get('/api/expensive-operation',
  authenticateApiKey,
  rateLimiter(50),       // Custom limit
  async (c) => {
    // Handle request
    return c.json({ data: 'result' });
  }
);
```

### Multiple Endpoints with Different Limits

```typescript
// Public endpoints - higher limit
app.get('/api/public/stats',
  authenticateApiKey,
  rateLimiter(200),
  async (c) => {
    return c.json({ stats: 'data' });
  }
);

// Premium endpoints - lower limit
app.get('/api/premium/analysis',
  authenticateApiKey,
  rateLimiter(50),
  async (c) => {
    return c.json({ analysis: 'data' });
  }
);
```

## Response Format

### Success Response (Within Limit)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": "your response"
}
```

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Maximum 100 requests per minute allowed.",
  "retry_after": 45
}
```

## Middleware Behavior

### With API Key
- Tracks requests in KV
- Enforces rate limit
- Returns 429 when exceeded

### Without API Key
- Passes through to next middleware
- No rate limiting applied
- Allows authentication middleware to handle missing keys

## Testing

### Run Manual Tests

```bash
cd packages/worker
npx tsx tests/manual-test-rate-limiter.ts
```

### Test Coverage

The manual tests verify:
1. ✅ Requests within limit are allowed
2. ✅ Request count is tracked in KV
3. ✅ 429 response after exceeding limit
4. ✅ Retry-After header is included
5. ✅ Rate limits are tracked separately per API key
6. ✅ Requests without API key pass through
7. ✅ Default limit of 100 requests per minute

## Security Considerations

### Logging
- Rate limit violations are logged with:
  - Timestamp
  - API key prefix (first 8 characters only)
  - Request path
  - Current count and limit
  - Retry-After value

### Privacy
- Only API key prefix is logged (e.g., "test-api...")
- Full API keys are never logged

### Performance
- KV operations are fast (< 10ms globally)
- TTL ensures automatic cleanup
- No manual key deletion required

## Integration with Other Middleware

### Recommended Order

```typescript
app.get('/api/endpoint',
  validateWebhookSignature,  // 1. Validate signature (if webhook)
  authenticateApiKey,        // 2. Authenticate API key
  rateLimiter(100),          // 3. Rate limit
  async (c) => {             // 4. Handle request
    // Your logic here
  }
);
```

### Why This Order?

1. **Signature validation first**: Reject invalid webhooks immediately
2. **Authentication second**: Verify API key is valid
3. **Rate limiting third**: Track and limit authenticated requests
4. **Handler last**: Process the validated, authenticated, rate-limited request

## KV Storage Requirements

### Bindings Required

In `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
```

### Storage Usage

- **Key size**: ~50 bytes per API key per minute
- **Value size**: ~10 bytes (request count as string)
- **TTL**: 60 seconds (automatic cleanup)
- **Estimated usage**: ~100 keys active at any time (for 100 API keys)

### Cost Considerations

Cloudflare KV pricing (as of 2024):
- **Reads**: $0.50 per million reads
- **Writes**: $5.00 per million writes
- **Storage**: $0.50 per GB per month

For 100 requests/minute per API key:
- ~100 reads/minute
- ~100 writes/minute
- Negligible storage cost (keys expire after 60s)

## Troubleshooting

### Rate Limit Not Working

**Check KV binding**:
```typescript
// In your handler
console.log('KV available:', !!c.env.KV);
```

**Check API key header**:
```typescript
// Rate limiter only works with X-API-Key header
const apiKey = c.req.header('X-API-Key');
console.log('API Key:', apiKey ? 'present' : 'missing');
```

### Rate Limit Too Strict

**Increase the limit**:
```typescript
// Change from default 100 to higher value
rateLimiter(500)  // 500 requests per minute
```

### Rate Limit Not Resetting

**Check system time**:
- Rate limits use `Date.now()` for window calculation
- Ensure server time is correct
- Windows reset every 60 seconds automatically

## Requirements Validation

This implementation satisfies:

- **Requirement 7.5**: "THE System SHALL implement rate limiting of 100 requests per minute per API key"
  - ✅ Implements per-API-key rate limiting
  - ✅ Default limit of 100 requests per minute
  - ✅ Uses KV for request tracking
  - ✅ Returns 429 after limit exceeded
  - ✅ Includes Retry-After header

## Future Enhancements

Potential improvements for future versions:

1. **Sliding Window**: More accurate rate limiting using sliding windows
2. **Burst Allowance**: Allow short bursts above the limit
3. **Multiple Time Windows**: Support hourly/daily limits
4. **Rate Limit Headers**: Add X-RateLimit-* headers to all responses
5. **Distributed Rate Limiting**: Coordinate across multiple workers
6. **Custom Error Messages**: Per-endpoint rate limit messages

## Related Documentation

- [API Key Authentication](./api-key-auth-implementation.md)
- [Webhook Middleware](./webhook-middleware-implementation.md)
- [Design Document](../../../.kiro/specs/subscription-recovery-analytics/design.md)
- [Requirements](../../../.kiro/specs/subscription-recovery-analytics/requirements.md)
