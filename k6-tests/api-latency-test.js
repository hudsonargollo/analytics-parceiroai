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
