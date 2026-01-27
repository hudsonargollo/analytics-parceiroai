# End-to-End Testing Guide

This guide provides comprehensive end-to-end testing procedures for the Subscription Recovery Analytics system in the staging environment.

## Prerequisites

- Staging environment deployed and accessible
- API keys configured
- n8n staging instance configured
- Test data prepared

## Test Suite Overview

1. Webhook Ingestion Flow
2. Analytics API Endpoints
3. Dashboard Functionality
4. Chatwoot Sidebar Integration
5. Caching Behavior
6. Rate Limiting and Authentication

## 1. Webhook Ingestion Flow

### Test 1.1: Payment Webhook Ingestion

Send a test payment webhook from n8n staging:

```bash
curl -X POST https://staging-worker.your-domain.workers.dev/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $(echo -n 'your-secret' + '{"event_id":"test_001",...}' | openssl dgst -sha256 -hex)" \
  -d '{
    "event_id": "test_payment_001",
    "customer_id": "cust_test_001",
    "invoice_id": "inv_test_001",
    "amount": 15000,
    "payment_method": "pix",
    "status": "confirmed",
    "due_date": "2024-01-30",
    "timestamp": "2024-01-27T12:00:00Z"
  }'
```

**Expected Result:**
- HTTP 202 Accepted response
- Event stored in D1 database
- Recovery branch classified correctly

**Verification:**
```bash
wrangler d1 execute subscription-recovery-staging --env staging \
  --command "SELECT * FROM payment_events WHERE event_id = 'test_payment_001'"
```

### Test 1.2: Engagement Webhook Ingestion

Send a test engagement webhook:

```bash
curl -X POST https://staging-worker.your-domain.workers.dev/webhooks/engagement \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: your-signature" \
  -d '{
    "message_id": "msg_test_001",
    "customer_id": "cust_test_001",
    "status": "read",
    "timestamp": "2024-01-27T12:05:00Z"
  }'
```

**Expected Result:**
- HTTP 202 Accepted response
- Engagement event stored or recovery log updated

### Test 1.3: Duplicate Event Handling

Resend the same payment webhook:

**Expected Result:**
- HTTP 409 Conflict or appropriate idempotency handling
- No duplicate records in database

## 2. Analytics API Endpoints

### Test 2.1: Recovery Rate Endpoint

```bash
curl https://staging-worker.your-domain.workers.dev/api/metrics/recovery-rate?date_range=30d \
  -H "X-API-Key: your-staging-api-key"
```

**Expected Result:**
```json
{
  "branch": "all",
  "date_range": "30d",
  "total_attempts": 100,
  "successful_recoveries": 75,
  "recovery_rate": 75.0,
  "total_amount_attempted": 1000000,
  "total_amount_recovered": 750000,
  "breakdown_by_method": {
    "pix": { "attempts": 50, "recoveries": 40, "rate": 80.0 },
    "boleto": { "attempts": 30, "recoveries": 20, "rate": 66.7 },
    "credit_card": { "attempts": 20, "recoveries": 15, "rate": 75.0 }
  }
}
```

### Test 2.2: DSO Endpoint

```bash
curl https://staging-worker.your-domain.workers.dev/api/metrics/dso?date_range=30d \
  -H "X-API-Key: your-staging-api-key"
```

**Expected Result:**
```json
{
  "date_range": "30d",
  "average_dso": 5.2,
  "median_dso": 4.0,
  "by_branch": {
    "3-day-notice": 3.5,
    "due-today": 5.0,
    "overdue": 7.8
  }
}
```

### Test 2.3: Cohort Analysis Endpoint

```bash
curl https://staging-worker.your-domain.workers.dev/api/metrics/cohorts?start_month=2024-01&end_month=2024-03 \
  -H "X-API-Key: your-staging-api-key"
```

**Expected Result:**
```json
{
  "cohorts": [
    {
      "cohort_month": "2024-01",
      "total_customers": 50,
      "billing_cycles": [
        {
          "cycle_number": 1,
          "attempted": 50,
          "recovered": 45,
          "recovery_rate": 90.0
        }
      ],
      "is_statistically_significant": true
    }
  ]
}
```

### Test 2.4: Pagination

```bash
curl "https://staging-worker.your-domain.workers.dev/api/metrics/recovery-rate?date_range=30d&page=1&page_size=10" \
  -H "X-API-Key: your-staging-api-key"
```

**Expected Result:**
- Response includes pagination metadata
- Results limited to page_size

### Test 2.5: Invalid Parameters

```bash
curl "https://staging-worker.your-domain.workers.dev/api/metrics/recovery-rate?date_range=invalid" \
  -H "X-API-Key: your-staging-api-key"
```

**Expected Result:**
- HTTP 400 Bad Request
- Descriptive error message

## 3. Dashboard Functionality

### Test 3.1: Dashboard Loading

1. Open browser to: `https://subscription-recovery-staging.pages.dev`
2. Verify dashboard loads within 2 seconds
3. Check all components render:
   - DSO Metrics cards
   - Recovery Rate Chart
   - Cohort Analysis Table

### Test 3.2: Filter Interactions

1. Change date range filter on DSO Metrics
2. Verify data updates
3. Change branch filter on Recovery Rate Chart
4. Verify chart updates

### Test 3.3: Refresh Functionality

1. Click "Refresh" button
2. Verify all components reload data
3. Toggle "Auto-refresh ON"
4. Wait 5 minutes and verify data refreshes automatically

### Test 3.4: Responsive Design

1. Resize browser to mobile viewport (375px width)
2. Verify layout adapts correctly
3. Verify all components remain functional

## 4. Chatwoot Sidebar Integration

### Test 4.1: Billing Sidebar Loading

1. Open Chatwoot staging instance
2. Open a customer conversation
3. Verify sidebar loads customer billing data
4. Check outstanding invoices display correctly

### Test 4.2: Copy Pix Code

1. Find invoice with Pix payment method
2. Click "Copy Pix Code" button
3. Verify success toast appears
4. Paste clipboard content and verify Pix code

### Test 4.3: Resend Boleto

1. Find invoice with Boleto payment method
2. Click "Resend Boleto" button
3. Verify success toast appears
4. Check n8n staging logs for webhook trigger
5. Verify customer receives WhatsApp message

## 5. Caching Behavior

### Test 5.1: Cache Hit

1. Make API request to recovery-rate endpoint
2. Note response time
3. Make same request again within 5 minutes
4. Verify response time is significantly faster (cache hit)

### Test 5.2: Cache Expiration

1. Make API request
2. Wait 6 minutes
3. Make same request again
4. Verify response time is slower (cache miss, fresh query)

### Test 5.3: Current Day Bypass

1. Make API request with `date_range=today`
2. Make same request again immediately
3. Verify both requests query D1 directly (no cache)

### Test 5.4: Cache Invalidation

1. Make API request and cache result
2. Send webhook that affects cached data
3. Make same API request again
4. Verify cache was invalidated and fresh data returned

## 6. Rate Limiting and Authentication

### Test 6.1: Valid Authentication

```bash
curl https://staging-worker.your-domain.workers.dev/api/metrics/recovery-rate?date_range=30d \
  -H "X-API-Key: valid-staging-key"
```

**Expected Result:**
- HTTP 200 OK
- Valid response data

### Test 6.2: Invalid Authentication

```bash
curl https://staging-worker.your-domain.workers.dev/api/metrics/recovery-rate?date_range=30d \
  -H "X-API-Key: invalid-key"
```

**Expected Result:**
- HTTP 401 Unauthorized
- Error message

### Test 6.3: Missing Authentication

```bash
curl https://staging-worker.your-domain.workers.dev/api/metrics/recovery-rate?date_range=30d
```

**Expected Result:**
- HTTP 401 Unauthorized

### Test 6.4: Rate Limiting

Run this script to test rate limiting:

```bash
#!/bin/bash
for i in {1..105}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://staging-worker.your-domain.workers.dev/api/metrics/recovery-rate?date_range=30d \
    -H "X-API-Key: your-staging-api-key"
done
```

**Expected Result:**
- First 100 requests: HTTP 200
- Requests 101+: HTTP 429 Too Many Requests
- Response includes `Retry-After` header

## Test Results Checklist

- [ ] Payment webhooks ingested successfully
- [ ] Engagement webhooks processed correctly
- [ ] Duplicate events handled properly
- [ ] Recovery rate API returns correct data
- [ ] DSO API returns correct data
- [ ] Cohort analysis API returns correct data
- [ ] Pagination works correctly
- [ ] Invalid parameters return 400 errors
- [ ] Dashboard loads within 2 seconds
- [ ] All dashboard components render
- [ ] Filters update data correctly
- [ ] Refresh functionality works
- [ ] Responsive design works on mobile
- [ ] Chatwoot sidebar loads billing data
- [ ] Copy Pix Code works
- [ ] Resend Boleto triggers n8n webhook
- [ ] Cache hits improve performance
- [ ] Cache expires after 5 minutes
- [ ] Current day queries bypass cache
- [ ] Cache invalidates on writes
- [ ] Valid API keys authenticate successfully
- [ ] Invalid API keys return 401
- [ ] Rate limiting enforces 100 req/min limit

## Reporting Issues

If any tests fail:
1. Document the failure with screenshots/logs
2. Check Cloudflare dashboard for errors
3. Review Worker logs: `wrangler tail --env staging`
4. Check D1 database state
5. Report issue with reproduction steps

## Next Steps

After all tests pass:
- Proceed to performance testing (Task 22.3)
- Document any issues found
- Update configuration if needed
- Prepare for production deployment
