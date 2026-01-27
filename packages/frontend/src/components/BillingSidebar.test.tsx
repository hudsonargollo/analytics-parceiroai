import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BillingSidebar } from './BillingSidebar';
import * as useCustomerBillingHook from '@/hooks/useCustomerBilling';

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('BillingSidebar', () => {
  it('should render loading state', () => {
    vi.spyOn(useCustomerBillingHook, 'useCustomerBilling').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <BillingSidebar customerId="cust_123" />
      </QueryClientProvider>
    );

    expect(screen.getByText('Customer Billing')).toBeInTheDocument();
  });

  it('should render billing data', () => {
    const mockData = {
      customer_id: 'cust_123',
      outstanding_invoices: [
        {
          invoice_id: 'inv_123',
          amount: 10000,
          due_date: '2024-01-15',
          status: 'pending' as const,
          payment_method: 'pix',
        },
      ],
      total_outstanding: 10000,
      payment_history_summary: {
        total_paid: 5,
        on_time_payments: 4,
        late_payments: 1,
      },
    };

    vi.spyOn(useCustomerBillingHook, 'useCustomerBilling').mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <BillingSidebar customerId="cust_123" />
      </QueryClientProvider>
    );

    expect(screen.getByText('Customer Billing')).toBeInTheDocument();
    expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
  });

  it('should render error state', () => {
    vi.spyOn(useCustomerBillingHook, 'useCustomerBilling').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isError: true,
    } as any);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <BillingSidebar customerId="cust_123" />
      </QueryClientProvider>
    );

    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });
});
