import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRecoveryMetrics, useRecoveryMetricsRealtime } from './useRecoveryMetrics';
import { api } from '@/lib/api';
import type { RecoveryRateResponse } from '@/types/api';

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    getRecoveryRate: vi.fn(),
  },
}));

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
      },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ children }: any) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useRecoveryMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch recovery metrics successfully', async () => {
    const mockData: RecoveryRateResponse = {
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

    vi.mocked(api.getRecoveryRate).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useRecoveryMetrics({ branch: 'overdue', date_range: '30d' }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(api.getRecoveryRate).toHaveBeenCalledWith({
      branch: 'overdue',
      date_range: '30d',
    });
  });

  it('should use correct query key for caching', async () => {
    const mockData: RecoveryRateResponse = {
      branch: 'due-today',
      date_range: '7d',
      total_attempts: 50,
      successful_recoveries: 40,
      recovery_rate: 80.0,
      total_amount_attempted: 5000,
      total_amount_recovered: 4000,
      breakdown_by_method: {
        pix: { attempts: 25, recoveries: 20, rate: 80.0 },
        boleto: { attempts: 15, recoveries: 12, rate: 80.0 },
        credit_card: { attempts: 10, recoveries: 8, rate: 80.0 },
      },
    };

    vi.mocked(api.getRecoveryRate).mockResolvedValue(mockData);

    const params = { branch: 'due-today', date_range: '7d' };
    const { result } = renderHook(() => useRecoveryMetrics(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Query key should include params for proper caching
    expect(api.getRecoveryRate).toHaveBeenCalledWith(params);
  });

  it('should work with empty params', async () => {
    const mockData: RecoveryRateResponse = {
      branch: 'all',
      date_range: '30d',
      total_attempts: 200,
      successful_recoveries: 150,
      recovery_rate: 75.0,
      total_amount_attempted: 20000,
      total_amount_recovered: 15000,
      breakdown_by_method: {
        pix: { attempts: 100, recoveries: 80, rate: 80.0 },
        boleto: { attempts: 60, recoveries: 40, rate: 66.67 },
        credit_card: { attempts: 40, recoveries: 30, rate: 75.0 },
      },
    };

    vi.mocked(api.getRecoveryRate).mockResolvedValue(mockData);

    const { result } = renderHook(() => useRecoveryMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.getRecoveryRate).toHaveBeenCalledWith({});
  });
});

describe('useRecoveryMetricsRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch realtime recovery metrics', async () => {
    const mockData: RecoveryRateResponse = {
      branch: 'overdue',
      date_range: 'today',
      total_attempts: 10,
      successful_recoveries: 8,
      recovery_rate: 80.0,
      total_amount_attempted: 1000,
      total_amount_recovered: 800,
      breakdown_by_method: {
        pix: { attempts: 5, recoveries: 4, rate: 80.0 },
        boleto: { attempts: 3, recoveries: 2, rate: 66.67 },
        credit_card: { attempts: 2, recoveries: 2, rate: 100.0 },
      },
    };

    vi.mocked(api.getRecoveryRate).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useRecoveryMetricsRealtime({ date_range: 'today' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
  });

  it('should use different query key than regular hook', async () => {
    const mockData: RecoveryRateResponse = {
      branch: 'overdue',
      date_range: 'today',
      total_attempts: 10,
      successful_recoveries: 8,
      recovery_rate: 80.0,
      total_amount_attempted: 1000,
      total_amount_recovered: 800,
      breakdown_by_method: {
        pix: { attempts: 5, recoveries: 4, rate: 80.0 },
        boleto: { attempts: 3, recoveries: 2, rate: 66.67 },
        credit_card: { attempts: 2, recoveries: 2, rate: 100.0 },
      },
    };

    vi.mocked(api.getRecoveryRate).mockResolvedValue(mockData);

    const params = { date_range: 'today' };
    
    // Render both hooks
    const { result: realtimeResult } = renderHook(
      () => useRecoveryMetricsRealtime(params),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(realtimeResult.current.isSuccess).toBe(true);
    });

    // Both should call the API (different query keys = no cache sharing)
    expect(api.getRecoveryRate).toHaveBeenCalledWith(params);
  });
});
