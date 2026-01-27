import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

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

function randomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
