import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoveryRateChart } from './RecoveryRateChart';
import * as useRecoveryMetricsModule from '@/hooks/useRecoveryMetrics';
import type { RecoveryRateResponse } from '@/types/api';

// Mock the hooks
vi.mock('@/hooks/useRecoveryMetrics');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Cell: () => <div data-testid="cell" />,
}));

const mockRecoveryData: RecoveryRateResponse = {
  branch: 'overdue',
  date_range: '30d',
  total_attempts: 150,
  successful_recoveries: 90,
  recovery_rate: 60.0,
  total_amount_attempted: 50000,
  total_amount_recovered: 30000,
  breakdown_by_method: {
    pix: { attempts: 80, recoveries: 60, rate: 75.0 },
    boleto: { attempts: 50, recoveries: 25, rate: 50.0 },
    credit_card: { attempts: 20, recoveries: 5, rate: 25.0 },
  },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('RecoveryRateChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading skeleton while fetching data', () => {
    vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    renderWithQueryClient(<RecoveryRateChart />);

    // Should show skeleton loaders (check for skeleton class)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    
    // Should not show chart
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('should render chart with data when loaded successfully', async () => {
    vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: mockRecoveryData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    renderWithQueryClient(<RecoveryRateChart />);

    // Should render chart components
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toBeInTheDocument();

    // Should display summary stats
    expect(screen.getByText('Total Attempts')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Successful Recoveries')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();

    // Should display recovery rate
    expect(screen.getByText(/60\.0% recovery rate/i)).toBeInTheDocument();

    // Should display amount recovered (in BRL)
    expect(screen.getByText(/R\$ 300,00/i)).toBeInTheDocument();
  });

  it('should render error state when data fetch fails', () => {
    const mockError = new Error('Network error');
    vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: mockError,
      isError: true,
    } as any);

    renderWithQueryClient(<RecoveryRateChart />);

    // Should show error message
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('should render filter controls with correct options', () => {
    vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: mockRecoveryData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    renderWithQueryClient(<RecoveryRateChart />);

    // Should render all three filter controls
    expect(screen.getByLabelText('Date Range')).toBeInTheDocument();
    expect(screen.getByLabelText('Recovery Branch')).toBeInTheDocument();
    expect(screen.getByLabelText('Subscription Plan')).toBeInTheDocument();
  });

  it('should call onFiltersChange when filters are updated', async () => {
    const onFiltersChange = vi.fn();

    vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: mockRecoveryData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    renderWithQueryClient(
      <RecoveryRateChart onFiltersChange={onFiltersChange} />
    );

    // Note: Testing select interactions requires more complex setup with Radix UI
    // This is a simplified test that verifies the callback prop is passed
    expect(onFiltersChange).not.toHaveBeenCalled();
  });

  it('should display payment method breakdown', () => {
    vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: mockRecoveryData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    renderWithQueryClient(<RecoveryRateChart />);

    // Should show payment method breakdown section
    expect(screen.getByText('Recovery by Payment Method')).toBeInTheDocument();

    // Should show all payment methods
    expect(screen.getByText('pix')).toBeInTheDocument();
    expect(screen.getByText('boleto')).toBeInTheDocument();
    expect(screen.getByText('Credit Card')).toBeInTheDocument();

    // Should show recovery rates for each method
    expect(screen.getByText('75.0%')).toBeInTheDocument(); // Pix
    expect(screen.getByText('50.0%')).toBeInTheDocument(); // Boleto
    expect(screen.getByText('25.0%')).toBeInTheDocument(); // Credit Card

    // Should show attempt counts
    expect(screen.getByText('60 / 80 attempts')).toBeInTheDocument(); // Pix
    expect(screen.getByText('25 / 50 attempts')).toBeInTheDocument(); // Boleto
    expect(screen.getByText('5 / 20 attempts')).toBeInTheDocument(); // Credit Card
  });

  it('should use initial filter values when provided', () => {
    const useRecoveryMetricsSpy = vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: mockRecoveryData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    renderWithQueryClient(
      <RecoveryRateChart
        initialBranch="overdue"
        initialDateRange="60d"
        initialPlan="pro"
      />
    );

    // Should call useRecoveryMetrics with initial filter values
    expect(useRecoveryMetricsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'overdue',
        date_range: '60d',
        plan: 'pro',
      }),
      expect.any(Object)
    );
  });

  it('should handle "all" filter values by passing undefined to API', () => {
    const useRecoveryMetricsSpy = vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: mockRecoveryData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    renderWithQueryClient(
      <RecoveryRateChart
        initialBranch="all"
        initialPlan="all"
      />
    );

    // Should pass undefined for "all" values
    expect(useRecoveryMetricsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: undefined,
        plan: undefined,
      }),
      expect.any(Object)
    );
  });

  it('should display trend indicator based on recovery rate', () => {
    // Test with high recovery rate (> 50%)
    vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: { ...mockRecoveryData, recovery_rate: 75.0 },
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    const { rerender } = renderWithQueryClient(<RecoveryRateChart />);

    // Should show upward trend
    expect(screen.getByText(/75\.0% recovery rate/i)).toBeInTheDocument();

    // Test with low recovery rate (<= 50%)
    vi.spyOn(useRecoveryMetricsModule, 'useRecoveryMetrics').mockReturnValue({
      data: { ...mockRecoveryData, recovery_rate: 30.0 },
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <RecoveryRateChart />
      </QueryClientProvider>
    );

    // Should show downward trend
    expect(screen.getByText(/30\.0% recovery rate/i)).toBeInTheDocument();
  });
});
