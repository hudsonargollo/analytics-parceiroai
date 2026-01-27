/**
 * Cache wrapper functions for KV storage
 * 
 * This module provides utilities for caching aggregated metrics in Cloudflare KV
 * with automatic key generation, TTL management, and cache invalidation.
 * 
 * Requirements:
 * - 6.2: Use KV_Store for frequently accessed data
 * - 6.3: Refresh cache when older than 5 minutes
 */

import type { CacheKeyParams, CacheableMetrics } from '../types';

/**
 * Default TTL for cached metrics (5 minutes = 300 seconds)
 * Requirement 6.3: Cache refresh after 5 minutes
 */
export const DEFAULT_CACHE_TTL = 300;

/**
 * Generate a cache key from query parameters
 * 
 * Creates a deterministic cache key by sorting parameters alphabetically
 * and joining them with colons. This ensures consistent keys for the same
 * query parameters regardless of order.
 * 
 * @param prefix - The cache key prefix (e.g., 'recovery_rate', 'dso', 'cohorts')
 * @param params - Query parameters to include in the cache key
 * @returns A cache key string in the format: prefix:param1:value1:param2:value2
 * 
 * @example
 * generateCacheKey('recovery_rate', { branch: 'overdue', date_range: '30d' })
 * // Returns: 'recovery_rate:branch:overdue:date_range:30d'
 */
export function generateCacheKey(prefix: string, params: CacheKeyParams): string {
  // Sort parameters alphabetically for consistent key generation
  const sortedKeys = Object.keys(params).sort();
  
  // Build key parts, filtering out undefined values
  const keyParts = [prefix];
  
  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined && value !== null && value !== '') {
      keyParts.push(key, value);
    }
  }
  
  return keyParts.join(':');
}

/**
 * Check if a query should bypass cache (current day queries)
 * 
 * Requirement 6.4: Bypass cache for current day queries to ensure
 * real-time data for today's metrics.
 * 
 * @param params - Query parameters to check
 * @returns true if cache should be bypassed, false otherwise
 */
export function shouldBypassCache(params: CacheKeyParams): boolean {
  const dateRange = params.date_range?.toLowerCase();
  
  // Bypass cache for current day queries
  if (dateRange === 'today' || dateRange === 'current' || dateRange === '0d') {
    return true;
  }
  
  return false;
}

/**
 * Get cached metrics from KV store
 * 
 * Retrieves cached metrics data from Cloudflare KV. Returns null if:
 * - Cache key doesn't exist
 * - Cache has expired (handled automatically by KV TTL)
 * - Query should bypass cache (current day queries)
 * 
 * Requirement 6.2: Use KV_Store for frequently accessed data
 * 
 * @param kv - Cloudflare KV namespace binding
 * @param cacheKey - The cache key to retrieve
 * @param params - Query parameters (used to check if cache should be bypassed)
 * @returns Cached metrics data or null if not found/expired
 */
export async function getCachedMetrics<T extends CacheableMetrics>(
  kv: KVNamespace,
  cacheKey: string,
  params: CacheKeyParams
): Promise<T | null> {
  // Check if we should bypass cache for this query
  if (shouldBypassCache(params)) {
    return null;
  }
  
  try {
    // Retrieve from KV with JSON parsing
    const cached = await kv.get(cacheKey, { type: 'json' });
    
    if (cached) {
      return cached as T;
    }
    
    return null;
  } catch (error) {
    // Log error but don't throw - cache failures should be non-fatal
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Store metrics in KV cache with TTL
 * 
 * Stores aggregated metrics data in Cloudflare KV with automatic expiration.
 * Cache writes are non-blocking and failures are logged but don't throw errors.
 * 
 * Requirements:
 * - 6.2: Use KV_Store for frequently accessed data
 * - 6.3: Set 5-minute TTL for cache refresh
 * 
 * @param kv - Cloudflare KV namespace binding
 * @param cacheKey - The cache key to store under
 * @param data - The metrics data to cache
 * @param ttl - Time to live in seconds (default: 300 seconds / 5 minutes)
 */
export async function setCachedMetrics<T extends CacheableMetrics>(
  kv: KVNamespace,
  cacheKey: string,
  data: T,
  ttl: number = DEFAULT_CACHE_TTL
): Promise<void> {
  try {
    // Store in KV with JSON serialization and TTL
    await kv.put(cacheKey, JSON.stringify(data), {
      expirationTtl: ttl,
    });
  } catch (error) {
    // Log error but don't throw - cache failures should be non-fatal
    // The system should continue to work even if caching fails
    console.error('Cache write error:', error);
  }
}

/**
 * Invalidate cache entries by pattern
 * 
 * Invalidates cache entries that match a given pattern. This is used when
 * write operations occur that would make cached data stale.
 * 
 * Note: KV doesn't support pattern-based deletion, so this function
 * invalidates specific known keys based on the operation type.
 * 
 * Requirement 6.3: Implement cache invalidation on write operations
 * 
 * @param kv - Cloudflare KV namespace binding
 * @param pattern - The cache key pattern to invalidate (e.g., 'recovery_rate:*')
 */
export async function invalidateCache(
  kv: KVNamespace,
  pattern: string
): Promise<void> {
  try {
    // For now, we'll implement a simple approach:
    // Delete common cache keys that would be affected by writes
    
    // Extract the prefix from the pattern (before the first ':')
    const prefix = pattern.split(':')[0];
    
    // Common date ranges to invalidate
    const commonDateRanges = ['7d', '30d', '60d', '90d'];
    const commonBranches = ['3-day-notice', 'due-today', 'overdue'];
    
    const keysToDelete: string[] = [];
    
    // Generate common cache keys to invalidate based on prefix
    if (prefix === 'recovery_rate') {
      // Invalidate all recovery rate combinations
      for (const dateRange of commonDateRanges) {
        keysToDelete.push(generateCacheKey('recovery_rate', { date_range: dateRange }));
        for (const branch of commonBranches) {
          keysToDelete.push(generateCacheKey('recovery_rate', { date_range: dateRange, branch }));
        }
      }
    } else if (prefix === 'dso') {
      // Invalidate all DSO date ranges
      for (const dateRange of commonDateRanges) {
        keysToDelete.push(generateCacheKey('dso', { date_range: dateRange }));
      }
    } else if (prefix === 'cohorts') {
      // Invalidate cohort caches
      // Note: This is a simplified approach - in production, you might want
      // to track active cache keys in a separate KV namespace
      keysToDelete.push(generateCacheKey('cohorts', {}));
      
      // Also invalidate common cohort month ranges (last 3 years + current + next year)
      const currentYear = new Date().getFullYear();
      const years = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
      for (const year of years) {
        for (let month = 1; month <= 12; month++) {
          const monthStr = month.toString().padStart(2, '0');
          keysToDelete.push(generateCacheKey('cohorts', { start_month: `${year}-${monthStr}` }));
          keysToDelete.push(generateCacheKey('cohorts', { end_month: `${year}-${monthStr}` }));
          // Common combinations
          for (let endMonth = month; endMonth <= 12; endMonth++) {
            const endMonthStr = endMonth.toString().padStart(2, '0');
            keysToDelete.push(generateCacheKey('cohorts', { 
              start_month: `${year}-${monthStr}`, 
              end_month: `${year}-${endMonthStr}` 
            }));
          }
        }
      }
    }
    
    // Delete all identified keys
    await Promise.all(keysToDelete.map(key => kv.delete(key)));
  } catch (error) {
    // Log error but don't throw - cache invalidation failures should be non-fatal
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Invalidate all caches related to a specific customer
 * 
 * When a customer's data changes (new payment, engagement update),
 * invalidate all cache entries that might include that customer's data.
 * 
 * @param kv - Cloudflare KV namespace binding
 * @param customerId - The customer ID whose caches should be invalidated
 */
export async function invalidateCustomerCache(
  kv: KVNamespace,
  customerId: string
): Promise<void> {
  try {
    // Invalidate customer-specific billing cache
    const billingKey = `customer_billing:${customerId}`;
    await kv.delete(billingKey);
    
    // Also invalidate aggregated metrics since they include this customer
    await invalidateCache(kv, 'recovery_rate:*');
    await invalidateCache(kv, 'dso:*');
    await invalidateCache(kv, 'cohorts:*');
  } catch (error) {
    console.error('Customer cache invalidation error:', error);
  }
}
