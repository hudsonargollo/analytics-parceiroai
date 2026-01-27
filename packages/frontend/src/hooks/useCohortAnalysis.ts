import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CohortAnalysisResponse, CohortAnalysisParams } from '@/types/api';

/**
 * React Query hook for fetching cohort analysis data
 * 
 * Features:
 * - Automatic caching with 5-minute stale time
 * - Automatic refetching on window focus
 * - Retry logic with exponential backoff (3 attempts)
 * - Error handling with typed errors
 * 
 * @param params - Query parameters for filtering cohort analysis
 * @param options - Additional React Query options
 * @returns Query result with cohort analysis data, loading state, and error
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useCohortAnalysis({
 *   start_month: '2024-01',
 *   end_month: '2024-12'
 * });
 * ```
 */
export function useCohortAnalysis(
  params: CohortAnalysisParams = {},
  options?: Omit<
    UseQueryOptions<CohortAnalysisResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<CohortAnalysisResponse, Error>({
    queryKey: ['cohort-analysis', params],
    queryFn: () => api.getCohorts(params),
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
 * Hook variant for specific cohort month
 * Filters the cohort analysis to a single month for detailed view
 * 
 * @param cohortMonth - Specific cohort month in YYYY-MM format
 * @param options - Additional React Query options
 * @returns Query result with single cohort data
 * 
 * @example
 * ```tsx
 * const { data } = useCohortMonth('2024-06');
 * ```
 */
export function useCohortMonth(
  cohortMonth: string,
  options?: Omit<
    UseQueryOptions<CohortAnalysisResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<CohortAnalysisResponse, Error>({
    queryKey: ['cohort-analysis', 'month', cohortMonth],
    queryFn: () => api.getCohorts({ 
      start_month: cohortMonth, 
      end_month: cohortMonth 
    }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}
