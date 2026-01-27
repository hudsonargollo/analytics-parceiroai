# API Key Authentication Middleware Implementation

## Overview

The API key authentication middleware provides secure authentication for API endpoints by validating API keys from the `X-API-Key` header against a list of valid keys stored in environment secrets.

## Implementation Details

### Module: `src/lib/api-key-auth.ts`

The middleware implements the following functionality:

1. **Header Extraction**: Extracts the API key from the `X-API-Key` header
2. **Validation**: Validates the key against the `VALID_API_KEYS` environment variable
3. **Error Handling**: Returns 401 Unauthorized for invalid or missing keys
4. **Logging**: Logs all authentication failures with context

### Key Features

- **Multiple API Keys**: Supports comma-separated list of valid API keys
- **Whitespace Handling**: Automatically trims whitespace from API keys
- **Case-Sensitive**: API keys are case-sensitive for security
- **Detailed Logging**: Logs authentication failures with request context
- **Security**: Only logs API key prefix (first 8 characters) to prevent exposure

## Usage

### Basic Usage

```typescript
import { Hono } from 'hono';
import { authenticateApiKey } from './lib/api-key-auth';

const app = new Hono();

// Protect an endpoint with API key authentication
app.get('/api/metrics/recovery-rate', authenticateApiKey, async (c) => {
  // This handler only executes if authentication succeeds
  return c.json({ data: 'protected data' });
});
```

### Environment Configuration

Set the `VALID_API_KEYS` environment variable with comma-separated API keys:

```bash
# Single API key
wrangler secret put VALID_API_KEYS
# Enter: my-api-key-123

# Multiple API keys (comma-separated)
wrangler secret put VALID_API_KEYS
# Enter: key-1, key-2, key-3
```

### Making Authenticated Requests

Include the API key in the `X-API-Key` header:

```bash
# Using curl
curl -H "X-API-Key: my-api-key-123" https://api.example.com/api/metrics/recovery-rate

# Using fetch
fetch('https://api.example.com/api/metrics/recovery-rate', {
  headers: {
    'X-API-Key': 'my-api-key-123'
  }
})
```

## Response Formats

### Success (200 OK)

When authentication succeeds, the request proceeds to the next handler:

```json
{
  "data": "protected data"
}
```

### Missing API Key (401 Unauthorized)

When the `X-API-Key` header is missing or empty:

```json
{
  "error": "Unauthorized",
  "message": "Missing API key. Please provide X-API-Key header."
}
```

### Invalid API Key (401 Unauthorized)

When the API key doesn't match any valid keys:

```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

## Security Considerations

### API Key Management

1. **Generation**: Use cryptographically secure random strings (e.g., `openssl rand -hex 32`)
2. **Storage**: Store keys in Cloudflare Secrets Manager, never in code
3. **Rotation**: Rotate keys quarterly or when compromised
4. **Separation**: Use different keys for different environments (dev, staging, prod)

### Best Practices

1. **HTTPS Only**: Always use HTTPS to prevent key interception
2. **Rate Limiting**: Combine with rate limiting middleware (see task 8.2)
3. **Monitoring**: Monitor authentication failures for potential attacks
4. **Key Prefix Logging**: Only log key prefixes to prevent exposure in logs

### Example Key Generation

```bash
# Generate a secure API key
openssl rand -hex 32
# Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Set as secret
wrangler secret put VALID_API_KEYS
# Enter: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

## Testing

### Unit Tests

The middleware includes comprehensive unit tests in `tests/api-key-auth.test.ts`:

- Valid API key acceptance
- Multiple API keys support
- Missing API key rejection
- Invalid API key rejection
- Empty API key rejection
- Whitespace handling
- Case sensitivity

### Manual Testing

Run manual tests with:

```bash
npx tsx tests/manual-test-api-key-auth.ts
```

### Integration Testing

Test with a real endpoint:

```bash
# Test with valid key
curl -H "X-API-Key: test-key" http://localhost:8787/api/test

# Test with invalid key
curl -H "X-API-Key: wrong-key" http://localhost:8787/api/test

# Test without key
curl http://localhost:8787/api/test
```

## Logging

### Authentication Failure Logs

The middleware logs all authentication failures with the following structure:

```typescript
{
  timestamp: '2024-01-26T10:56:04.574Z',
  path: '/api/metrics/recovery-rate',
  method: 'GET',
  reason: 'missing_api_key' | 'invalid_api_key',
  apiKeyPrefix?: 'a1b2c3d4...' // Only for invalid keys
}
```

### Log Levels

- **Error**: All authentication failures (missing or invalid keys)
- **Info**: Successful authentications (not currently logged to reduce noise)

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 7.4**: API requests without valid authentication return HTTP 401
- **Task 8.1**: Extract X-API-Key header, validate against VALID_API_KEYS, return 401 for invalid/missing keys, log failures

## Future Enhancements

Potential improvements for future iterations:

1. **API Key Metadata**: Store key metadata (name, created_at, last_used_at) in KV
2. **Key Expiration**: Implement automatic key expiration
3. **Usage Tracking**: Track API usage per key
4. **Scoped Permissions**: Different keys for different endpoint access levels
5. **Key Rotation**: Automated key rotation with grace periods

## Related Documentation

- [Webhook Middleware Implementation](./webhook-middleware-implementation.md)
- [Rate Limiting Middleware](./rate-limiting-implementation.md) (Task 8.2)
- [Security Best Practices](./security-best-practices.md)
