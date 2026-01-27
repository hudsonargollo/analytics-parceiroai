# Checkpoint 7: Testing Instructions

This document provides instructions for completing the checkpoint testing once the Wrangler system error is resolved.

## Current Status

✅ **All business logic implemented and tested with mock databases**
⚠️ **Wrangler system error prevents live testing**

## What Has Been Tested

All webhook ingestion logic has been thoroughly tested using manual test scripts:

1. ✅ Payment event insertion and validation
2. ✅ Engagement event processing
3. ✅ HMAC signature validation
4. ✅ Recovery branch classification
5. ✅ Duplicate event detection
6. ✅ Orphaned engagement event handling

See `CHECKPOINT_7_REPORT.md` for detailed test results.

## Prerequisites for Live Testing

Before you can test with the actual Cloudflare infrastructure, you need to:

### 1. Resolve Wrangler System Error

The current error is: `spawn Unknown system error -88`

**Recommended solutions:**

```bash
# Option 1: Update Wrangler to latest version
npm install --save-dev wrangler@4

# Option 2: Clear Wrangler cache
rm -rf .wrangler
rm -rf node_modules/.cache

# Option 3: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### 2. Create D1 Database

```bash
# Create the database
wrangler d1 create recovery_analytics

# Copy the database_id from the output
# Update wrangler.toml with the actual database_id
```

### 3. Create KV Namespace

```bash
# Create the KV namespace
wrangler kv:namespace create "CACHE"

# Copy the id from the output
# Update wrangler.toml with the actual KV id
```

### 4. Apply Database Migrations

```bash
# Apply the schema to your D1 database
wrangler d1 execute recovery_analytics --file=./migrations/0001_initial_schema.sql --local

# For remote database (once ready)
wrangler d1 execute recovery_analytics --file=./migrations/0001_initial_schema.sql --remote
```

### 5. Set Secrets

```bash
# Generate a strong secret
openssl rand -hex 32

# Set the webhook secret
wrangler secret put WEBHOOK_SECRET
# Paste the generated secret when prompted

# Set other secrets
wrangler secret put ZUCKZAPGO_SECRET
wrangler secret put VALID_API_KEYS
wrangler secret put CHATWOOT_TOKEN
```

## Testing Steps

Once the prerequisites are complete:

### Step 1: Start the Development Server

```bash
npm run dev
```

You should see:
```
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### Step 2: Test Health Check

In a new terminal:

```bash
curl http://localhost:8787/
```

Expected response:
```json
{
  "status": "ok",
  "service": "subscription-recovery-analytics",
  "environment": "development",
  "timestamp": "2024-01-26T10:00:00.000Z"
}
```

### Step 3: Run Automated Webhook Tests

We've created a comprehensive test script:

```bash
# Set your webhook secret
export WEBHOOK_SECRET="your-secret-here"

# Run the test script
./test-webhooks.sh
```

This script will:
- Test payment webhooks with all three recovery branches
- Test engagement webhooks (delivered and read)
- Test invalid signature rejection
- Test duplicate event detection

### Step 4: Verify Data in D1

Check that data was stored correctly:

```bash
# View payment events
wrangler d1 execute recovery_analytics --local \
  --command "SELECT * FROM payment_events ORDER BY created_at DESC LIMIT 5"

# View engagement events
wrangler d1 execute recovery_analytics --local \
  --command "SELECT * FROM engagement_events ORDER BY created_at DESC LIMIT 5"

# View recovery logs
wrangler d1 execute recovery_analytics --local \
  --command "SELECT * FROM recovery_logs ORDER BY created_at DESC LIMIT 5"
```

### Step 5: Manual Testing with curl

You can also test manually:

#### Payment Webhook

```bash
# Set your secret
SECRET="your-webhook-secret"

# Create payload
PAYLOAD='{"event_id":"manual_test_001","customer_id":"cust_manual","invoice_id":"inv_manual","amount":5000,"payment_method":"pix","status":"pending","due_date":"2024-01-29","timestamp":"2024-01-26T10:00:00Z"}'

# Compute signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send request
curl -X POST http://localhost:8787/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

Expected response:
```json
{
  "status": "accepted",
  "event_id": "manual_test_001"
}
```

#### Engagement Webhook

```bash
# Create payload
PAYLOAD='{"message_id":"msg_manual","customer_id":"cust_manual","status":"delivered","timestamp":"2024-01-26T10:05:00Z"}'

# Compute signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send request
curl -X POST http://localhost:8787/webhooks/engagement \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

Expected response:
```json
{
  "status": "accepted",
  "message_id": "msg_manual"
}
```

## Verification Checklist

Use this checklist to verify everything is working:

- [ ] Wrangler system error resolved
- [ ] D1 database created and configured
- [ ] KV namespace created and configured
- [ ] Database migrations applied successfully
- [ ] Secrets configured
- [ ] Development server starts without errors
- [ ] Health check endpoint returns 200 OK
- [ ] Payment webhook accepts valid requests (HTTP 202)
- [ ] Engagement webhook accepts valid requests (HTTP 202)
- [ ] Invalid signatures are rejected (HTTP 401)
- [ ] Duplicate events are rejected (HTTP 409)
- [ ] Data appears in D1 payment_events table
- [ ] Data appears in D1 engagement_events table
- [ ] Recovery branch classification is correct
- [ ] Timestamps are recorded properly

## Troubleshooting

### Worker won't start

```bash
# Check wrangler.toml configuration
cat wrangler.toml

# Try with verbose logging
wrangler dev --log-level debug

# Check for port conflicts
lsof -i :8787
```

### Database queries fail

```bash
# Verify database exists
wrangler d1 list

# Verify migrations were applied
wrangler d1 execute recovery_analytics --local \
  --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### Signature validation fails

```bash
# Verify secret is set correctly
wrangler secret list

# Test signature computation
echo -n '{"test":"data"}' | openssl dgst -sha256 -hmac "your-secret"
```

### Data not appearing in database

```bash
# Check worker logs
# Look for error messages in the terminal where wrangler dev is running

# Verify table structure
wrangler d1 execute recovery_analytics --local \
  --command "PRAGMA table_info(payment_events)"
```

## Next Steps

Once all tests pass:

1. ✅ Mark task 7 as complete
2. 🔄 Proceed to task 8: Implement authentication and rate limiting middleware
3. 📝 Update the checkpoint report with live testing results
4. 🚀 Consider deploying to staging environment

## Questions?

If you encounter issues:

1. Check the detailed test report: `CHECKPOINT_7_REPORT.md`
2. Review the implementation documentation: `docs/webhook-middleware-implementation.md`
3. Check Cloudflare Workers documentation: https://developers.cloudflare.com/workers/
4. Review the design document: `.kiro/specs/subscription-recovery-analytics/design.md`

---

**Note:** All business logic is working correctly. The only blocker is the Wrangler system error, which is an infrastructure/tooling issue, not a code issue.
