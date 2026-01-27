import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDSOMetrics, useDSOMetricsRealtime, useDSOByBranch } from './useDSOMetrics';
import { api } from '@/lib/api';
import type { DSOResponse } from '@/types/api';

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    getDSO: vi.fn(),
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

describe('useDSOMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch DSO metrics successfully', async () => {
    const mockData: DSOResponse = {
      date_range: '30d',
      average_dso: 15.5,
      median_dso: 14.0,
      by_branch: {
        '3-day-notice': 10.2,
        'due-today': 12.8,
        'overdue': 25.6,
      },
    };

    vi.mocked(api.getDSO).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useDSOMetrics({ date_range: '30d' }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(api.getDSO).toHaveBeenCalledWith({ date_range: '30d' });
  });

  it('should work with empty params', async () => {
    const mockData: DSOResponse = {
      date_range: 'all',
      average_dso: 18.3,
      median_dso: 16.5,
      by_branch: {
        '3-day-notice': 12.0,
        'due-today': 15.0,
        'overdue': 28.0,
      },
    };

    vi.mocked(api.getDSO).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDSOMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.getDSO).toHaveBeenCalledWith({});
  });
});

describe('useDSOMetricsRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch realtime DSO metrics', async () => {
    const mockData: DSOResponse = {
      date_range: 'today',
      average_dso: 5.2,
      median_dso: 4.0,
      by_branch: {
        '3-day-notice': 3.5,
        'due-today': 5.0,
        'overdue': 8.0,
      },
    };

    vi.mocked(api.getDSO).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useDSOMetricsRealtime({ date_range: 'today' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
  });
});

describe('useDSOByBranch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch DSO metrics with branch data', async () => {
    const mockData: DSOResponse = {
      date_range: '30d',
      average_dso: 15.5,
      median_dso: 14.0,
      by_branch: {
        '3-day-notice': 10.2,
        'due-today': 12.8,
        'overdue': 25.6,
      },
    };

    vi.mocked(api.getDSO).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useDSOByBranch({ date_range: '30d' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.by_branch).toBeDefined();
    expect(result.current.data?.by_branch['3-day-notice']).toBe(10.2);
    expect(result.current.data?.by_branch['due-today']).toBe(12.8);
    expect(result.current.data?.by_branch['overdue']).toBe(25.6);
  });

  it('should provide default by_branch data if missing', async () => {
    const mockData: DSOResponse = {
      date_range: '30d',
      average_dso: 15.5,
      median_dso: 14.0,
      by_branch: {
        '3-day-notice': 0,
        'due-today': 0,
        'overdue': 0,
      },
    };

    vi.mocked(api.getDSO).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useDSOByBranch({ date_range: '30d' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.by_branch).toBeDefined();
    expect(result.current.data?.by_branch['3-day-notice']).toBe(0);
    expect(result.current.data?.by_branch['due-today']).toBe(0);
    expect(result.current.data?.by_branch['overdue']).toBe(0);
  });
});
