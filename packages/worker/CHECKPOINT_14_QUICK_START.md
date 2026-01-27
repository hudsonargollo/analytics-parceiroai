# Checkpoint 14: Quick Start Guide

## Quick Test Execution

### Step 1: Start the Worker

Open a terminal and run:

```bash
cd packages/worker
npm run dev
```

Wait for the message: "Ready on http://localhost:8787"

### Step 2: Run the Tests

Open a **new terminal** and run:

```bash
cd packages/worker
./test-checkpoint-14.sh
```

## Expected Output

You should see output like this:

```
🧪 Starting Checkpoint 14: End-to-End Analytics API Testing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Worker is running

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Health Check Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Health check returns 200 OK (Status: 200)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Authentication & Authorization Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Rejects requests without API key (Status: 401)
✓ Rejects requests with invalid API key (Status: 401)
✓ Accepts requests with valid API key (Status: 200)

... (more tests)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Test Summary

Total Tests:  33
✓ Passed:     33
✗ Failed:     0
Success Rate: 100.0%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All tests passed! The analytics API is working correctly.
```

## Troubleshooting

### Worker Not Running

**Error**: `✗ Worker is not running at http://localhost:8787`

**Solution**: Make sure you started the worker with `npm run dev` in the first terminal.

### Database Not Initialized

**Symptom**: Tests pass but endpoints return 500 status codes

**Solution**: Initialize the database:

```bash
wrangler d1 execute recovery_analytics --file=./migrations/0001_initial_schema.sql --local
```

### Permission Denied

**Error**: `Permission denied: ./test-checkpoint-14.sh`

**Solution**: Make the script executable:

```bash
chmod +x test-checkpoint-14.sh
```

### Port Already in Use

**Error**: `Address already in use`

**Solution**: Stop any other processes using port 8787 or change the port in wrangler.toml

## Alternative Testing Methods

### Method 1: TypeScript Manual Test

```bash
# Terminal 1: Start worker
npm run dev

# Terminal 2: Run TypeScript test
npx tsx tests/manual-checkpoint-14.ts
```

### Method 2: Manual curl Commands

```bash
# Health check
curl http://localhost:8787/

# Test with API key
curl -H "X-API-Key: test-api-key-12345" \
  "http://localhost:8787/api/metrics/recovery-rate?date_range=30d"

# Test without API key (should fail)
curl "http://localhost:8787/api/metrics/recovery-rate?date_range=30d"

# Test invalid parameter (should return 400)
curl -H "X-API-Key: test-api-key-12345" \
  "http://localhost:8787/api/metrics/recovery-rate?date_range=invalid"
```

### Method 3: Using Postman or Insomnia

1. Import the following endpoints:
   - GET `http://localhost:8787/`
   - GET `http://localhost:8787/api/metrics/recovery-rate?date_range=30d`
   - GET `http://localhost:8787/api/metrics/dso?date_range=30d`
   - GET `http://localhost:8787/api/metrics/cohorts?start_month=2024-01&end_month=2024-03`

2. Add header to all API requests:
   - Key: `X-API-Key`
   - Value: `test-api-key-12345`

3. Test various scenarios:
   - Valid parameters (should return 200 or 500)
   - Invalid parameters (should return 400)
   - Missing API key (should return 401)
   - Invalid API key (should return 401)

## Test Categories

### ✅ Must Pass (Critical)
- Health check returns 200
- Authentication rejects invalid keys (401)
- Authentication accepts valid keys
- Invalid parameters return 400
- All endpoints are accessible

### ⚠️ May Fail (Database Dependent)
- Endpoints returning 500 (if DB not initialized)
- Empty result sets (if no data in DB)

### 📊 Performance Tests
- Caching reduces response time
- Pagination works with large datasets
- Rate limiting allows valid requests

## Next Steps After Testing

1. ✅ Review test results
2. ✅ Fix any failing tests
3. ✅ Initialize database if needed
4. ✅ Test with real data
5. ✅ Proceed to Task 15 (Chatwoot sidebar API)

## Questions?

If you encounter issues:

1. Check the worker logs in the first terminal
2. Verify all dependencies are installed (`npm install`)
3. Ensure wrangler.toml is configured correctly
4. Review CHECKPOINT_14_REPORT.md for detailed information

---

**Quick Reference**:
- Worker URL: `http://localhost:8787`
- Test API Key: `test-api-key-12345`
- Test Script: `./test-checkpoint-14.sh`
- Report: `CHECKPOINT_14_REPORT.md`
