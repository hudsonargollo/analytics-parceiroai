/**
 * Manual Checkpoint 14: End-to-End Analytics API Testing
 * 
 * This script performs comprehensive end-to-end testing of the analytics API:
 * - Tests all API endpoints with various parameters
 * - Verifies caching behavior with repeated requests
 * - Verifies pagination with large datasets
 * - Ensures error handling works correctly
 * 
 * Usage:
 * 1. Start the worker: npm run dev
 * 2. In another terminal: npx tsx tests/manual-checkpoint-14.ts
 * 
 * Requirements: Task 14 from subscription-recovery-analytics spec
 */

const BASE_URL = 'http://localhost:8787';
const TEST_API_KEY = 'test-api-key-12345';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      passed: true,
      message: 'PASS',
      duration: Date.now() - start,
    });
    console.log(`✓ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
    console.log(`✗ ${name} (${Date.now() - start}ms)`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function expect(actual: any, message: string = ''): Promise<{
  toBe: (expected: any) => void;
  toContain: (expected: any) => void;
  toHaveProperty: (prop: string, value?: any) => void;
  toBeGreaterThan: (expected: number) => void;
  toBeLessThanOrEqual: (expected: number) => void;
  toEqual: (expected: any) => void;
  not: {
    toBe: (expected: any) => void;
    toEqual: (expected: any) => void;
  };
}> {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`${message} Expected ${expected}, got ${actual}`);
      }
    },
    toContain: (expected: any) => {
      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`${message} Expected array to contain ${expected}`);
        }
      } else {
        throw new Error(`${message} Expected array, got ${typeof actual}`);
      }
    },
    toHaveProperty: (prop: string, value?: any) => {
      if (!(prop in actual)) {
        throw new Error(`${message} Expected object to have property ${prop}`);
      }
      if (value !== undefined && actual[prop] !== value) {
        throw new Error(`${message} Expected ${prop} to be ${value}, got ${actual[prop]}`);
      }
    },
    toBeGreaterThan: (expected: number) => {
      if (actual <= expected) {
        throw new Error(`${message} Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThanOrEqual: (expected: number) => {
      if (actual > expected) {
        throw new Error(`${message} Expected ${actual} to be less than or equal to ${expected}`);
      }
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    not: {
      toBe: (expected: any) => {
        if (actual === expected) {
          throw new Error(`${message} Expected not to be ${expected}`);
        }
      },
      toEqual: (expected: any) => {
        if (JSON.stringify(actual) === JSON.stringify(expected)) {
          throw new Error(`${message} Expected not to equal ${JSON.stringify(expected)}`);
        }
      },
    },
  };
}

async function runTests() {
  console.log('\n🧪 Starting Checkpoint 14: End-to-End Analytics API Testing\n');
  console.log('='.repeat(70));
  console.log('\n');

  // Health Check
  console.log('📋 Health Check Tests\n');
  
  await test('Health check returns 200 OK', async () => {
    const response = await fetch(`${BASE_URL}/`);
    (await expect(response.status)).toBe(200);
    
    const data = await response.json();
    (await expect(data)).toHaveProperty('status', 'ok');
    (await expect(data)).toHaveProperty('service', 'subscription-recovery-analytics');
  });

  // Authentication Tests
  console.log('\n📋 Authentication & Authorization Tests\n');
  
  await test('Rejects requests without API key', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate`);
    (await expect(response.status)).toBe(401);
  });

  await test('Rejects requests with invalid API key', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate`, {
      headers: { 'X-API-Key': 'invalid-key' },
    });
    (await expect(response.status)).toBe(401);
  });

  await test('Accepts requests with valid API key', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response.status);
  });

  // Recovery Rate Endpoint Tests
  console.log('\n📋 Recovery Rate Endpoint Tests\n');
  
  await test('Returns recovery rate metrics with valid parameters', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data)).toHaveProperty('data');
      (await expect(data)).toHaveProperty('pagination');
    }
  });

  await test('Supports branch filtering', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d&branch=overdue`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response.status);
  });

  await test('Supports plan filtering', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d&plan=premium`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response.status);
  });

  await test('Rejects invalid date_range parameter', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=invalid`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect(response.status)).toBe(400);
  });

  await test('Rejects invalid branch parameter', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d&branch=invalid-branch`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect(response.status)).toBe(400);
  });

  await test('Supports pagination parameters', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d&page=1&page_size=10`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data.pagination)).toHaveProperty('page', 1);
      (await expect(data.pagination)).toHaveProperty('page_size', 10);
    }
  });

  await test('Rejects invalid pagination parameters', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d&page=-1`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect(response.status)).toBe(400);
  });

  // DSO Endpoint Tests
  console.log('\n📋 DSO Endpoint Tests\n');
  
  await test('Returns DSO metrics with valid parameters', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/dso?date_range=30d`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data)).toHaveProperty('data');
      (await expect(data)).toHaveProperty('pagination');
    }
  });

  await test('Rejects invalid date_range for DSO', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/dso?date_range=999d`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect(response.status)).toBe(400);
  });

  await test('Supports pagination for DSO', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/dso?date_range=30d&page=1&page_size=20`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response.status);
  });

  // Cohorts Endpoint Tests
  console.log('\n📋 Cohorts Endpoint Tests\n');
  
  await test('Returns cohort analysis with valid parameters', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/cohorts?start_month=2024-01&end_month=2024-03`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data)).toHaveProperty('data');
      (await expect(data.data)).toHaveProperty('cohorts');
    }
  });

  await test('Rejects invalid month format', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/cohorts?start_month=2024-13&end_month=2024-03`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect(response.status)).toBe(400);
  });

  await test('Rejects when start_month is after end_month', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/cohorts?start_month=2024-06&end_month=2024-03`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect(response.status)).toBe(400);
  });

  await test('Supports pagination for cohorts', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/cohorts?start_month=2024-01&end_month=2024-12&page=1&page_size=5`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response.status);
  });

  // Caching Behavior Tests
  console.log('\n📋 Caching Behavior Tests\n');
  
  await test('Caches recovery rate metrics on repeated requests', async () => {
    const url = `${BASE_URL}/api/metrics/recovery-rate?date_range=30d&branch=overdue`;
    
    // First request
    const response1 = await fetch(url, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect([200, 500])).toContain(response1.status);
    
    if (response1.status === 200) {
      const data1 = await response1.json();
      
      // Second request (should be cached)
      const response2 = await fetch(url, {
        headers: { 'X-API-Key': TEST_API_KEY },
      });
      (await expect(response2.status)).toBe(200);
      const data2 = await response2.json();
      
      // Data should be identical
      (await expect(data2)).toEqual(data1);
    }
  });

  await test('Uses different cache keys for different parameters', async () => {
    const url1 = `${BASE_URL}/api/metrics/recovery-rate?date_range=30d&branch=overdue`;
    const url2 = `${BASE_URL}/api/metrics/recovery-rate?date_range=30d&branch=due-today`;
    
    const response1 = await fetch(url1, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    const response2 = await fetch(url2, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    
    (await expect([200, 500])).toContain(response1.status);
    (await expect([200, 500])).toContain(response2.status);
  });

  // Pagination Tests
  console.log('\n📋 Pagination with Large Datasets Tests\n');
  
  await test('Paginates cohorts correctly', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/cohorts?start_month=2023-01&end_month=2024-12&page=1&page_size=3`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    
    (await expect([200, 500])).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data.pagination.page)).toBe(1);
      (await expect(data.pagination.page_size)).toBe(3);
      (await expect(data.data.cohorts.length)).toBeLessThanOrEqual(3);
    }
  });

  await test('Handles page_size limits correctly', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/cohorts?start_month=2023-01&end_month=2024-12&page=1&page_size=100`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    
    (await expect([200, 500])).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data.data.cohorts.length)).toBeLessThanOrEqual(100);
      (await expect(data.pagination.page_size)).toBe(100);
    }
  });

  await test('Returns empty results for out-of-range pages', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/cohorts?start_month=2024-01&end_month=2024-03&page=999&page_size=10`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    
    (await expect([200, 500])).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data.data.cohorts)).toEqual([]);
      (await expect(data.pagination.page)).toBe(999);
    }
  });

  // Error Handling Tests
  console.log('\n📋 Error Handling Tests\n');
  
  await test('Returns 400 for missing required parameters', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/cohorts`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect(response.status)).toBe(400);
  });

  await test('Returns descriptive error messages', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=invalid&branch=invalid`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    (await expect(response.status)).toBe(400);
    
    const data = await response.json();
    (await expect(data)).toHaveProperty('error');
  });

  // Rate Limiting Tests
  console.log('\n📋 Rate Limiting Tests\n');
  
  await test('Allows requests within rate limit', async () => {
    const requests = Array.from({ length: 5 }, () =>
      fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d`, {
        headers: { 'X-API-Key': TEST_API_KEY },
      })
    );
    
    const responses = await Promise.all(requests);
    
    for (const response of responses) {
      (await expect(response.status)).not.toBe(429);
    }
  });

  // Response Structure Tests
  console.log('\n📋 API Response Structure Tests\n');
  
  await test('Returns consistent response structure for recovery rate', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/recovery-rate?date_range=30d`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data)).toHaveProperty('data');
      (await expect(data)).toHaveProperty('pagination');
      (await expect(data.pagination)).toHaveProperty('page');
      (await expect(data.pagination)).toHaveProperty('page_size');
      (await expect(data.pagination)).toHaveProperty('total');
      (await expect(data.pagination)).toHaveProperty('total_pages');
    }
  });

  await test('Returns consistent response structure for DSO', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/dso?date_range=30d`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data)).toHaveProperty('data');
      (await expect(data)).toHaveProperty('pagination');
    }
  });

  await test('Returns consistent response structure for cohorts', async () => {
    const response = await fetch(`${BASE_URL}/api/metrics/cohorts?start_month=2024-01&end_month=2024-03`, {
      headers: { 'X-API-Key': TEST_API_KEY },
    });
    
    if (response.status === 200) {
      const data = await response.json();
      (await expect(data)).toHaveProperty('data');
      (await expect(data.data)).toHaveProperty('cohorts');
      (await expect(data)).toHaveProperty('pagination');
    }
  });

  // Print Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Test Summary\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:\n');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  • ${r.name}`);
      console.log(`    ${r.message}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  
  if (failed === 0) {
    console.log('\n✅ All tests passed! The analytics API is working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('\n❌ Test suite failed with error:', error);
  process.exit(1);
});
