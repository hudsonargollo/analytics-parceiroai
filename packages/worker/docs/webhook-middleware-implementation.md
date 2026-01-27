# Webhook Middleware Implementation

## Overview

This document describes the implementation of the webhook signature validation middleware for the Subscription Recovery Analytics system.

## Implementation Summary

### Files Created

1. **`src/lib/webhook-middleware.ts`** - Main middleware implementation
   - Exports `validateWebhookSignature` function
   - Validates HMAC signatures from webhook requests
   - Rejects unauthorized requests with HTTP 401
   - Logs authentication failures

2. **`tests/webhook-middleware.test.ts`** - Unit tests
   - Tests middleware behavior validation
   - Tests signature validation flows
   - Tests module exports

3. **`tests/manual-test-webhook-middleware.ts`** - Manual testing script
   - Demonstrates middleware usage with Hono
   - Tests various scenarios (valid, invalid, missing, tampered)

### Files Modified

1. **`src/index.ts`** - Added middleware export
   - Exports `validateWebhookSignature` for use in other modules

## Middleware Features

### Security Features

- **HMAC-SHA256 Validation**: Uses the existing `validateHmacSignature` function from `hmac-validation.ts`
- **Constant-Time Comparison**: Prevents timing attacks
- **Request Body Cloning**: Reads body without consuming it for downstream handlers
- **Comprehensive Logging**: Logs all authentication failures with context

### API

```typescript
async function validateWebhookSignature(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void>
```

**Parameters:**
- `c` - Hono context with environment bindings
- `next` - Next middleware/handler function

**Returns:**
- HTTP 401 response if signature is invalid
- Calls `next()` if signature is valid

**Environment Variables Required:**
- `WEBHOOK_SECRET` - The shared secret key for HMAC validation

### Usage Example

```typescript
import { Hono } from 'hono';
import { validateWebhookSignature } from './lib/webhook-middleware';

const app = new Hono<{ Bindings: Env }>();

// Apply middleware to webhook endpoint
app.post('/webhooks/payment', validateWebhookSignature, async (c) => {
  const body = await c.req.json();
  // Process validated webhook
  return c.json({ status: 'accepted' }, 202);
});
```

## Validation Flow

1. Extract `X-Webhook-Signature` header from request
2. Clone and read request body as text
3. Retrieve `WEBHOOK_SECRET` from environment
4. Validate signature using `validateHmacSignature`
5. If invalid:
   - Log authentication failure with timestamp, path, and signature info
   - Return HTTP 401 with error message
6. If valid:
   - Call `next()` to proceed to handler
   - Request body remains available for downstream handlers

## Error Responses

### 401 Unauthorized

Returned when:
- Signature header is missing
- Signature is malformed (not valid hex)
- Signature doesn't match computed HMAC
- Signature is for different payload

Response format:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing webhook signature"
}
```

## Testing

### Manual Testing

Run the manual test script:
```bash
npx tsx tests/manual-test-webhook-middleware.ts
```

This tests:
- Valid signature acceptance
- Missing signature rejection
- Invalid signature rejection
- Tampered payload detection

### Unit Tests

The unit tests validate:
- Signature validation flows
- Module exports
- Integration with HMAC validation functions

Note: Full integration tests require a working Cloudflare Workers test environment.

## Requirements Satisfied

- **Requirement 7.2**: HMAC signature validation for webhooks
- **Requirement 7.4**: Authentication failure logging

## Next Steps

The middleware is ready to be used in webhook endpoints:
- Task 5.1: Payment webhook endpoint
- Task 6.1: Engagement webhook endpoint

Both endpoints should use this middleware to validate incoming webhook requests.
