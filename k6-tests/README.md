# k6 Performance Tests

This directory contains k6 performance test scripts for the Subscription Recovery Analytics system.

## Prerequisites

Install k6:
- macOS: `brew install k6`
- Linux: See https://k6.io/docs/getting-started/installation/
- Windows: `choco install k6`

## Available Tests

### 1. API Latency Test
Tests API endpoint response times and validates performance thresholds.

```bash
k6 run api-latency-test.js
```

**Environment Variables:**
- `API_BASE_URL`: Base URL of the API (default: staging)
- `API_KEY`: Valid API key for authentication

**Example:**
```bash
API_BASE_URL=https://your-worker.workers.dev API_KEY=your-key k6 run api-latency-test.js
```

**Thresholds:**
- p95 latency < 500ms
- p99 latency < 1000ms
- Error rate < 1%

### 2. Webhook Load Test
Simulates high-volume webhook traffic to test system capacity.

```bash
k6 run webhook-load-test.js
```

**Environment Variables:**
- `API_BASE_URL`: Base URL of the API

**Example:**
```bash
API_BASE_URL=https://your-worker.workers.dev k6 run webhook-load-test.js
```

**Thresholds:**
- p95 latency < 1000ms
- Error rate < 5%
- Handles 1000+ concurrent requests

## Running All Tests

```bash
#!/bin/bash
echo "Running API Latency Test..."
k6 run api-latency-test.js

echo "Running Webhook Load Test..."
k6 run webhook-load-test.js
```

## Interpreting Results

k6 provides detailed metrics including:

```
✓ recovery rate status is 200
✓ dso status is 200

checks.........................: 100.00% ✓ 300       ✗ 0
data_received..................: 1.2 MB  20 kB/s
data_sent......................: 180 kB  3.0 kB/s
http_req_duration..............: avg=245ms min=120ms med=230ms max=890ms p(90)=350ms p(95)=420ms
http_req_rate..................: 33.33/s
iterations.....................: 100     1.67/s
```

Key metrics:
- **checks**: Percentage of successful assertions
- **http_req_duration**: Request duration statistics
- **p(95)**: 95th percentile latency
- **p(99)**: 99th percentile latency
- **http_req_rate**: Requests per second

## Troubleshooting

### High Latency
- Check database query performance
- Review cache hit rates
- Verify network connectivity
- Check Worker CPU usage

### High Error Rate
- Review Worker logs: `wrangler tail`
- Check authentication configuration
- Verify rate limiting settings
- Check database connection limits

### Failed Thresholds
- Optimize slow queries
- Increase cache TTL
- Add database indexes
- Scale Worker resources

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [Performance Testing Guide](../PERFORMANCE_TESTING_GUIDE.md)
- [Cloudflare Workers Performance](https://developers.cloudflare.com/workers/platform/limits/)
