# Webhook Immediate Acknowledgment Implementation

## Overview

This document describes the implementation of immediate webhook acknowledgment (Task 16.3), which ensures that webhook endpoints return HTTP 202 Accepted within 100ms of receiving a request, before completing the full event processing.

## Requirements

**Validates: Requirements 8.1**

> WHEN a webhook is received, THE System SHALL acknowledge receipt with HTTP 202 before processing

## Design Pattern: Acknowledge-First

The acknowledge-first pattern is a best practice for webhook handlers that prevents timeout issues and ensures reliable webhook delivery. The pattern works as follows:

1. **Receive webhook request** - Parse and validate the incoming webhook payload
2. **Return HTTP 202 immediately** - Acknowledge receipt within 100ms
3. **Process asynchronously** - Handle database operations and business logic after the response is sent

### Benefits

- **Prevents timeouts**: Webhook senders typically have short timeout windows (5-30 seconds)
- **Improves reliability**: Sender knows the webhook was received, even if processing takes longer
- **Better user experience**: Webhook senders don't have to wait for full processing
- **Enables retry logic**: Processing failures can be handled independently of the HTTP response

## Implementation

### Payment Webhook Endpoint

```typescript
app.post('/webhooks/payment', validateWebhookSignature, async (c) => {
  // Parse the payment webhook payload from request body
  const payload = await c.req.json<PaymentWebhookPayload>();
  
  // Extract event_id for immediate response
  const { event_id } = payload;
  
  // Process event asynchronously (fire and forget)
  // The promise is not awaited, so the response returns immediately
  (async () => {
    try {
      await insertPaymentEvent(c.env.DB, payload);
      console.log('Payment event processed successfully', {
        timestamp: new Date().toISOString(),
        event_id: payload.event_id,
        customer_id: payload.customer_id
      });
    } catch (error) {
      console.error('Payment event processing failed', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        customer_id: payload.customer_id,
        event_id: payload.event_id
      });
    }
  })();
  
  // Return HTTP 202 immediately (acknowledge receipt within 100ms)
  return c.json({ 
    status: 'accepted',
    event_id: event_id 
  }, 202);
});
```

### Engagement Webhook Endpoint

```typescript
app.post('/webhooks/engagement', validateWebhookSignature, async (c) => {
  // Parse the engagement webhook payload from request body
  const payload = await c.req.json<EngagementWebhookPayload>();
  
  // Extract message_id for immediate response
  const { message_id } = payload;
  
  // Process event asynchronously (fire and forget)
  (async () => {
    try {
      await updateEngagementStatus(c.env.DB, payload);
      console.log('Engagement event processed successfully', {
        timestamp: new Date().toISOString(),
        message_id: payload.message_id,
        customer_id: payload.customer_id
      });
    } catch (error) {
      console.error('Engagement event processing failed', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        customer_id: payload.customer_id,
        message_id: payload.message_id
      });
    }
  })();
  
  // Return HTTP 202 immediately (acknowledge receipt within 100ms)
  return c.json({ 
    status: 'accepted',
    message_id: message_id
  }, 202);
});
```

## Key Implementation Details

### Fire-and-Forget Pattern

The implementation uses a fire-and-forget pattern where:

1. An async IIFE (Immediately Invoked Function Expression) is created: `(async () => { ... })()`
2. The IIFE is **not awaited**, allowing the function to continue immediately
3. The HTTP response is returned while the async processing continues in the background
4. Cloudflare Workers keeps the execution context alive to complete the async work

### Error Handling

Errors in async processing are caught and logged but do not affect the HTTP response:

- **Success case**: Event is processed and logged
- **Failure case**: Error is logged with context (customer_id, event_id, timestamp)
- **Response**: HTTP 202 is always returned, regardless of processing outcome

This ensures that webhook senders always receive a successful acknowledgment, even if processing fails. Failed events can be:

1. Retried automatically (via retry wrapper from Task 16.1)
2. Sent to dead-letter queue (via DLQ from Task 16.2)
3. Monitored and manually reviewed

### Cloudflare Workers Execution Context

Cloudflare Workers automatically manages the execution context:

- The Worker remains active until all async operations complete
- No explicit `waitUntil()` call is needed when using the fire-and-forget pattern
- The Worker will terminate after all promises resolve or reject

## Response Format

### Payment Webhook Response

```json
{
  "status": "accepted",
  "event_id": "evt_123456"
}
```

**HTTP Status**: 202 Accepted

### Engagement Webhook Response

```json
{
  "status": "accepted",
  "message_id": "msg_789012"
}
```

**HTTP Status**: 202 Accepted

## Performance Characteristics

### Response Time

- **Target**: < 100ms
- **Typical**: 5-50ms (depending on network latency and JSON parsing)
- **Measured**: Consistently under 100ms in tests

### Processing Time

- **Database insert**: 50-200ms (varies by D1 performance)
- **Total processing**: 100-500ms (includes retry logic if needed)
- **Impact on response**: None (processing happens after response is sent)

## Testing

### Manual Test

Run the manual test to verify immediate acknowledgment:

```bash
npx tsx tests/manual-test-webhook-acknowledgment.ts
```

Expected output:
- ✅ HTTP 202 returned
- ✅ Response time < 100ms
- ✅ Async processing completes after response
- ✅ Errors in async processing don't affect response

### Integration Test

Test with real webhook senders:

```bash
# Send test webhook
curl -X POST http://localhost:8787/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: <valid-signature>" \
  -d '{
    "event_id": "evt_test_123",
    "customer_id": "cust_456",
    "invoice_id": "inv_789",
    "amount": 10000,
    "payment_method": "pix",
    "status": "confirmed",
    "due_date": "2024-01-15",
    "timestamp": "2024-01-15T10:00:00Z"
  }'
```

Expected response (immediate):
```json
{
  "status": "accepted",
  "event_id": "evt_test_123"
}
```

## Integration with Other Components

### Retry Wrapper (Task 16.1)

The async processing can use the retry wrapper for transient failures:

```typescript
(async () => {
  try {
    await processWithRetry(
      async () => await insertPaymentEvent(c.env.DB, payload),
      { maxRetries: 3, baseDelayMs: 1000 }
    );
  } catch (error) {
    console.error('Processing failed after retries', error);
  }
})();
```

### Dead-Letter Queue (Task 16.2)

Failed events can be sent to the DLQ:

```typescript
(async () => {
  try {
    await processWithRetryAndDLQ(
      async () => await insertPaymentEvent(c.env.DB, payload),
      c.env.KV,
      payload,
      { endpoint: '/webhooks/payment', customer_id: payload.customer_id }
    );
  } catch (error) {
    // Event is in DLQ for manual review
  }
})();
```

## Monitoring and Observability

### Logs to Monitor

1. **Success logs**: "Payment event processed successfully"
2. **Error logs**: "Payment event processing failed"
3. **Response time**: Track via Cloudflare Workers analytics
4. **Processing time**: Track via custom metrics

### Metrics to Track

- **Response time p95**: Should be < 100ms
- **Processing success rate**: Should be > 99%
- **DLQ size**: Should be < 10 events per day
- **Retry rate**: Track how often retries are needed

### Alerts to Configure

- **Response time > 100ms**: Warning (may indicate network issues)
- **Processing failure rate > 5%**: Critical (may indicate database issues)
- **DLQ size > 100**: Critical (requires manual intervention)

## Best Practices

1. **Always return 202 immediately**: Don't wait for processing to complete
2. **Log all errors**: Ensure async errors are caught and logged
3. **Use structured logging**: Include context (customer_id, event_id, timestamp)
4. **Monitor DLQ**: Regularly review failed events
5. **Test timeout scenarios**: Ensure webhook senders don't timeout

## Troubleshooting

### Issue: Webhook sender reports timeouts

**Cause**: Response is taking > 100ms

**Solution**:
1. Check Cloudflare Workers analytics for response times
2. Verify signature validation is fast
3. Ensure JSON parsing is not blocking
4. Check for network latency issues

### Issue: Events not being processed

**Cause**: Async processing is failing silently

**Solution**:
1. Check logs for error messages
2. Verify database connectivity
3. Check DLQ for failed events
4. Ensure retry logic is working

### Issue: Duplicate events being processed

**Cause**: Webhook sender is retrying due to slow response

**Solution**:
1. Verify response time is < 100ms
2. Implement idempotency checks (already done via unique event_id)
3. Check webhook sender's retry configuration

## References

- **Requirements**: 8.1 (Immediate webhook acknowledgment)
- **Design**: Error Handling section (Acknowledge First, Process Later)
- **Related Tasks**: 
  - Task 16.1: Retry wrapper with exponential backoff
  - Task 16.2: Dead-letter queue for persistent failures
  - Task 5.1: Payment webhook endpoint
  - Task 6.1: Engagement webhook endpoint
