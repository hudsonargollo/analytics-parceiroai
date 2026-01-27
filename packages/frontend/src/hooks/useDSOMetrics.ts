import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DSOResponse, DSOMetricsParams } from '@/types/api';

/**
 * React Query hook for fetching DSO (Days Sales Outstanding) metrics
 * 
 * Features:
 * - Automatic caching with 5-minute stale time
 * - Automatic refetching on window focus
 * - Retry logic with exponential backoff (3 attempts)
 * - Error handling with typed errors
 * 
 * @param params - Query parameters for filtering DSO metrics
 * @param options - Additional React Query options
 * @returns Query result with DSO data, loading state, and error
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useDSOMetrics({
 *   date_range: '30d'
 * });
 * ```
 */
export function useDSOMetrics(
  params: DSOMetricsParams = {},
  options?: Omit<
    UseQueryOptions<DSOResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<DSOResponse, Error>({
    queryKey: ['dso-metrics', params],
    queryFn: () => api.getDSO(params),
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
 * Hook variant for real-time DSO data (bypasses cache)
 * Use this for current day queries where fresh data is critical
 * 
 * @param params - Query parameters for filtering DSO metrics
 * @param options - Additional React Query options
 * @returns Query result with fresh DSO data
 * 
 * @example
 * ```tsx
 * const { data } = useDSOMetricsRealtime({
 *   date_range: 'today'
 * });
 * ```
 */
export function useDSOMetricsRealtime(
  params: DSOMetricsParams = {},
  options?: Omit<
    UseQueryOptions<DSOResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<DSOResponse, Error>({
    queryKey: ['dso-metrics-realtime', params],
    queryFn: () => api.getDSO(params),
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

/**
 * Hook for comparing DSO across recovery branches
 * Returns DSO data with branch comparison enabled
 * 
 * @param params - Query parameters for filtering DSO metrics
 * @param options - Additional React Query options
 * @returns Query result with DSO data by branch
 * 
 * @example
 * ```tsx
 * const { data } = useDSOByBranch({ date_range: '30d' });
 * // Access: data.by_branch['3-day-notice'], data.by_branch['due-today'], etc.
 * ```
 */
export function useDSOByBranch(
  params: DSOMetricsParams = {},
  options?: Omit<
    UseQueryOptions<DSOResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<DSOResponse, Error>({
    queryKey: ['dso-metrics', 'by-branch', params],
    queryFn: () => api.getDSO(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    select: (data) => ({
      ...data,
      // Ensure by_branch data is always available
      by_branch: data.by_branch || {
        '3-day-notice': 0,
        'due-today': 0,
        'overdue': 0,
      },
    }),
    ...options,
  });
}
