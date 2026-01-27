import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCustomerBilling,
  useResendBoleto,
  useHasOutstandingInvoices,
  useOverdueInvoicesCount,
} from './useCustomerBilling';
import { api } from '@/lib/api';
import type { CustomerBillingResponse } from '@/types/api';

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    getCustomerBilling: vi.fn(),
    resendBoleto: vi.fn(),
  },
}));

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ children }: any) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useCustomerBilling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch customer billing data successfully', async () => {
    const mockData: CustomerBillingResponse = {
      customer_id: 'customer-123',
      outstanding_invoices: [
        {
          invoice_id: 'invoice-1',
          amount: 5000,
          due_date: '2024-01-15',
          status: 'pending',
          payment_method: 'pix',
          pix_code: 'PIX123456',
        },
        {
          invoice_id: 'invoice-2',
          amount: 3000,
          due_date: '2024-01-10',
          status: 'overdue',
          payment_method: 'boleto',
          boleto_url: 'https://example.com/boleto/123',
          days_overdue: 5,
        },
      ],
      total_outstanding: 8000,
      last_payment_date: '2023-12-15',
      payment_history_summary: {
        total_paid: 15000,
        on_time_payments: 8,
        late_payments: 2,
      },
    };

    vi.mocked(api.getCustomerBilling).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCustomerBilling('customer-123'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(api.getCustomerBilling).toHaveBeenCalledWith('customer-123');
  });

  it('should not fetch when customerId is empty', async () => {
    const { result } = renderHook(() => useCustomerBilling(''), {
      wrapper: createWrapper(),
    });

    // Should not be loading or fetching
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(api.getCustomerBilling).not.toHaveBeenCalled();
  });

  it('should handle customer with no outstanding invoices', async () => {
    const mockData: CustomerBillingResponse = {
      customer_id: 'customer-456',
      outstanding_invoices: [],
      total_outstanding: 0,
      last_payment_date: '2024-01-01',
      payment_history_summary: {
        total_paid: 10000,
        on_time_payments: 10,
        late_payments: 0,
      },
    };

    vi.mocked(api.getCustomerBilling).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCustomerBilling('customer-456'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.outstanding_invoices).toHaveLength(0);
    expect(result.current.data?.total_outstanding).toBe(0);
  });
});

describe('useResendBoleto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resend boleto successfully', async () => {
    vi.mocked(api.resendBoleto).mockResolvedValue({ status: 'triggered' });

    const { result } = renderHook(() => useResendBoleto(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      customerId: 'customer-123',
      invoiceId: 'invoice-456',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.resendBoleto).toHaveBeenCalledWith('customer-123', 'invoice-456');
  });

  it('should invalidate customer billing cache on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(api.resendBoleto).mockResolvedValue({ status: 'triggered' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapper = ({ children }: any) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useResendBoleto(), { wrapper });

    result.current.mutate({
      customerId: 'customer-123',
      invoiceId: 'invoice-456',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['customer-billing', 'customer-123'],
    });
  });
});

describe('useHasOutstandingInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when customer has outstanding invoices', async () => {
    const mockData: CustomerBillingResponse = {
      customer_id: 'customer-123',
      outstanding_invoices: [
        {
          invoice_id: 'invoice-1',
          amount: 5000,
          due_date: '2024-01-15',
          status: 'pending',
          payment_method: 'pix',
        },
      ],
      total_outstanding: 5000,
      payment_history_summary: {
        total_paid: 10000,
        on_time_payments: 5,
        late_payments: 1,
      },
    };

    vi.mocked(api.getCustomerBilling).mockResolvedValue(mockData);

    const { result } = renderHook(() => useHasOutstandingInvoices('customer-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(true);
  });

  it('should return false when customer has no outstanding invoices', async () => {
    const mockData: CustomerBillingResponse = {
      customer_id: 'customer-456',
      outstanding_invoices: [],
      total_outstanding: 0,
      payment_history_summary: {
        total_paid: 10000,
        on_time_payments: 10,
        late_payments: 0,
      },
    };

    vi.mocked(api.getCustomerBilling).mockResolvedValue(mockData);

    const { result } = renderHook(() => useHasOutstandingInvoices('customer-456'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(false);
  });
});

describe('useOverdueInvoicesCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return correct count of overdue invoices', async () => {
    const mockData: CustomerBillingResponse = {
      customer_id: 'customer-123',
      outstanding_invoices: [
        {
          invoice_id: 'invoice-1',
          amount: 5000,
          due_date: '2024-01-15',
          status: 'pending',
          payment_method: 'pix',
        },
        {
          invoice_id: 'invoice-2',
          amount: 3000,
          due_date: '2024-01-10',
          status: 'overdue',
          payment_method: 'boleto',
          days_overdue: 5,
        },
        {
          invoice_id: 'invoice-3',
          amount: 2000,
          due_date: '2024-01-05',
          status: 'overdue',
          payment_method: 'pix',
          days_overdue: 10,
        },
      ],
      total_outstanding: 10000,
      payment_history_summary: {
        total_paid: 15000,
        on_time_payments: 8,
        late_payments: 2,
      },
    };

    vi.mocked(api.getCustomerBilling).mockResolvedValue(mockData);

    const { result } = renderHook(() => useOverdueInvoicesCount('customer-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(2);
  });

  it('should return 0 when no overdue invoices', async () => {
    const mockData: CustomerBillingResponse = {
      customer_id: 'customer-456',
      outstanding_invoices: [
        {
          invoice_id: 'invoice-1',
          amount: 5000,
          due_date: '2024-01-15',
          status: 'pending',
          payment_method: 'pix',
        },
      ],
      total_outstanding: 5000,
      payment_history_summary: {
        total_paid: 10000,
        on_time_payments: 10,
        late_payments: 0,
      },
    };

    vi.mocked(api.getCustomerBilling).mockResolvedValue(mockData);

    const { result } = renderHook(() => useOverdueInvoicesCount('customer-456'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(0);
  });
});
