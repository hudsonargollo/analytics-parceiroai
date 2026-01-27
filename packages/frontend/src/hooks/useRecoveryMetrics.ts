import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RecoveryRateResponse, RecoveryMetricsParams } from '@/types/api';

/**
 * React Query hook for fetching recovery rate metrics
 * 
 * Features:
 * - Automatic caching with 5-minute stale time
 * - Automatic refetching on window focus
 * - Retry logic with exponential backoff (3 attempts)
 * - Error handling with typed errors
 * 
 * @param params - Query parameters for filtering recovery metrics
 * @param options - Additional React Query options
 * @returns Query result with recovery rate data, loading state, and error
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useRecoveryMetrics({
 *   branch: 'overdue',
 *   date_range: '30d'
 * });
 * ```
 */
export function useRecoveryMetrics(
  params: RecoveryMetricsParams = {},
  options?: Omit<
    UseQueryOptions<RecoveryRateResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<RecoveryRateResponse, Error>({
    queryKey: ['recovery-metrics', params],
    queryFn: () => api.getRecoveryRate(params),
    staleTime: 5 * 60 * 1000, // 5 minutes - matches backend cache TTL
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    ...options,
  });
}

/**
 * Hook variant for real-time data (bypasses cache)
 * Use this for current day queries where fresh data is critical
 * 
 * @param params - Query parameters for filtering recovery metrics
 * @param options - Additional React Query options
 * @returns Query result with fresh recovery rate data
 * 
 * @example
 * ```tsx
 * const { data } = useRecoveryMetricsRealtime({
 *   date_range: 'today'
 * });
 * ```
 */
export function useRecoveryMetricsRealtime(
  params: RecoveryMetricsParams = {},
  options?: Omit<
    UseQueryOptions<RecoveryRateResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<RecoveryRateResponse, Error>({
    queryKey: ['recovery-metrics-realtime', params],
    queryFn: () => api.getRecoveryRate(params),
    staleTime: 0, // Always consider stale
    gcTime: 1 * 60 * 1000, // 1 minute cache
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}
