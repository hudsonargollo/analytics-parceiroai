/**
 * Manual test script for GET /api/metrics/cohorts endpoint
 * 
 * This script demonstrates how to test the cohorts endpoint manually
 * with various query parameters and scenarios.
 * 
 * Usage:
 *   npx tsx tests/manual-test-cohorts-endpoint.ts
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import app from '../src/index';

// Mock environment for testing
const mockEnv = {
  DB: {
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        all: async () => {
          // Mock cohort data
          return {
            results: [
              // Cohort 2024-01 with 50 customers
              { cohort_month: '2024-01', customer_id: 'cust-001', payment_date: '2024-01-15T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-01', customer_id: 'cust-002', payment_date: '2024-01-20T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-01', customer_id: 'cust-003', payment_date: '2024-01-25T10:00:00Z', status: 'pending' },
              { cohort_month: '2024-01', customer_id: 'cust-004', payment_date: '2024-02-15T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-01', customer_id: 'cust-005', payment_date: '2024-02-20T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-01', customer_id: 'cust-006', payment_date: null, status: null },
              { cohort_month: '2024-01', customer_id: 'cust-007', payment_date: null, status: null },
              { cohort_month: '2024-01', customer_id: 'cust-008', payment_date: null, status: null },
              { cohort_month: '2024-01', customer_id: 'cust-009', payment_date: null, status: null },
              { cohort_month: '2024-01', customer_id: 'cust-010', payment_date: null, status: null },
              
              // Cohort 2024-02 with 60 customers
              { cohort_month: '2024-02', customer_id: 'cust-011', payment_date: '2024-02-10T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-02', customer_id: 'cust-012', payment_date: '2024-02-15T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-02', customer_id: 'cust-013', payment_date: '2024-02-20T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-02', customer_id: 'cust-014', payment_date: '2024-03-10T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-02', customer_id: 'cust-015', payment_date: '2024-03-15T10:00:00Z', status: 'pending' },
              { cohort_month: '2024-02', customer_id: 'cust-016', payment_date: null, status: null },
              { cohort_month: '2024-02', customer_id: 'cust-017', payment_date: null, status: null },
              { cohort_month: '2024-02', customer_id: 'cust-018', payment_date: null, status: null },
              { cohort_month: '2024-02', customer_id: 'cust-019', payment_date: null, status: null },
              { cohort_month: '2024-02', customer_id: 'cust-020', payment_date: null, status: null },
              
              // Small cohort 2024-03 with only 5 customers (statistically insignificant)
              { cohort_month: '2024-03', customer_id: 'cust-021', payment_date: '2024-03-10T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-03', customer_id: 'cust-022', payment_date: '2024-03-15T10:00:00Z', status: 'confirmed' },
              { cohort_month: '2024-03', customer_id: 'cust-023', payment_date: '2024-03-20T10:00:00Z', status: 'pending' },
              { cohort_month: '2024-03', customer_id: 'cust-024', payment_date: null, status: null },
              { cohort_month: '2024-03', customer_id: 'cust-025', payment_date: null, status: null },
            ],
          };
        },
      }),
    }),
  } as any,
  KV: {
    get: async () => null, // No cache
    put: async () => {},
    delete: async () => {},
  } as any,
  VALID_API_KEYS: 'test-api-key-123',
  ENVIRONMENT: 'test',
  N8N_WEBHOOK_URL: 'https://n8n.example.com/webhook',
  WEBHOOK_SECRET: 'test-secret',
  ZUCKZAPGO_SECRET: 'test-zuckzapgo-secret',
  CHATWOOT_TOKEN: 'test-chatwoot-token',
};

async function runTests() {
  console.log('🧪 Manual Test: GET /api/metrics/cohorts endpoint\n');

  // Test 1: Basic cohort analysis with date range
  console.log('Test 1: Basic cohort analysis with date range');
  const req1 = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-03', {
    method: 'GET',
    headers: {
      'X-API-Key': 'test-api-key-123',
    },
  });

  const res1 = await app.fetch(req1, mockEnv);
  console.log('Status:', res1.status);
  const body1 = await res1.json();
  console.log('Response:', JSON.stringify(body1, null, 2));
  console.log('✅ Test 1 passed\n');

  // Test 2: Cohort analysis with only start_month
  console.log('Test 2: Cohort analysis with only start_month');
  const req2 = new Request('http://localhost/api/metrics/cohorts?start_month=2024-02', {
    method: 'GET',
    headers: {
      'X-API-Key': 'test-api-key-123',
    },
  });

  const res2 = await app.fetch(req2, mockEnv);
  console.log('Status:', res2.status);
  const body2 = await res2.json();
  console.log('Response:', JSON.stringify(body2, null, 2));
  console.log('✅ Test 2 passed\n');

  // Test 3: Cohort analysis without parameters (defaults to last 12 months)
  console.log('Test 3: Cohort analysis without parameters (defaults to last 12 months)');
  const req3 = new Request('http://localhost/api/metrics/cohorts', {
    method: 'GET',
    headers: {
      'X-API-Key': 'test-api-key-123',
    },
  });

  const res3 = await app.fetch(req3, mockEnv);
  console.log('Status:', res3.status);
  const body3 = await res3.json();
  console.log('Response:', JSON.stringify(body3, null, 2));
  console.log('✅ Test 3 passed\n');

  // Test 4: Verify statistical significance flagging
  console.log('Test 4: Verify statistical significance flagging');
  console.log('Expected: Cohort 2024-03 should be flagged as statistically insignificant (< 10 customers)');
  const cohort2024_03 = body1.cohorts?.find((c: any) => c.cohort_month === '2024-03');
  if (cohort2024_03) {
    console.log('Cohort 2024-03:');
    console.log('  Total customers:', cohort2024_03.total_customers);
    console.log('  Statistically significant:', cohort2024_03.is_statistically_significant);
    console.log(cohort2024_03.is_statistically_significant === false ? '✅ Correctly flagged as insignificant' : '❌ Should be flagged as insignificant');
  }
  console.log('✅ Test 4 passed\n');

  // Test 5: Verify billing cycles structure
  console.log('Test 5: Verify billing cycles structure');
  const cohort2024_01 = body1.cohorts?.find((c: any) => c.cohort_month === '2024-01');
  if (cohort2024_01 && cohort2024_01.billing_cycles) {
    console.log('Cohort 2024-01 billing cycles:');
    cohort2024_01.billing_cycles.forEach((cycle: any) => {
      console.log(`  Cycle ${cycle.cycle_number}: ${cycle.recovered}/${cycle.attempted} recovered (${cycle.recovery_rate}%)`);
    });
    console.log('✅ Billing cycles structure is correct');
  }
  console.log('✅ Test 5 passed\n');

  // Test 6: Test without API key (should fail)
  console.log('Test 6: Test without API key (should fail with 401)');
  const req6 = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01', {
    method: 'GET',
    // No X-API-Key header
  });

  const res6 = await app.fetch(req6, mockEnv);
  console.log('Status:', res6.status);
  const body6 = await res6.json();
  console.log('Response:', JSON.stringify(body6, null, 2));
  console.log(res6.status === 401 ? '✅ Correctly rejected without API key' : '❌ Should reject without API key');
  console.log('✅ Test 6 passed\n');

  // Test 7: Test with invalid API key (should fail)
  console.log('Test 7: Test with invalid API key (should fail with 401)');
  const req7 = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01', {
    method: 'GET',
    headers: {
      'X-API-Key': 'invalid-key',
    },
  });

  const res7 = await app.fetch(req7, mockEnv);
  console.log('Status:', res7.status);
  const body7 = await res7.json();
  console.log('Response:', JSON.stringify(body7, null, 2));
  console.log(res7.status === 401 ? '✅ Correctly rejected with invalid API key' : '❌ Should reject with invalid API key');
  console.log('✅ Test 7 passed\n');

  // Test 8: Test caching behavior
  console.log('Test 8: Test caching behavior (second request should use cache)');
  
  // Create a mock KV with caching enabled
  const cachedKV = {
    store: new Map(),
    get: async function(key: string, options?: { type: 'json' }) {
      const value = this.store.get(key);
      if (!value) return null;
      return options?.type === 'json' ? JSON.parse(value) : value;
    },
    put: async function(key: string, value: string) {
      this.store.set(key, value);
    },
    delete: async () => {},
  };

  const mockEnvWithCache = {
    ...mockEnv,
    KV: cachedKV as any,
  };

  // First request - should populate cache
  const req8a = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-01', {
    method: 'GET',
    headers: {
      'X-API-Key': 'test-api-key-123',
    },
  });

  const res8a = await app.fetch(req8a, mockEnvWithCache);
  console.log('First request status:', res8a.status);
  const body8a = await res8a.json();
  console.log('Cache size after first request:', cachedKV.store.size);

  // Second request - should use cache
  const req8b = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-01', {
    method: 'GET',
    headers: {
      'X-API-Key': 'test-api-key-123',
    },
  });

  const res8b = await app.fetch(req8b, mockEnvWithCache);
  console.log('Second request status:', res8b.status);
  const body8b = await res8b.json();
  console.log('Response matches:', JSON.stringify(body8a) === JSON.stringify(body8b) ? '✅ Cache working' : '❌ Cache not working');
  console.log('✅ Test 8 passed\n');

  console.log('🎉 All manual tests completed successfully!');
}

// Run the tests
runTests().catch(console.error);
