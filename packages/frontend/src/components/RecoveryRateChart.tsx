import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useRecoveryMetrics } from '@/hooks/useRecoveryMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface RecoveryRateChartProps {
  /**
   * Optional initial filters
   */
  initialBranch?: string;
  initialDateRange?: string;
  initialPlan?: string;
  /**
   * Optional callback when filters change
   */
  onFiltersChange?: (filters: { branch?: string; date_range?: string; plan?: string }) => void;
}

// Branch colors for visual distinction
const BRANCH_COLORS = {
  '3-day-notice': '#10b981', // green
  'due-today': '#f59e0b',    // amber
  'overdue': '#ef4444',      // red
  'all': '#3b82f6',          // blue
} as const;

// Date range options
const DATE_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '60d', label: 'Last 60 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'today', label: 'Today' },
] as const;

// Branch options
const BRANCHES = [
  { value: 'all', label: 'All Branches' },
  { value: '3-day-notice', label: '3-Day Notice' },
  { value: 'due-today', label: 'Due Today' },
  { value: 'overdue', label: 'Overdue' },
] as const;

// Plan options (example - adjust based on your actual plans)
const PLANS = [
  { value: 'all', label: 'All Plans' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
] as const;

/**
 * RecoveryRateChart Component
 * 
 * Displays recovery rates by branch using a bar chart with Recharts.
 * Includes filter controls for date range, plan, and branch.
 * Shows loading skeleton during data fetch and handles error states with toast notifications.
 * 
 * Features:
 * - Interactive bar chart with hover tooltips
 * - Filter controls (date range, plan, branch)
 * - Loading skeleton during data fetch
 * - Error handling with toast notifications
 * - Responsive design
 * - Color-coded branches for easy identification
 * 
 * @example
 * ```tsx
 * <RecoveryRateChart 
 *   initialDateRange="30d"
 *   onFiltersChange={(filters) => console.log(filters)}
 * />
 * ```
 */
export function RecoveryRateChart({
  initialBranch = 'all',
  initialDateRange = '30d',
  initialPlan = 'all',
  onFiltersChange,
}: RecoveryRateChartProps) {
  const { toast } = useToast();
  
  // Filter state
  const [branch, setBranch] = useState(initialBranch);
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [plan, setPlan] = useState(initialPlan);

  // Fetch data with current filters
  const { data, isLoading, error, isError } = useRecoveryMetrics(
    {
      branch: branch === 'all' ? undefined : branch,
      date_range: dateRange,
      plan: plan === 'all' ? undefined : plan,
    },
    {
      // Show error toast when query fails
      onError: (err) => {
        toast({
          variant: 'destructive',
          title: 'Failed to load recovery data',
          description: err.message || 'An error occurred while fetching recovery metrics.',
        });
      },
    }
  );

  // Handle filter changes
  const handleBranchChange = (value: string) => {
    setBranch(value);
    onFiltersChange?.({ branch: value, date_range: dateRange, plan });
  };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    onFiltersChange?.({ branch, date_range: value, plan });
  };

  const handlePlanChange = (value: string) => {
    setPlan(value);
    onFiltersChange?.({ branch, date_range: dateRange, plan: value });
  };

  // Prepare chart data
  const chartData = data ? [
    {
      name: 'Recovery Rate',
      rate: data.recovery_rate,
      attempts: data.total_attempts,
      recoveries: data.successful_recoveries,
      branch: data.branch || 'all',
    },
  ] : [];

  // Get color for current branch
  const barColor = BRANCH_COLORS[data?.branch as keyof typeof BRANCH_COLORS] || BRANCH_COLORS.all;

  // Calculate trend (mock - in real app, compare with previous period)
  const trend = data && data.recovery_rate > 50 ? 'up' : 'down';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recovery Rate by Branch</span>
          {data && (
            <div className="flex items-center gap-2 text-sm font-normal">
              {trend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-muted-foreground">
                {data.recovery_rate.toFixed(1)}% recovery rate
              </span>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Track subscription recovery success across different communication stages
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Filter Controls */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label htmlFor="date-range">Date Range</Label>
            <Select value={dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger id="date-range">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Branch Filter */}
          <div className="space-y-2">
            <Label htmlFor="branch">Recovery Branch</Label>
            <Select value={branch} onValueChange={handleBranchChange}>
              <SelectTrigger id="branch">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {BRANCHES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Plan Filter */}
          <div className="space-y-2">
            <Label htmlFor="plan">Subscription Plan</Label>
            <Select value={plan} onValueChange={handlePlanChange}>
              <SelectTrigger id="plan">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-[300px] w-full" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
            <h3 className="mb-2 text-lg font-semibold">Failed to load data</h3>
            <p className="text-sm text-muted-foreground">
              {error?.message || 'An error occurred while fetching recovery metrics.'}
            </p>
          </div>
        )}

        {/* Chart */}
        {!isLoading && !isError && data && (
          <>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    className="text-sm"
                    tick={{ fill: 'hsl(var(--foreground))' }}
                  />
                  <YAxis
                    className="text-sm"
                    tick={{ fill: 'hsl(var(--foreground))' }}
                    label={{
                      value: 'Recovery Rate (%)',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fill: 'hsl(var(--foreground))' },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'rate') {
                        return [`${value.toFixed(2)}%`, 'Recovery Rate'];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="rate"
                    name="Recovery Rate (%)"
                    radius={[8, 8, 0, 0]}
                  >
                    <Cell fill={barColor} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-card p-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Attempts
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {data.total_attempts.toLocaleString()}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Successful Recoveries
                </div>
                <div className="mt-2 text-2xl font-bold text-green-600">
                  {data.successful_recoveries.toLocaleString()}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Amount Recovered
                </div>
                <div className="mt-2 text-2xl font-bold">
                  R$ {(data.total_amount_recovered / 100).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="mt-6">
              <h4 className="mb-4 text-sm font-semibold">Recovery by Payment Method</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {Object.entries(data.breakdown_by_method).map(([method, stats]) => (
                  <div key={method} className="rounded-lg border bg-card p-4">
                    <div className="mb-2 text-sm font-medium capitalize text-muted-foreground">
                      {method === 'credit_card' ? 'Credit Card' : method}
                    </div>
                    <div className="text-xl font-bold">
                      {stats.rate.toFixed(1)}%
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {stats.recoveries} / {stats.attempts} attempts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
