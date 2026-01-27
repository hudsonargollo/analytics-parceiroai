import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DSOMetrics } from './DSOMetrics';
import * as useDSOMetricsModule from '@/hooks/useDSOMetrics';
import type { DSOResponse } from '@/types/api';

// Mock the hooks
vi.mock('@/hooks/useDSOMetrics');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const mockDSOData: DSOResponse = {
  date_range: '30d',
  average_dso: 15.5,
  median_dso: 12.3,
  by_branch: {
    '3-day-notice': 10.2,
    'due-today': 14.8,
    'overdue': 21.5,
  },
};

describe('DSOMetrics', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DSOMetrics {...props} />
      </QueryClientProvider>
    );
  };

  describe('Loading State', () => {
    it('should display loading skeletons while fetching data', () => {
      vi.mocked(useDSOMetricsModule.useDSOMetrics).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
      } as any);

      renderComponent();

      // Check for skeleton elements (they have specific class names)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('should display error message when data fetch fails', () => {
      const errorMessage = 'Failed to fetch DSO data';
      vi.mocked(useDSOMetricsModule.useDSOMetrics).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error(errorMessage),
        isError: true,
      } as any);

      renderComponent();

      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    beforeEach(() => {
      vi.mocked(useDSOMetricsModule.useDSOMetrics).mockReturnValue({
        data: mockDSOData,
        isLoading: false,
        error: null,
        isError: false,
      } as any);
    });

    it('should render the component title and description', () => {
      renderComponent();

      expect(screen.getByText('Days Sales Outstanding (DSO)')).toBeInTheDocument();
      expect(screen.getByText(/Track the average time between invoice creation/)).toBeInTheDocument();
    });

    it('should display average DSO metric', () => {
      renderComponent();

      expect(screen.getByText('Average DSO')).toBeInTheDocument();
      expect(screen.getByText('15.5')).toBeInTheDocument();
      expect(screen.getByText('days to payment')).toBeInTheDocument();
    });

    it('should display median DSO metric', () => {
      renderComponent();

      expect(screen.getByText('Median DSO')).toBeInTheDocument();
      expect(screen.getByText('12.3')).toBeInTheDocument();
    });

    it('should display DSO by branch section', () => {
      renderComponent();

      expect(screen.getByText('DSO by Recovery Branch')).toBeInTheDocument();
      expect(screen.getByText('3-Day Notice')).toBeInTheDocument();
      expect(screen.getByText('Due Today')).toBeInTheDocument();
      expect(screen.getByText('Overdue')).toBeInTheDocument();
    });

    it('should display DSO values for each branch', () => {
      renderComponent();

      expect(screen.getByText('10.2')).toBeInTheDocument(); // 3-day-notice
      expect(screen.getByText('14.8')).toBeInTheDocument(); // due-today
      expect(screen.getByText('21.5')).toBeInTheDocument(); // overdue
    });

    it('should mark the best performing branch', () => {
      renderComponent();

      // 3-day-notice has the lowest DSO (10.2), so it should be marked as "Best"
      const bestBadges = screen.getAllByText('Best');
      expect(bestBadges.length).toBeGreaterThan(0);
    });

    it('should mark the worst performing branch', () => {
      renderComponent();

      // overdue has the highest DSO (21.5), so it should be marked as "Slowest"
      const slowestBadges = screen.getAllByText('Slowest');
      expect(slowestBadges.length).toBeGreaterThan(0);
    });

    it('should display key insights section', () => {
      renderComponent();

      expect(screen.getByText('Key Insights')).toBeInTheDocument();
      expect(screen.getByText(/Customers take an average of/)).toBeInTheDocument();
      expect(screen.getByText(/Half of all payments are received within/)).toBeInTheDocument();
    });

    it('should show percentage difference from average for each branch', () => {
      renderComponent();

      // Check for "faster" and "slower" indicators
      const fasterTexts = screen.getAllByText('faster than avg');
      const slowerTexts = screen.getAllByText('slower than avg');
      
      expect(fasterTexts.length + slowerTexts.length).toBeGreaterThan(0);
    });
  });

  describe('Date Range Filter', () => {
    beforeEach(() => {
      vi.mocked(useDSOMetricsModule.useDSOMetrics).mockReturnValue({
        data: mockDSOData,
        isLoading: false,
        error: null,
        isError: false,
      } as any);
    });

    it('should render date range filter', () => {
      renderComponent();

      expect(screen.getByText('Date Range')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should use initial date range from props', () => {
      renderComponent({ initialDateRange: '60d' });

      // Verify the hook was called with the correct initial date range
      expect(useDSOMetricsModule.useDSOMetrics).toHaveBeenCalledWith(
        { date_range: '60d' },
        expect.any(Object)
      );
    });

    it('should call onFiltersChange when date range changes', async () => {
      const onFiltersChange = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onFiltersChange });

      // Click the select trigger
      const selectTrigger = screen.getByRole('combobox');
      await user.click(selectTrigger);

      // Wait for the dropdown to appear and click an option
      await waitFor(() => {
        const option = screen.getByText('Last 60 days');
        expect(option).toBeInTheDocument();
      });

      const option = screen.getByText('Last 60 days');
      await user.click(option);

      // Verify callback was called
      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith({ date_range: '60d' });
      });
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      vi.mocked(useDSOMetricsModule.useDSOMetrics).mockReturnValue({
        data: mockDSOData,
        isLoading: false,
        error: null,
        isError: false,
      } as any);
    });

    it('should render with responsive grid classes', () => {
      const { container } = renderComponent();

      // Check for responsive grid classes
      const grids = container.querySelectorAll('.grid-cols-1');
      expect(grids.length).toBeGreaterThan(0);

      const smGrids = container.querySelectorAll('.sm\\:grid-cols-2');
      expect(smGrids.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero DSO values', () => {
      vi.mocked(useDSOMetricsModule.useDSOMetrics).mockReturnValue({
        data: {
          date_range: '30d',
          average_dso: 0,
          median_dso: 0,
          by_branch: {
            '3-day-notice': 0,
            'due-today': 0,
            'overdue': 0,
          },
        },
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderComponent();

      expect(screen.getByText('0.0')).toBeInTheDocument();
    });

    it('should handle very large DSO values', () => {
      vi.mocked(useDSOMetricsModule.useDSOMetrics).mockReturnValue({
        data: {
          date_range: '30d',
          average_dso: 999.9,
          median_dso: 888.8,
          by_branch: {
            '3-day-notice': 777.7,
            'due-today': 888.8,
            'overdue': 999.9,
          },
        },
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderComponent();

      expect(screen.getByText('999.9')).toBeInTheDocument();
      expect(screen.getByText('888.8')).toBeInTheDocument();
      expect(screen.getByText('777.7')).toBeInTheDocument();
    });

    it('should handle decimal precision correctly', () => {
      vi.mocked(useDSOMetricsModule.useDSOMetrics).mockReturnValue({
        data: {
          date_range: '30d',
          average_dso: 15.567,
          median_dso: 12.345,
          by_branch: {
            '3-day-notice': 10.234,
            'due-today': 14.876,
            'overdue': 21.543,
          },
        },
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderComponent();

      // Should round to 1 decimal place
      expect(screen.getByText('15.6')).toBeInTheDocument();
      expect(screen.getByText('12.3')).toBeInTheDocument();
      expect(screen.getByText('10.2')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      vi.mocked(useDSOMetricsModule.useDSOMetrics).mockReturnValue({
        data: mockDSOData,
        isLoading: false,
        error: null,
        isError: false,
      } as any);
    });

    it('should have proper labels for form controls', () => {
      renderComponent();

      const dateRangeLabel = screen.getByText('Date Range');
      expect(dateRangeLabel).toBeInTheDocument();
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveAccessibleName('Date Range');
    });

    it('should have descriptive text for screen readers', () => {
      renderComponent();

      // Check for descriptive text
      expect(screen.getByText(/Track the average time between invoice creation/)).toBeInTheDocument();
      expect(screen.getByText(/Compare payment timing across different communication stages/)).toBeInTheDocument();
    });
  });
});
