/**
 * Unit tests for cache wrapper functions
 * 
 * Tests the cache layer implementation including:
 * - Cache key generation
 * - Cache bypass logic
 * - Get/set operations
 * - Cache invalidation
 */

import { describe, it, expect, beforeEach } from 'vitest';
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

// Mock KV namespace
class MockKV implements KVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map();

  async get(key: string, options?: { type: 'json' }): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    
    // Check if expired
    if (item.expiration && Date.now() > item.expiration) {
      this.store.delete(key);
      return null;
    }
    
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
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(): Promise<any> {
    return { keys: Array.from(this.store.keys()).map(name => ({ name })) };
  }

  // Additional methods required by KVNamespace interface
  getWithMetadata(): Promise<any> { throw new Error('Not implemented'); }
  async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: any): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const expiration = options?.expirationTtl 
      ? Date.now() + (options.expirationTtl * 1000)
      : undefined;
    this.store.set(key, { value: stringValue, expiration });
  }
}

describe('Cache Wrapper Functions', () => {
  let mockKV: MockKV;

  beforeEach(() => {
    mockKV = new MockKV();
  });

  describe('generateCacheKey', () => {
    it('should generate a cache key with prefix and parameters', () => {
      const key = generateCacheKey('recovery_rate', {
        branch: 'overdue',
        date_range: '30d',
      });

      expect(key).toBe('recovery_rate:branch:overdue:date_range:30d');
    });

    it('should sort parameters alphabetically for consistency', () => {
      const key1 = generateCacheKey('test', {
        z_param: 'last',
        a_param: 'first',
        m_param: 'middle',
      });

      const key2 = generateCacheKey('test', {
        m_param: 'middle',
        z_param: 'last',
        a_param: 'first',
      });

      expect(key1).toBe(key2);
      expect(key1).toBe('test:a_param:first:m_param:middle:z_param:last');
    });

    it('should filter out undefined values', () => {
      const key = generateCacheKey('recovery_rate', {
        branch: 'overdue',
        date_range: '30d',
        plan: undefined,
      });

      expect(key).toBe('recovery_rate:branch:overdue:date_range:30d');
      expect(key).not.toContain('plan');
    });

    it('should filter out null values', () => {
      const key = generateCacheKey('recovery_rate', {
        branch: 'overdue',
        date_range: '30d',
        plan: null as any,
      });

      expect(key).toBe('recovery_rate:branch:overdue:date_range:30d');
      expect(key).not.toContain('plan');
    });

    it('should filter out empty string values', () => {
      const key = generateCacheKey('recovery_rate', {
        branch: 'overdue',
        date_range: '30d',
        plan: '',
      });

      expect(key).toBe('recovery_rate:branch:overdue:date_range:30d');
      expect(key).not.toContain('plan');
    });

    it('should handle empty parameters object', () => {
      const key = generateCacheKey('dso', {});

      expect(key).toBe('dso');
    });

    it('should handle single parameter', () => {
      const key = generateCacheKey('dso', { date_range: '60d' });

      expect(key).toBe('dso:date_range:60d');
    });

    it('should handle cohort parameters', () => {
      const key = generateCacheKey('cohorts', {
        start_month: '2024-01',
        end_month: '2024-12',
      });

      expect(key).toBe('cohorts:end_month:2024-12:start_month:2024-01');
    });
  });

  describe('shouldBypassCache', () => {
    it('should bypass cache for "today" date range', () => {
      expect(shouldBypassCache({ date_range: 'today' })).toBe(true);
    });

    it('should bypass cache for "current" date range', () => {
      expect(shouldBypassCache({ date_range: 'current' })).toBe(true);
    });

    it('should bypass cache for "0d" date range', () => {
      expect(shouldBypassCache({ date_range: '0d' })).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(shouldBypassCache({ date_range: 'TODAY' })).toBe(true);
      expect(shouldBypassCache({ date_range: 'Today' })).toBe(true);
      expect(shouldBypassCache({ date_range: 'CURRENT' })).toBe(true);
    });

    it('should not bypass cache for normal date ranges', () => {
      expect(shouldBypassCache({ date_range: '7d' })).toBe(false);
      expect(shouldBypassCache({ date_range: '30d' })).toBe(false);
      expect(shouldBypassCache({ date_range: '60d' })).toBe(false);
      expect(shouldBypassCache({ date_range: '90d' })).toBe(false);
    });

    it('should not bypass cache when date_range is undefined', () => {
      expect(shouldBypassCache({})).toBe(false);
    });

    it('should not bypass cache for other parameters', () => {
      expect(shouldBypassCache({ branch: 'overdue' })).toBe(false);
    });
  });

  describe('getCachedMetrics', () => {
    it('should return cached data when available', async () => {
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

      const cacheKey = 'recovery_rate:branch:overdue:date_range:30d';
      await mockKV.put(cacheKey, JSON.stringify(testData));

      const result = await getCachedMetrics<RecoveryRateResponse>(
        mockKV,
        cacheKey,
        { branch: 'overdue', date_range: '30d' }
      );

      expect(result).toEqual(testData);
    });

    it('should return null when cache key does not exist', async () => {
      const result = await getCachedMetrics<RecoveryRateResponse>(
        mockKV,
        'nonexistent:key',
        { date_range: '30d' }
      );

      expect(result).toBeNull();
    });

    it('should return null when cache should be bypassed', async () => {
      const testData: DSOResponse = {
        date_range: 'today',
        average_dso: 5.5,
        median_dso: 4.0,
        by_branch: {
          '3-day-notice': 2.0,
          'due-today': 3.5,
          'overdue': 10.0,
        },
      };

      const cacheKey = 'dso:date_range:today';
      await mockKV.put(cacheKey, JSON.stringify(testData));

      const result = await getCachedMetrics<DSOResponse>(
        mockKV,
        cacheKey,
        { date_range: 'today' }
      );

      // Should return null because cache is bypassed for "today"
      expect(result).toBeNull();
    });

    it('should handle cache read errors gracefully', async () => {
      // Create a KV mock that throws an error
      const errorKV = {
        get: async () => {
          throw new Error('KV read error');
        },
      } as any;

      const result = await getCachedMetrics<RecoveryRateResponse>(
        errorKV,
        'test:key',
        { date_range: '30d' }
      );

      // Should return null instead of throwing
      expect(result).toBeNull();
    });

    it('should work with different metric types', async () => {
      const cohortData: CohortAnalysisResponse = {
        cohorts: [
          {
            cohort_month: '2024-01',
            total_customers: 50,
            billing_cycles: [
              { cycle_number: 1, attempted: 50, recovered: 45, recovery_rate: 90.0 },
            ],
            is_statistically_significant: true,
          },
        ],
      };

      const cacheKey = 'cohorts:start_month:2024-01';
      await mockKV.put(cacheKey, JSON.stringify(cohortData));

      const result = await getCachedMetrics<CohortAnalysisResponse>(
        mockKV,
        cacheKey,
        { start_month: '2024-01' }
      );

      expect(result).toEqual(cohortData);
    });
  });

  describe('setCachedMetrics', () => {
    it('should store data in cache with default TTL', async () => {
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

      const cacheKey = 'recovery_rate:branch:overdue:date_range:30d';
      await setCachedMetrics(mockKV, cacheKey, testData);

      const stored = await mockKV.get(cacheKey, { type: 'json' });
      expect(stored).toEqual(testData);
    });

    it('should use default TTL of 300 seconds', async () => {
      const testData: DSOResponse = {
        date_range: '30d',
        average_dso: 5.5,
        median_dso: 4.0,
        by_branch: {
          '3-day-notice': 2.0,
          'due-today': 3.5,
          'overdue': 10.0,
        },
      };

      const cacheKey = 'dso:date_range:30d';
      await setCachedMetrics(mockKV, cacheKey, testData);

      // Verify TTL is set (we can't directly check TTL in mock, but we can verify it's stored)
      const stored = await mockKV.get(cacheKey, { type: 'json' });
      expect(stored).toEqual(testData);
      expect(DEFAULT_CACHE_TTL).toBe(300);
    });

    it('should accept custom TTL', async () => {
      const testData: DSOResponse = {
        date_range: '30d',
        average_dso: 5.5,
        median_dso: 4.0,
        by_branch: {
          '3-day-notice': 2.0,
          'due-today': 3.5,
          'overdue': 10.0,
        },
      };

      const cacheKey = 'dso:date_range:30d';
      const customTTL = 600; // 10 minutes
      await setCachedMetrics(mockKV, cacheKey, testData, customTTL);

      const stored = await mockKV.get(cacheKey, { type: 'json' });
      expect(stored).toEqual(testData);
    });

    it('should handle cache write errors gracefully', async () => {
      const errorKV = {
        put: async () => {
          throw new Error('KV write error');
        },
      } as any;

      const testData: DSOResponse = {
        date_range: '30d',
        average_dso: 5.5,
        median_dso: 4.0,
        by_branch: {
          '3-day-notice': 2.0,
          'due-today': 3.5,
          'overdue': 10.0,
        },
      };

      // Should not throw
      await expect(
        setCachedMetrics(errorKV, 'test:key', testData)
      ).resolves.toBeUndefined();
    });

    it('should serialize complex objects correctly', async () => {
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

      const cacheKey = 'cohorts:start_month:2024-01';
      await setCachedMetrics(mockKV, cacheKey, cohortData);

      const stored = await mockKV.get(cacheKey, { type: 'json' });
      expect(stored).toEqual(cohortData);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate recovery_rate caches', async () => {
      // Set up some cache entries
      await mockKV.put('recovery_rate:date_range:30d', JSON.stringify({ test: 'data1' }));
      await mockKV.put('recovery_rate:branch:overdue:date_range:30d', JSON.stringify({ test: 'data2' }));
      await mockKV.put('recovery_rate:branch:due-today:date_range:7d', JSON.stringify({ test: 'data3' }));

      // Invalidate recovery_rate caches
      await invalidateCache(mockKV, 'recovery_rate:*');

      // Check that caches were deleted
      const result1 = await mockKV.get('recovery_rate:date_range:30d');
      const result2 = await mockKV.get('recovery_rate:branch:overdue:date_range:30d');
      const result3 = await mockKV.get('recovery_rate:branch:due-today:date_range:7d');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should invalidate dso caches', async () => {
      // Set up some cache entries
      await mockKV.put('dso:date_range:30d', JSON.stringify({ test: 'data1' }));
      await mockKV.put('dso:date_range:60d', JSON.stringify({ test: 'data2' }));

      // Invalidate DSO caches
      await invalidateCache(mockKV, 'dso:*');

      // Check that caches were deleted
      const result1 = await mockKV.get('dso:date_range:30d');
      const result2 = await mockKV.get('dso:date_range:60d');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should invalidate cohort caches', async () => {
      // Set up cache entry
      await mockKV.put('cohorts', JSON.stringify({ test: 'data' }));

      // Invalidate cohort caches
      await invalidateCache(mockKV, 'cohorts:*');

      // Check that cache was deleted
      const result = await mockKV.get('cohorts');
      expect(result).toBeNull();
    });

    it('should handle invalidation errors gracefully', async () => {
      const errorKV = {
        delete: async () => {
          throw new Error('KV delete error');
        },
      } as any;

      // Should not throw
      await expect(
        invalidateCache(errorKV, 'recovery_rate:*')
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateCustomerCache', () => {
    it('should invalidate customer billing cache', async () => {
      const customerId = 'cust_123';
      const billingKey = `customer_billing:${customerId}`;

      // Set up cache entry
      await mockKV.put(billingKey, JSON.stringify({ test: 'data' }));

      // Invalidate customer cache
      await invalidateCustomerCache(mockKV, customerId);

      // Check that cache was deleted
      const result = await mockKV.get(billingKey);
      expect(result).toBeNull();
    });

    it('should invalidate aggregated metrics caches', async () => {
      const customerId = 'cust_123';

      // Set up some aggregated cache entries
      await mockKV.put('recovery_rate:date_range:30d', JSON.stringify({ test: 'data1' }));
      await mockKV.put('dso:date_range:30d', JSON.stringify({ test: 'data2' }));
      await mockKV.put('cohorts', JSON.stringify({ test: 'data3' }));

      // Invalidate customer cache (which should also invalidate aggregated metrics)
      await invalidateCustomerCache(mockKV, customerId);

      // Check that aggregated caches were deleted
      const result1 = await mockKV.get('recovery_rate:date_range:30d');
      const result2 = await mockKV.get('dso:date_range:30d');
      const result3 = await mockKV.get('cohorts');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const errorKV = {
        delete: async () => {
          throw new Error('KV delete error');
        },
      } as any;

      // Should not throw
      await expect(
        invalidateCustomerCache(errorKV, 'cust_123')
      ).resolves.toBeUndefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should support full cache lifecycle: set, get, invalidate', async () => {
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

      const params = { branch: 'overdue', date_range: '30d' };
      const cacheKey = generateCacheKey('recovery_rate', params);

      // Set cache
      await setCachedMetrics(mockKV, cacheKey, testData);

      // Get from cache
      const cached = await getCachedMetrics<RecoveryRateResponse>(mockKV, cacheKey, params);
      expect(cached).toEqual(testData);

      // Invalidate cache
      await invalidateCache(mockKV, 'recovery_rate:*');

      // Verify cache is gone
      const afterInvalidation = await getCachedMetrics<RecoveryRateResponse>(
        mockKV,
        cacheKey,
        params
      );
      expect(afterInvalidation).toBeNull();
    });

    it('should handle cache bypass correctly in full flow', async () => {
      const testData: DSOResponse = {
        date_range: 'today',
        average_dso: 5.5,
        median_dso: 4.0,
        by_branch: {
          '3-day-notice': 2.0,
          'due-today': 3.5,
          'overdue': 10.0,
        },
      };

      const params = { date_range: 'today' };
      const cacheKey = generateCacheKey('dso', params);

      // Set cache (even though it will be bypassed)
      await setCachedMetrics(mockKV, cacheKey, testData);

      // Try to get from cache - should return null due to bypass
      const cached = await getCachedMetrics<DSOResponse>(mockKV, cacheKey, params);
      expect(cached).toBeNull();

      // Verify data is actually in KV (just bypassed)
      const directGet = await mockKV.get(cacheKey, { type: 'json' });
      expect(directGet).toEqual(testData);
    });
  });
});
