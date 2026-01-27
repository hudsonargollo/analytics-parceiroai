/**
 * Manual test for cache wrapper functions
 * 
 * Run this file to manually verify cache functionality:
 * npx tsx tests/manual-test-cache.ts
 */

import {
  generateCacheKey,
  shouldBypassCache,
  getCachedMetrics,
  setCachedMetrics,
  invalidateCache,
  invalidateCustomerCache,
  DEFAULT_CACHE_TTL,
} from '../src/lib/cache';
import type { RecoveryRateResponse, DSOResponse, CohortAnalysisResponse } from '../src/types';

// Simple in-memory KV mock for manual testing
class TestKV implements KVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map();

  async get(key: string, options?: { type: 'json' }): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expiration && Date.now() > item.expiration) {
      this.store.delete(key);
      return null;
    }
    
    if (options?.type === 'json') {
      return JSON.parse(item.value);
    }
    return item.value;
  }

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: any): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const expiration = options?.expirationTtl 
      ? Date.now() + (options.expirationTtl * 1000)
      : undefined;
    this.store.set(key, { value: stringValue, expiration });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(): Promise<any> {
    return { keys: Array.from(this.store.keys()).map(name => ({ name })) };
  }

  getWithMetadata(): Promise<any> { throw new Error('Not implemented'); }
}

// Test utilities
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

function assertEquals(actual: any, expected: any, message: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`  Expected: ${expectedStr}`);
    console.error(`  Actual: ${actualStr}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('🧪 Running manual cache tests...\n');

  const kv = new TestKV();

  // Test 1: generateCacheKey
  console.log('Test 1: generateCacheKey');
  const key1 = generateCacheKey('recovery_rate', { branch: 'overdue', date_range: '30d' });
  assertEquals(key1, 'recovery_rate:branch:overdue:date_range:30d', 'Should generate correct cache key');

  const key2 = generateCacheKey('recovery_rate', { date_range: '30d', branch: 'overdue' });
  assertEquals(key2, key1, 'Should generate same key regardless of parameter order');

  const key3 = generateCacheKey('recovery_rate', { branch: 'overdue', date_range: '30d', plan: undefined });
  assertEquals(key3, key1, 'Should filter out undefined values');

  const key4 = generateCacheKey('dso', {});
  assertEquals(key4, 'dso', 'Should handle empty parameters');

  console.log('');

  // Test 2: shouldBypassCache
  console.log('Test 2: shouldBypassCache');
  assert(shouldBypassCache({ date_range: 'today' }), 'Should bypass cache for "today"');
  assert(shouldBypassCache({ date_range: 'current' }), 'Should bypass cache for "current"');
  assert(shouldBypassCache({ date_range: '0d' }), 'Should bypass cache for "0d"');
  assert(shouldBypassCache({ date_range: 'TODAY' }), 'Should be case-insensitive');
  assert(!shouldBypassCache({ date_range: '30d' }), 'Should not bypass cache for normal date ranges');
  assert(!shouldBypassCache({}), 'Should not bypass cache when date_range is undefined');

  console.log('');

  // Test 3: setCachedMetrics and getCachedMetrics
  console.log('Test 3: setCachedMetrics and getCachedMetrics');
  
  const testData: RecoveryRateResponse = {
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

  const cacheKey = generateCacheKey('recovery_rate', { branch: 'overdue', date_range: '30d' });
  await setCachedMetrics(kv, cacheKey, testData);

  const cached = await getCachedMetrics<RecoveryRateResponse>(
    kv,
    cacheKey,
    { branch: 'overdue', date_range: '30d' }
  );

  assertEquals(cached, testData, 'Should retrieve cached data correctly');

  console.log('');

  // Test 4: Cache bypass for current day
  console.log('Test 4: Cache bypass for current day');
  
  const todayData: DSOResponse = {
    date_range: 'today',
    average_dso: 5.5,
    median_dso: 4.0,
    by_branch: {
      '3-day-notice': 2.0,
      'due-today': 3.5,
      'overdue': 10.0,
    },
  };

  const todayKey = generateCacheKey('dso', { date_range: 'today' });
  await setCachedMetrics(kv, todayKey, todayData);

  const todayCached = await getCachedMetrics<DSOResponse>(
    kv,
    todayKey,
    { date_range: 'today' }
  );

  assertEquals(todayCached, null, 'Should return null for current day queries (cache bypass)');

  console.log('');

  // Test 5: Cache invalidation
  console.log('Test 5: Cache invalidation');
  
  // Set up multiple cache entries
  await setCachedMetrics(kv, 'recovery_rate:date_range:30d', testData);
  await setCachedMetrics(kv, 'recovery_rate:branch:overdue:date_range:30d', testData);
  await setCachedMetrics(kv, 'recovery_rate:branch:due-today:date_range:7d', testData);

  // Invalidate recovery_rate caches
  await invalidateCache(kv, 'recovery_rate:*');

  // Check that caches were deleted
  const result1 = await kv.get('recovery_rate:date_range:30d');
  const result2 = await kv.get('recovery_rate:branch:overdue:date_range:30d');
  const result3 = await kv.get('recovery_rate:branch:due-today:date_range:7d');

  assertEquals(result1, null, 'Should invalidate recovery_rate:date_range:30d');
  assertEquals(result2, null, 'Should invalidate recovery_rate:branch:overdue:date_range:30d');
  assertEquals(result3, null, 'Should invalidate recovery_rate:branch:due-today:date_range:7d');

  console.log('');

  // Test 6: Customer cache invalidation
  console.log('Test 6: Customer cache invalidation');
  
  const customerId = 'cust_123';
  const billingKey = `customer_billing:${customerId}`;

  await kv.put(billingKey, JSON.stringify({ test: 'data' }));
  await setCachedMetrics(kv, 'recovery_rate:date_range:30d', testData);
  await setCachedMetrics(kv, 'dso:date_range:30d', todayData);

  await invalidateCustomerCache(kv, customerId);

  const billingResult = await kv.get(billingKey);
  const recoveryResult = await kv.get('recovery_rate:date_range:30d');
  const dsoResult = await kv.get('dso:date_range:30d');

  assertEquals(billingResult, null, 'Should invalidate customer billing cache');
  assertEquals(recoveryResult, null, 'Should invalidate recovery rate cache');
  assertEquals(dsoResult, null, 'Should invalidate DSO cache');

  console.log('');

  // Test 7: Full cache lifecycle
  console.log('Test 7: Full cache lifecycle');
  
  const cohortData: CohortAnalysisResponse = {
    cohorts: [
      {
        cohort_month: '2024-01',
        total_customers: 50,
        billing_cycles: [
          { cycle_number: 1, attempted: 50, recovered: 45, recovery_rate: 90.0 },
          { cycle_number: 2, attempted: 48, recovered: 40, recovery_rate: 83.33 },
        ],
        is_statistically_significant: true,
      },
    ],
  };

  const params = { start_month: '2024-01' };
  const cohortKey = generateCacheKey('cohorts', params);

  // Set cache
  await setCachedMetrics(kv, cohortKey, cohortData);

  // Get from cache
  const cohortCached = await getCachedMetrics<CohortAnalysisResponse>(kv, cohortKey, params);
  assertEquals(cohortCached, cohortData, 'Should retrieve cohort data from cache');

  // Invalidate cache
  await invalidateCache(kv, 'cohorts:*');

  // Verify cache is gone
  const afterInvalidation = await getCachedMetrics<CohortAnalysisResponse>(kv, cohortKey, params);
  assertEquals(afterInvalidation, null, 'Should return null after invalidation');

  console.log('');

  // Test 8: TTL constant
  console.log('Test 8: TTL constant');
  assertEquals(DEFAULT_CACHE_TTL, 300, 'DEFAULT_CACHE_TTL should be 300 seconds (5 minutes)');

  console.log('');

  console.log('🎉 All manual tests passed!');
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
