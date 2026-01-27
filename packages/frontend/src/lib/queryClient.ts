import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

/**
 * Global error handler for React Query
 * Logs errors and can be extended to send to error tracking service
 */
function handleError(error: Error) {
  console.error('Query error:', error);
  // TODO: Send to error tracking service (e.g., Sentry)
}

/**
 * Configured QueryClient instance with:
 * - Global error handling
 * - Default retry logic (3 attempts with exponential backoff)
 * - Default stale time (5 minutes)
 * - Default cache time (10 minutes)
 * - Automatic refetching on window focus and reconnect
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleError,
  }),
  mutationCache: new MutationCache({
    onError: handleError,
  }),
  defaultOptions: {
    queries: {
      // Default query options
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Default mutation options
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

/**
 * Helper function to invalidate all analytics queries
 * Useful after data updates or when forcing a refresh
 */
export function invalidateAnalyticsQueries() {
  queryClient.invalidateQueries({ queryKey: ['recovery-metrics'] });
  queryClient.invalidateQueries({ queryKey: ['dso-metrics'] });
  queryClient.invalidateQueries({ queryKey: ['cohort-analysis'] });
}

/**
 * Helper function to invalidate customer billing queries
 * Useful after payment actions or billing updates
 */
export function invalidateCustomerBillingQueries(customerId?: string) {
  if (customerId) {
    queryClient.invalidateQueries({ queryKey: ['customer-billing', customerId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['customer-billing'] });
  }
}

/**
 * Helper function to prefetch recovery metrics
 * Useful for optimistic loading before navigation
 */
export function prefetchRecoveryMetrics(params: {
  branch?: string;
  date_range?: string;
  plan?: string;
}) {
  return queryClient.prefetchQuery({
    queryKey: ['recovery-metrics', params],
    queryFn: async () => {
      const { api } = await import('./api');
      return api.getRecoveryRate(params);
    },
  });
}

/**
 * Helper function to prefetch DSO metrics
 * Useful for optimistic loading before navigation
 */
export function prefetchDSOMetrics(params: { date_range?: string }) {
  return queryClient.prefetchQuery({
    queryKey: ['dso-metrics', params],
    queryFn: async () => {
      const { api } = await import('./api');
      return api.getDSO(params);
    },
  });
}

/**
 * Helper function to prefetch cohort analysis
 * Useful for optimistic loading before navigation
 */
export function prefetchCohortAnalysis(params: {
  start_month?: string;
  end_month?: string;
}) {
  return queryClient.prefetchQuery({
    queryKey: ['cohort-analysis', params],
    queryFn: async () => {
      const { api } = await import('./api');
      return api.getCohorts(params);
    },
  });
}
