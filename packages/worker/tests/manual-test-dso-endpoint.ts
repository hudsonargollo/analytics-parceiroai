/**
 * Manual test script for GET /api/metrics/dso endpoint
 * 
 * This script tests the DSO endpoint with various scenarios:
 * - Valid API key with date_range parameter
 * - Cache hit on second request
 * - Cache bypass for current day queries
 * - Invalid API key rejection
 * - Missing API key rejection
 * 
 * Run with: npx tsx tests/manual-test-dso-endpoint.ts
 */

import { Hono } from 'hono';
import { authenticateApiKey } from '../src/lib/api-key-auth';
import { rateLimiter } from '../src/lib/rate-limiter';
import { calculateDSO } from '../src/lib/dso';
import { getCachedMetrics, setCachedMetrics, generateCacheKey } from '../src/lib/cache';
import { DSOResponse } from '../src/types';

// Mock environment type
interface TestEnv {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  N8N_WEBHOOK_URL: string;
  WEBHOOK_SECRET: string;
  ZUCKZAPGO_SECRET: string;
  VALID_API_KEYS: string;
  CHATWOOT_TOKEN: string;
}

// Mock KV namespace
class MockKVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map();

  async get(key: string, options?: { type: 'json' }): Promise<any> {
    const item = this.store.get(key);
    if (!item) {
      console.log(`  [KV] Cache miss for key: ${key}`);
      return null;
    }
    
    // Check expiration
    if (item.expiration && Date.now() > item.expiration) {
      this.store.delete(key);
      console.log(`  [KV] Cache expired for key: ${key}`);
      return null;
    }
    
    console.log(`  [KV] Cache hit for key: ${key}`);
    if (options?.type === 'json') {
      return JSON.parse(item.value);
    }
    return item.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiration = options?.expirationTtl 
      ? Date.now() + (options.expirationTtl * 1000)
      : undefined;
    
    this.store.set(key, { value, expiration });
    console.log(`  [KV] Cached data with key: ${key} (TTL: ${options?.expirationTtl || 'none'}s)`);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Mock D1 Database with sample data
class MockD1Database {
  private callCount = 0;

  prepare(query: string) {
    return {
      bind: (...args: any[]) => ({
        all: async () => {
          this.callCount++;
          console.log(`  [DB] Query executed (call #${this.callCount})`);
          
          // Return sample DSO data
          return {
            results: [
              { recovery_branch: '3-day-notice', dso_days: 2.5 },
              { recovery_branch: '3-day-notice', dso_days: 3.0 },
              { recovery_branch: '3-day-notice', dso_days: 3.5 },
              { recovery_branch: 'due-today', dso_days: 4.0 },
              { recovery_branch: 'due-today', dso_days: 5.0 },
              { recovery_branch: 'due-today', dso_days: 6.0 },
              { recovery_branch: 'overdue', dso_days: 7.0 },
              { recovery_branch: 'overdue', dso_days: 9.0 },
              { recovery_branch: 'overdue', dso_days: 10.0 },
            ],
          };
        },
      }),
    };
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }
}

// Create test app
function createTestApp(mockKV: MockKVNamespace, mockDB: MockD1Database) {
  const app = new Hono<{ Bindings: TestEnv }>();

  // Add the DSO endpoint
  app.get('/api/metrics/dso', authenticateApiKey, rateLimiter(100), async (c) => {
    try {
      // Parse query parameters
      const date_range = c.req.query('date_range');

      // Generate cache key from query parameters
      const cacheKey = generateCacheKey('dso', {
        date_range,
      });

      // Check KV cache first
      const cached = await getCachedMetrics<DSOResponse>(
        c.env.KV,
        cacheKey,
        { date_range }
      );

      if (cached) {
        // Return cached data
        return c.json(cached);
      }

      // Cache miss - calculate DSO from database
      const data = await calculateDSO(c.env.DB, {
        date_range,
      });

      // Store result in KV with 5-minute TTL
      await setCachedMetrics(c.env.KV, cacheKey, data, 300);

      // Return JSON response
      return c.json(data);
    } catch (error) {
      // Log error and return 500
      console.error('DSO calculation failed', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return c.json({
        error: 'Internal Server Error',
        message: 'Failed to calculate DSO'
      }, 500);
    }
  });

  return app;
}

// Test runner
async function runTests() {
  console.log('🧪 Manual Test: GET /api/metrics/dso endpoint\n');
  console.log('=' .repeat(60));

  const mockKV = new MockKVNamespace();
  const mockDB = new MockD1Database();
  const app = createTestApp(mockKV, mockDB);

  const env: TestEnv = {
    DB: mockDB as any,
    KV: mockKV as any,
    VALID_API_KEYS: 'test-api-key-123',
    ENVIRONMENT: 'test',
  } as TestEnv;

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Valid request with API key
  console.log('\n📝 Test 1: Valid request with API key and date_range parameter');
  try {
    const req = new Request('http://localhost/api/metrics/dso?date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);
    const body = await res.json();

    if (res.status === 200 && body.average_dso && body.median_dso && body.by_branch) {
      console.log('  ✅ PASS: Received valid DSO response');
      console.log(`  📊 Average DSO: ${body.average_dso} days`);
      console.log(`  📊 Median DSO: ${body.median_dso} days`);
      console.log(`  📊 By Branch:`, body.by_branch);
      testsPassed++;
    } else {
      console.log('  ❌ FAIL: Invalid response structure');
      console.log('  Response:', body);
      testsFailed++;
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error);
    testsFailed++;
  }

  // Test 2: Cache hit on second request
  console.log('\n📝 Test 2: Cache hit on second request');
  try {
    mockDB.resetCallCount();
    
    // First request
    const req1 = new Request('http://localhost/api/metrics/dso?date_range=60d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });
    await app.fetch(req1, env);
    const firstCallCount = mockDB.getCallCount();

    // Second request (should use cache)
    const req2 = new Request('http://localhost/api/metrics/dso?date_range=60d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });
    const res2 = await app.fetch(req2, env);
    const secondCallCount = mockDB.getCallCount();

    if (res2.status === 200 && secondCallCount === firstCallCount) {
      console.log('  ✅ PASS: Second request used cache (no additional DB query)');
      testsPassed++;
    } else {
      console.log('  ❌ FAIL: Cache not used on second request');
      console.log(`  DB calls: first=${firstCallCount}, second=${secondCallCount}`);
      testsFailed++;
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error);
    testsFailed++;
  }

  // Test 3: Cache bypass for current day queries
  console.log('\n📝 Test 3: Cache bypass for current day queries');
  try {
    mockDB.resetCallCount();
    
    // First request with "today"
    const req1 = new Request('http://localhost/api/metrics/dso?date_range=today', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });
    await app.fetch(req1, env);
    const firstCallCount = mockDB.getCallCount();

    // Second request (should NOT use cache)
    const req2 = new Request('http://localhost/api/metrics/dso?date_range=today', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });
    const res2 = await app.fetch(req2, env);
    const secondCallCount = mockDB.getCallCount();

    if (res2.status === 200 && secondCallCount > firstCallCount) {
      console.log('  ✅ PASS: Cache bypassed for "today" queries');
      testsPassed++;
    } else {
      console.log('  ❌ FAIL: Cache should be bypassed for current day');
      console.log(`  DB calls: first=${firstCallCount}, second=${secondCallCount}`);
      testsFailed++;
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error);
    testsFailed++;
  }

  // Test 4: Reject request without API key
  console.log('\n📝 Test 4: Reject request without API key');
  try {
    const req = new Request('http://localhost/api/metrics/dso?date_range=30d', {
      method: 'GET',
      // No X-API-Key header
    });

    const res = await app.fetch(req, env);
    const body = await res.json();

    if (res.status === 401 && body.error === 'Unauthorized') {
      console.log('  ✅ PASS: Request rejected with 401 Unauthorized');
      testsPassed++;
    } else {
      console.log('  ❌ FAIL: Should reject with 401');
      console.log('  Response:', res.status, body);
      testsFailed++;
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error);
    testsFailed++;
  }

  // Test 5: Reject request with invalid API key
  console.log('\n📝 Test 5: Reject request with invalid API key');
  try {
    const req = new Request('http://localhost/api/metrics/dso?date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'invalid-key',
      },
    });

    const res = await app.fetch(req, env);
    const body = await res.json();

    if (res.status === 401 && body.error === 'Unauthorized') {
      console.log('  ✅ PASS: Invalid API key rejected with 401');
      testsPassed++;
    } else {
      console.log('  ❌ FAIL: Should reject with 401');
      console.log('  Response:', res.status, body);
      testsFailed++;
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error);
    testsFailed++;
  }

  // Test 6: Request without date_range parameter (defaults)
  console.log('\n📝 Test 6: Request without date_range parameter (defaults)');
  try {
    const req = new Request('http://localhost/api/metrics/dso', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);
    const body = await res.json();

    if (res.status === 200 && body.date_range === '30d') {
      console.log('  ✅ PASS: Default date_range applied (30d)');
      testsPassed++;
    } else {
      console.log('  ❌ FAIL: Should use default date_range');
      console.log('  Response:', body);
      testsFailed++;
    }
  } catch (error) {
    console.log('  ❌ FAIL:', error);
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Summary:`);
  console.log(`  ✅ Passed: ${testsPassed}`);
  console.log(`  ❌ Failed: ${testsFailed}`);
  console.log(`  📈 Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
  }
}

// Run tests
runTests().catch(console.error);
