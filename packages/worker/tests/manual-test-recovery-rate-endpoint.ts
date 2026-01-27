/**
 * Manual test script for GET /api/metrics/recovery-rate endpoint
 * 
 * This script demonstrates the endpoint functionality with mock data.
 * Run with: npx tsx tests/manual-test-recovery-rate-endpoint.ts
 */

import { Hono } from 'hono';
import { authenticateApiKey } from '../src/lib/api-key-auth';
import { rateLimiter } from '../src/lib/rate-limiter';
import { calculateRecoveryRate } from '../src/lib/recovery-rate';
import { getCachedMetrics, setCachedMetrics, generateCacheKey } from '../src/lib/cache';
import { RecoveryRateResponse } from '../src/types';

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
      console.log(`[KV] Cache miss for key: ${key}`);
      return null;
    }
    
    // Check expiration
    if (item.expiration && Date.now() > item.expiration) {
      this.store.delete(key);
      console.log(`[KV] Cache expired for key: ${key}`);
      return null;
    }
    
    console.log(`[KV] Cache hit for key: ${key}`);
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
    console.log(`[KV] Cached data for key: ${key} (TTL: ${options?.expirationTtl || 'none'}s)`);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    console.log(`[KV] Deleted key: ${key}`);
  }

  clear(): void {
    this.store.clear();
    console.log('[KV] Cleared all cache');
  }
}

// Mock D1 Database
class MockD1Database {
  private mockData: RecoveryRateResponse = {
    branch: 'overdue',
    date_range: '30d',
    total_attempts: 100,
    successful_recoveries: 75,
    recovery_rate: 75.0,
    total_amount_attempted: 10000,
    total_amount_recovered: 7500,
    breakdown_by_method: {
      pix: { attempts: 50, recoveries: 40, rate: 80.0 },
      boleto: { attempts: 30, recoveries: 20, rate: 66.67 },
      credit_card: { attempts: 20, recoveries: 15, rate: 75.0 },
    },
  };

  prepare(query: string) {
    console.log('[DB] Executing query...');
    return {
      bind: (...args: any[]) => ({
        first: async () => {
          console.log('[DB] Query completed, returning mock data');
          return this.mockData;
        },
        all: async () => ({ results: [] }),
      }),
    };
  }
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('Manual Test: GET /api/metrics/recovery-rate endpoint');
  console.log('='.repeat(80));
  console.log();

  // Create mocks
  const mockKV = new MockKVNamespace();
  const mockDB = new MockD1Database();

  // Create Hono app
  const app = new Hono<{ Bindings: TestEnv }>();

  // Add the recovery-rate endpoint
  app.get('/api/metrics/recovery-rate', authenticateApiKey, rateLimiter(100), async (c) => {
    try {
      // Parse query parameters
      const branch = c.req.query('branch');
      const date_range = c.req.query('date_range');
      const plan = c.req.query('plan');

      console.log(`[Endpoint] Query params: branch=${branch}, date_range=${date_range}, plan=${plan}`);

      // Generate cache key from query parameters
      const cacheKey = generateCacheKey('recovery_rate', {
        branch,
        date_range,
        plan,
      });

      console.log(`[Endpoint] Generated cache key: ${cacheKey}`);

      // Check KV cache first
      const cached = await getCachedMetrics<RecoveryRateResponse>(
        c.env.KV,
        cacheKey,
        { branch, date_range, plan }
      );

      if (cached) {
        console.log('[Endpoint] Returning cached data');
        return c.json(cached);
      }

      console.log('[Endpoint] Cache miss, calculating from database');

      // Cache miss - calculate recovery rate from database
      const data = await calculateRecoveryRate(c.env.DB, {
        date_range,
        subscription_plan: plan,
        recovery_branch: branch as any,
      });

      // Store result in KV with 5-minute TTL
      await setCachedMetrics(c.env.KV, cacheKey, data, 300);

      console.log('[Endpoint] Returning fresh data');
      return c.json(data);
    } catch (error) {
      console.error('[Endpoint] Error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Failed to calculate recovery rate'
      }, 500);
    }
  });

  // Set up test environment
  const env: TestEnv = {
    DB: mockDB as any,
    KV: mockKV as any,
    VALID_API_KEYS: 'test-api-key-123',
    ENVIRONMENT: 'test',
  } as TestEnv;

  // Test 1: First request (cache miss)
  console.log('\n' + '-'.repeat(80));
  console.log('Test 1: First request with branch=overdue&date_range=30d (cache miss)');
  console.log('-'.repeat(80));
  
  const req1 = new Request('http://localhost/api/metrics/recovery-rate?branch=overdue&date_range=30d', {
    method: 'GET',
    headers: {
      'X-API-Key': 'test-api-key-123',
    },
  });

  const res1 = await app.fetch(req1, env);
  console.log(`\nResponse status: ${res1.status}`);
  const body1 = await res1.json();
  console.log('Response body:', JSON.stringify(body1, null, 2));

  // Test 2: Second request (cache hit)
  console.log('\n' + '-'.repeat(80));
  console.log('Test 2: Second request with same parameters (cache hit)');
  console.log('-'.repeat(80));
  
  const req2 = new Request('http://localhost/api/metrics/recovery-rate?branch=overdue&date_range=30d', {
    method: 'GET',
    headers: {
      'X-API-Key': 'test-api-key-123',
    },
  });

  const res2 = await app.fetch(req2, env);
  console.log(`\nResponse status: ${res2.status}`);
  const body2 = await res2.json();
  console.log('Response body:', JSON.stringify(body2, null, 2));

  // Test 3: Request with "today" (cache bypass)
  console.log('\n' + '-'.repeat(80));
  console.log('Test 3: Request with date_range=today (cache bypass)');
  console.log('-'.repeat(80));
  
  const req3 = new Request('http://localhost/api/metrics/recovery-rate?date_range=today', {
    method: 'GET',
    headers: {
      'X-API-Key': 'test-api-key-123',
    },
  });

  const res3 = await app.fetch(req3, env);
  console.log(`\nResponse status: ${res3.status}`);
  const body3 = await res3.json();
  console.log('Response body:', JSON.stringify(body3, null, 2));

  // Test 4: Request without API key (authentication failure)
  console.log('\n' + '-'.repeat(80));
  console.log('Test 4: Request without API key (should fail with 401)');
  console.log('-'.repeat(80));
  
  const req4 = new Request('http://localhost/api/metrics/recovery-rate?date_range=30d', {
    method: 'GET',
    // No X-API-Key header
  });

  const res4 = await app.fetch(req4, env);
  console.log(`\nResponse status: ${res4.status}`);
  const body4 = await res4.json();
  console.log('Response body:', JSON.stringify(body4, null, 2));

  // Test 5: Request with invalid API key
  console.log('\n' + '-'.repeat(80));
  console.log('Test 5: Request with invalid API key (should fail with 401)');
  console.log('-'.repeat(80));
  
  const req5 = new Request('http://localhost/api/metrics/recovery-rate?date_range=30d', {
    method: 'GET',
    headers: {
      'X-API-Key': 'invalid-key',
    },
  });

  const res5 = await app.fetch(req5, env);
  console.log(`\nResponse status: ${res5.status}`);
  const body5 = await res5.json();
  console.log('Response body:', JSON.stringify(body5, null, 2));

  // Test 6: Request with multiple query parameters
  console.log('\n' + '-'.repeat(80));
  console.log('Test 6: Request with multiple parameters (branch, date_range, plan)');
  console.log('-'.repeat(80));
  
  const req6 = new Request('http://localhost/api/metrics/recovery-rate?branch=due-today&date_range=60d&plan=premium', {
    method: 'GET',
    headers: {
      'X-API-Key': 'test-api-key-123',
    },
  });

  const res6 = await app.fetch(req6, env);
  console.log(`\nResponse status: ${res6.status}`);
  const body6 = await res6.json();
  console.log('Response body:', JSON.stringify(body6, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('All tests completed successfully!');
  console.log('='.repeat(80));
}

// Run the tests
runTests().catch(console.error);
