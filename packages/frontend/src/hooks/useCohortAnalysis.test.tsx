import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCohortAnalysis, useCohortMonth } from './useCohortAnalysis';
import { api } from '@/lib/api';
import type { CohortAnalysisResponse } from '@/types/api';

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    getCohorts: vi.fn(),
  },
}));

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ children }: any) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useCohortAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch cohort analysis successfully', async () => {
    const mockData: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-01',
          total_customers: 50,
          billing_cycles: [
            { cycle_number: 1, attempted: 50, recovered: 45, recovery_rate: 90.0 },
            { cycle_number: 2, attempted: 45, recovered: 40, recovery_rate: 88.89 },
          ],
          is_statistically_significant: true,
        },
        {
          cohort_month: '2024-02',
          total_customers: 60,
          billing_cycles: [
            { cycle_number: 1, attempted: 60, recovered: 50, recovery_rate: 83.33 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    vi.mocked(api.getCohorts).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useCohortAnalysis({ start_month: '2024-01', end_month: '2024-02' }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(api.getCohorts).toHaveBeenCalledWith({
      start_month: '2024-01',
      end_month: '2024-02',
    });
  });

  it('should work with empty params', async () => {
    const mockData: CohortAnalysisResponse = {
      cohorts: [],
    };

    vi.mocked(api.getCohorts).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCohortAnalysis(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.getCohorts).toHaveBeenCalledWith({});
  });

  it('should handle cohorts with insufficient data', async () => {
    const mockData: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-03',
          total_customers: 5,
          billing_cycles: [
            { cycle_number: 1, attempted: 5, recovered: 4, recovery_rate: 80.0 },
          ],
          is_statistically_significant: false, // Less than 10 customers
        },
      ],
    };

    vi.mocked(api.getCohorts).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useCohortAnalysis({ start_month: '2024-03', end_month: '2024-03' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.cohorts[0].is_statistically_significant).toBe(false);
  });
});

describe('useCohortMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch single cohort month data', async () => {
    const mockData: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-06',
          total_customers: 75,
          billing_cycles: [
            { cycle_number: 1, attempted: 75, recovered: 65, recovery_rate: 86.67 },
            { cycle_number: 2, attempted: 65, recovered: 58, recovery_rate: 89.23 },
            { cycle_number: 3, attempted: 58, recovered: 52, recovery_rate: 89.66 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    vi.mocked(api.getCohorts).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCohortMonth('2024-06'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(api.getCohorts).toHaveBeenCalledWith({
      start_month: '2024-06',
      end_month: '2024-06',
    });
  });

  it('should use correct query key for single month', async () => {
    const mockData: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-05',
          total_customers: 40,
          billing_cycles: [
            { cycle_number: 1, attempted: 40, recovered: 35, recovery_rate: 87.5 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    vi.mocked(api.getCohorts).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCohortMonth('2024-05'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should call with both start and end month set to the same value
    expect(api.getCohorts).toHaveBeenCalledWith({
      start_month: '2024-05',
      end_month: '2024-05',
    });
  });
});
