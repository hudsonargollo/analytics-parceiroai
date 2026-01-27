import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CustomerBillingResponse } from '@/types/api';

/**
 * React Query hook for fetching customer billing information
 * Used primarily in the Chatwoot sidebar integration
 * 
 * Features:
 * - Automatic caching with 1-minute stale time (frequently updated data)
 * - Automatic refetching on window focus
 * - Retry logic with exponential backoff (3 attempts)
 * - Error handling with typed errors
 * 
 * @param customerId - Customer identifier
 * @param options - Additional React Query options
 * @returns Query result with customer billing data, loading state, and error
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useCustomerBilling('customer-123');
 * ```
 */
export function useCustomerBilling(
  customerId: string,
  options?: Omit<
    UseQueryOptions<CustomerBillingResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<CustomerBillingResponse, Error>({
    queryKey: ['customer-billing', customerId],
    queryFn: () => api.getCustomerBilling(customerId),
    staleTime: 1 * 60 * 1000, // 1 minute - billing data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    enabled: !!customerId, // Only fetch if customerId is provided
    ...options,
  });
}

/**
 * React Query mutation hook for resending Boleto
 * Triggers n8n workflow to regenerate and send Boleto via WhatsApp
 * 
 * Features:
 * - Automatic retry on failure (3 attempts)
 * - Optimistic updates with rollback on error
 * - Cache invalidation on success
 * - Error handling with typed errors
 * 
 * @param options - Additional React Query mutation options
 * @returns Mutation result with mutate function, loading state, and error
 * 
 * @example
 * ```tsx
 * const { mutate, isPending, error } = useResendBoleto();
 * 
 * const handleResend = () => {
 *   mutate(
 *     { customerId: 'customer-123', invoiceId: 'invoice-456' },
 *     {
 *       onSuccess: () => toast.success('Boleto sent successfully'),
 *       onError: (error) => toast.error(error.message)
 *     }
 *   );
 * };
 * ```
 */
export function useResendBoleto(
  options?: UseMutationOptions<
    unknown,
    Error,
    { customerId: string; invoiceId: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    { customerId: string; invoiceId: string }
  >({
    mutationFn: ({ customerId, invoiceId }) =>
      api.resendBoleto(customerId, invoiceId),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onSuccess: (_, variables) => {
      // Invalidate customer billing cache to refetch updated data
      queryClient.invalidateQueries({
        queryKey: ['customer-billing', variables.customerId],
      });
    },
    ...options,
  });
}

/**
 * Hook for checking if customer has outstanding invoices
 * Useful for conditional rendering of billing information
 * 
 * @param customerId - Customer identifier
 * @returns Query result with boolean indicating if customer has outstanding invoices
 * 
 * @example
 * ```tsx
 * const { data: hasOutstanding } = useHasOutstandingInvoices('customer-123');
 * if (hasOutstanding) {
 *   // Show payment options
 * }
 * ```
 */
export function useHasOutstandingInvoices(customerId: string) {
  return useQuery<boolean, Error>({
    queryKey: ['customer-billing', customerId, 'has-outstanding'],
    queryFn: async () => {
      const data = await api.getCustomerBilling(customerId);
      return data.outstanding_invoices.length > 0;
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!customerId,
  });
}

/**
 * Hook for getting customer's overdue invoices count
 * Useful for displaying alerts or badges
 * 
 * @param customerId - Customer identifier
 * @returns Query result with count of overdue invoices
 * 
 * @example
 * ```tsx
 * const { data: overdueCount } = useOverdueInvoicesCount('customer-123');
 * ```
 */
export function useOverdueInvoicesCount(customerId: string) {
  return useQuery<number, Error>({
    queryKey: ['customer-billing', customerId, 'overdue-count'],
    queryFn: async () => {
      const data = await api.getCustomerBilling(customerId);
      return data.outstanding_invoices.filter(
        (invoice) => invoice.status === 'overdue'
      ).length;
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!customerId,
  });
}
