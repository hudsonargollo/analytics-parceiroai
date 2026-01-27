# Performance Testing Guide

This guide provides comprehensive performance testing procedures using k6 for the Subscription Recovery Analytics system.

## Prerequisites

- k6 installed (`brew install k6` on macOS or download from https://k6.io)
- Staging environment deployed and accessible
- API keys configured
- Test data seeded in database

## Performance Requirements

Based on Requirements 6.1:
- Dashboard loads within 2 seconds
- API p95 latency < 500ms
- API p99 latency < 1000ms
- System handles 1000+ concurrent webhook requests
- Cache hit rate > 80% for repeated queries

## Test Suite Overview

1. API Latency Testing
2. Webhook Load Testing
3. Dashboard Load Time Testing
4. Cache Performance Testing
5. Concurrent User Testing

## 1. API Latency Testing

### Test Script: api-latency-test.js

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1000ms
    'errors': ['rate<0.01'], // Error rate < 1%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'https://staging-worker.your-domain.workers.dev';
const API_KEY = __ENV.API_KEY || 'your-staging-api-key';

export default function () {
  const headers = {
    'X-API-Key': API_KEY,
  };

  // Test recovery rate endpoint
  let res = http.get(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d`, { headers });
  check(res, {
    'recovery rate status is 200': (r) => r.status === 200,
    'recovery rate has data': (r) => JSON.parse(r.body).total_attempts !== undefined,
  });
  errorRate.add(res.status !== 200);
  apiLatency.add(res.timings.duration);

  sleep(1);

  // Test DSO endpoint
  res = http.get(`${BASE_URL}/api/metrics/dso?date_range=30d`, { headers });
  check(res, {
    'dso status is 200': (r) => r.status === 200,
    'dso has data': (r) => JSON.parse(r.body).average_dso !== undefined,
  });
  errorRate.add(res.status !== 200);
  apiLatency.add(res.timings.duration);

  sleep(1);

  // Test cohort endpoint
  res = http.get(`${BASE_URL}/api/metrics/cohorts?start_month=2024-01&end_month=2024-03`, { headers });
  check(res, {
    'cohort status is 200': (r) => r.status === 200,
    'cohort has data': (r) => JSON.parse(r.body).cohorts !== undefined,
  });
  errorRate.add(res.status !== 200);
  apiLatency.add(res.timings.duration);

  sleep(1);
}
```

**Run Test:**
```bash
k6 run api-latency-test.js
```

**Expected Results:**
- p95 latency < 500ms
- p99 latency < 1000ms
- Error rate < 1%
- All checks pass

## 2. Webhook Load Testing

### Test Script: webhook-load-test.js

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const webhookErrors = new Rate('webhook_errors');
const webhooksProcessed = new Counter('webhooks_processed');

// Test configuration - simulate 1000 concurrent requests
export const options = {
  stages: [
    { duration: '10s', target: 100 },   // Ramp up to 100 users
    { duration: '30s', target: 500 },   // Ramp up to 500 users
    { duration: '30s', target: 1000 },  // Ramp up to 1000 users
    { duration: '1m', target: 1000 },   // Stay at 1000 users
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% < 1s for webhooks
    'webhook_errors': ['rate<0.05'], // Error rate < 5%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'https://staging-worker.your-domain.workers.dev';
const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || 'your-webhook-secret';

export default function () {
  const eventId = `load_test_${randomString(10)}`;
  const customerId = `cust_${randomString(8)}`;
  
  const payload = JSON.stringify({
    event_id: eventId,
    customer_id: customerId,
    invoice_id: `inv_${randomString(8)}`,
    amount: Math.floor(Math.random() * 50000) + 5000,
    payment_method: ['pix', 'boleto', 'credit_card'][Math.floor(Math.random() * 3)],
    status: ['pending', 'confirmed', 'failed'][Math.floor(Math.random() * 3)],
    due_date: '2024-02-15',
    timestamp: new Date().toISOString(),
  });

  // In production, calculate actual HMAC signature
  const signature = 'mock-signature-for-testing';

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
  };

  const res = http.post(`${BASE_URL}/webhooks/payment`, payload, { headers });
  
  check(res, {
    'webhook accepted': (r) => r.status === 202,
  });
  
  webhookErrors.add(res.status !== 202);
  webhooksProcessed.add(1);

  sleep(0.1); // Small delay between requests
}
```

**Run Test:**
```bash
k6 run webhook-load-test.js
```

**Expected Results:**
- System handles 1000+ concurrent requests
- p95 latency < 1s
- Error rate < 5%
- All webhooks return 202 Accepted

## 3. Dashboard Load Time Testing

### Test Script: dashboard-load-test.js

```javascript
import { browser } from 'k6/experimental/browser';
import { check } from 'k6';

export const options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
  thresholds: {
    'browser_web_vital_lcp': ['p(95)<2000'], // Largest Contentful Paint < 2s
    'browser_web_vital_fid': ['p(95)<100'],  // First Input Delay < 100ms
  },
};

const DASHBOARD_URL = __ENV.DASHBOARD_URL || 'https://subscription-recovery-staging.pages.dev';

export default async function () {
  const page = browser.newPage();

  try {
    // Navigate to dashboard
    const startTime = Date.now();
    await page.goto(DASHBOARD_URL);
    
    // Wait for main content to load
    await page.waitForSelector('h1:has-text("Subscription Recovery Analytics")');
    await page.waitForSelector('text=Days Sales Outstanding');
    
    const loadTime = Date.now() - startTime;

    check(loadTime, {
      'dashboard loads within 2 seconds': (t) => t < 2000,
    });

    // Check all components rendered
    const dsoVisible = await page.isVisible('text=Days Sales Outstanding');
    const recoveryVisible = await page.isVisible('text=Recovery Rate');
    const cohortVisible = await page.isVisible('text=Cohort Analysis');

    check({ dsoVisible, recoveryVisible, cohortVisible }, {
      'DSO component visible': (c) => c.dsoVisible,
      'Recovery component visible': (c) => c.recoveryVisible,
      'Cohort component visible': (c) => c.cohortVisible,
    });

    console.log(`Dashboard loaded in ${loadTime}ms`);
  } finally {
    page.close();
  }
}
```

**Run Test:**
```bash
k6 run dashboard-load-test.js
```

**Expected Results:**
- Dashboard loads within 2 seconds
- All components render successfully
- LCP < 2s
- FID < 100ms

## 4. Cache Performance Testing

### Test Script: cache-performance-test.js

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const cacheHitLatency = new Trend('cache_hit_latency');
const cacheMissLatency = new Trend('cache_miss_latency');

export const options = {
  iterations: 100,
  thresholds: {
    'cache_hit_latency': ['avg<50'], // Cache hits should be < 50ms
    'cache_miss_latency': ['avg<500'], // Cache misses should be < 500ms
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'https://staging-worker.your-domain.workers.dev';
const API_KEY = __ENV.API_KEY || 'your-staging-api-key';

export default function () {
  const headers = {
    'X-API-Key': API_KEY,
  };

  // First request (cache miss)
  let res = http.get(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d`, { headers });
  check(res, {
    'first request successful': (r) => r.status === 200,
  });
  cacheMissLatency.add(res.timings.duration);

  sleep(0.5);

  // Second request (should be cache hit)
  res = http.get(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d`, { headers });
  check(res, {
    'second request successful': (r) => r.status === 200,
  });
  cacheHitLatency.add(res.timings.duration);

  // Calculate cache hit rate
  const cacheHit = res.timings.duration < 100; // Assume cache hit if < 100ms
  check(cacheHit, {
    'cache hit detected': (hit) => hit,
  });

  sleep(1);
}
```

**Run Test:**
```bash
k6 run cache-performance-test.js
```

**Expected Results:**
- Cache hit latency < 50ms
- Cache miss latency < 500ms
- Cache hit rate > 80%

## 5. Concurrent User Testing

### Test Script: concurrent-users-test.js

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '3m', target: 200 },  // Stay at 200 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'errors': ['rate<0.02'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'https://staging-worker.your-domain.workers.dev';
const API_KEY = __ENV.API_KEY || 'your-staging-api-key';

export default function () {
  const headers = {
    'X-API-Key': API_KEY,
  };

  // Simulate realistic user behavior
  const endpoints = [
    '/api/metrics/recovery-rate?date_range=30d',
    '/api/metrics/dso?date_range=30d',
    '/api/metrics/cohorts?start_month=2024-01&end_month=2024-03',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, { headers });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 1000,
  });

  errorRate.add(res.status !== 200);

  sleep(Math.random() * 3 + 2); // Random sleep 2-5 seconds
}
```

**Run Test:**
```bash
k6 run concurrent-users-test.js
```

**Expected Results:**
- System handles 200 concurrent users
- p95 latency < 1s
- Error rate < 2%

## Running All Tests

Create a script to run all performance tests:

```bash
#!/bin/bash

echo "Starting Performance Test Suite..."

echo "\n1. API Latency Testing..."
k6 run api-latency-test.js

echo "\n2. Webhook Load Testing..."
k6 run webhook-load-test.js

echo "\n3. Dashboard Load Time Testing..."
k6 run dashboard-load-test.js

echo "\n4. Cache Performance Testing..."
k6 run cache-performance-test.js

echo "\n5. Concurrent User Testing..."
k6 run concurrent-users-test.js

echo "\nPerformance Test Suite Complete!"
```

## Performance Test Results Checklist

- [ ] API p95 latency < 500ms
- [ ] API p99 latency < 1000ms
- [ ] System handles 1000+ concurrent webhooks
- [ ] Webhook error rate < 5%
- [ ] Dashboard loads within 2 seconds
- [ ] All dashboard components render
- [ ] Cache hit latency < 50ms
- [ ] Cache miss latency < 500ms
- [ ] Cache hit rate > 80%
- [ ] System handles 200 concurrent users
- [ ] Concurrent user error rate < 2%

## Analyzing Results

k6 provides detailed output including:
- Request duration percentiles (p50, p90, p95, p99)
- Request rate (requests/second)
- Error rate
- Custom metrics

Example output:
```
     ✓ status is 200
     ✓ response time OK

     checks.........................: 100.00% ✓ 2000      ✗ 0
     data_received..................: 1.2 MB  20 kB/s
     data_sent......................: 180 kB  3.0 kB/s
     http_req_duration..............: avg=245ms min=120ms med=230ms max=890ms p(90)=350ms p(95)=420ms
     http_req_rate..................: 33.33/s
     iterations.....................: 1000    16.67/s
```

## Troubleshooting Performance Issues

### High Latency
- Check D1 query performance
- Review database indexes
- Optimize SQL queries
- Increase cache TTL

### High Error Rate
- Check Worker logs for errors
- Review rate limiting configuration
- Verify database connection limits
- Check for timeout issues

### Low Cache Hit Rate
- Verify cache key generation
- Check cache TTL settings
- Review cache invalidation logic
- Monitor KV storage limits

## Next Steps

After performance testing:
- Document results
- Address any performance issues
- Optimize slow queries
- Proceed to production readiness review (Task 22.4)
