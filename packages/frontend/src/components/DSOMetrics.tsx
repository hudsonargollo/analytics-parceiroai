import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDSOMetrics } from '@/hooks/useDSOMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Calendar, TrendingUp, Clock } from 'lucide-react';

interface DSOMetricsProps {
  /**
   * Optional initial date range filter
   */
  initialDateRange?: string;
  /**
   * Optional callback when filters change
   */
  onFiltersChange?: (filters: { date_range?: string }) => void;
}

// Date range options
const DATE_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '60d', label: 'Last 60 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'today', label: 'Today' },
] as const;

// Branch display names
const BRANCH_NAMES: Record<string, string> = {
  '3-day-notice': '3-Day Notice',
  'due-today': 'Due Today',
  'overdue': 'Overdue',
};

// Branch colors for visual distinction
const BRANCH_COLORS: Record<string, string> = {
  '3-day-notice': 'text-green-600',
  'due-today': 'text-amber-600',
  'overdue': 'text-red-600',
};

/**
 * DSOMetrics Component
 * 
 * Displays Days Sales Outstanding (DSO) metrics with average and median values.
 * Shows DSO breakdown by recovery branch with comparison and animated metric changes.
 * 
 * Features:
 * - Metric cards with average and median DSO
 * - DSO by branch with comparison
 * - Date range filter
 * - Animated metric changes with Framer Motion
 * - Loading skeleton during data fetch
 * - Error handling with toast notifications
 * - Responsive design
 * 
 * Requirements: 3.4
 * 
 * @example
 * ```tsx
 * <DSOMetrics 
 *   initialDateRange="30d"
 *   onFiltersChange={(filters) => console.log(filters)}
 * />
 * ```
 */
export function DSOMetrics({
  initialDateRange = '30d',
  onFiltersChange,
}: DSOMetricsProps) {
  const { toast } = useToast();
  
  // Filter state
  const [dateRange, setDateRange] = useState(initialDateRange);

  // Fetch data with current filters
  const { data, isLoading, error, isError } = useDSOMetrics(
    { date_range: dateRange }
  );

  // Show error toast when query fails
  useEffect(() => {
    if (isError && error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load DSO data',
        description: error.message || 'An error occurred while fetching DSO metrics.',
      });
    }
  }, [isError, error, toast]);

  // Handle filter changes
  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    onFiltersChange?.({ date_range: value });
  };

  // Animation variants for metric cards
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' }
    },
  };

  const numberVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    },
  };

  // Find best and worst performing branches
  const branchPerformance = data?.by_branch ? Object.entries(data.by_branch)
    .map(([branch, dso]) => ({ branch, dso }))
    .sort((a, b) => a.dso - b.dso) : [];
  
  const bestBranch = branchPerformance[0];
  const worstBranch = branchPerformance[branchPerformance.length - 1];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Days Sales Outstanding (DSO)</span>
          {data && (
            <div className="flex items-center gap-2 text-sm font-normal">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {data.average_dso.toFixed(1)} days average
              </span>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Track the average time between invoice creation and payment receipt
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Filter Controls */}
        <div className="mb-6">
          <div className="space-y-2">
            <Label htmlFor="date-range">Date Range</Label>
            <Select value={dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger id="date-range" className="w-full sm:w-[240px]">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {range.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
            <h3 className="mb-2 text-lg font-semibold">Failed to load data</h3>
            <p className="text-sm text-muted-foreground">
              {error?.message || 'An error occurred while fetching DSO metrics.'}
            </p>
          </div>
        )}

        {/* Metrics Display */}
        {!isLoading && !isError && data && (
          <div className="space-y-6">
            {/* Primary Metrics */}
            <motion.div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.1,
                  },
                },
              }}
            >
              {/* Average DSO Card */}
              <motion.div variants={cardVariants}>
                <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Average DSO
                        </p>
                        <motion.div
                          key={data.average_dso}
                          variants={numberVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <p className="text-4xl font-bold tracking-tight">
                            {data.average_dso.toFixed(1)}
                          </p>
                        </motion.div>
                        <p className="text-xs text-muted-foreground">
                          days to payment
                        </p>
                      </div>
                      <div className="rounded-full bg-primary/10 p-3">
                        <TrendingUp className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Median DSO Card */}
              <motion.div variants={cardVariants}>
                <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Median DSO
                        </p>
                        <motion.div
                          key={data.median_dso}
                          variants={numberVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <p className="text-4xl font-bold tracking-tight text-blue-600">
                            {data.median_dso.toFixed(1)}
                          </p>
                        </motion.div>
                        <p className="text-xs text-muted-foreground">
                          days to payment
                        </p>
                      </div>
                      <div className="rounded-full bg-blue-500/10 p-3">
                        <Clock className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* DSO by Branch */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">DSO by Recovery Branch</CardTitle>
                  <CardDescription>
                    Compare payment timing across different communication stages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(data.by_branch).map(([branch, dso], index) => {
                      // Calculate percentage difference from average
                      const diffFromAvg = ((dso - data.average_dso) / data.average_dso) * 100;
                      const isBetter = dso < data.average_dso;
                      const isBest = bestBranch?.branch === branch;
                      const isWorst = worstBranch?.branch === branch;

                      return (
                        <motion.div
                          key={branch}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                          className={`rounded-lg border p-4 ${
                            isBest ? 'border-green-500/50 bg-green-50/50' : 
                            isWorst ? 'border-red-500/50 bg-red-50/50' : 
                            'bg-card'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">
                                  {BRANCH_NAMES[branch] || branch}
                                </h4>
                                {isBest && (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                    Best
                                  </span>
                                )}
                                {isWorst && (
                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                    Slowest
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex items-baseline gap-3">
                                <motion.span
                                  key={dso}
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ duration: 0.3 }}
                                  className={`text-3xl font-bold ${BRANCH_COLORS[branch] || 'text-foreground'}`}
                                >
                                  {dso.toFixed(1)}
                                </motion.span>
                                <span className="text-sm text-muted-foreground">days</span>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className={`flex items-center gap-1 text-sm font-medium ${
                                isBetter ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {isBetter ? (
                                  <TrendingUp className="h-4 w-4 rotate-180" />
                                ) : (
                                  <TrendingUp className="h-4 w-4" />
                                )}
                                <span>
                                  {Math.abs(diffFromAvg).toFixed(1)}%
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {isBetter ? 'faster' : 'slower'} than avg
                              </p>
                            </div>
                          </div>

                          {/* Visual bar indicator */}
                          <div className="mt-3">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((dso / Math.max(...Object.values(data.by_branch))) * 100, 100)}%` }}
                                transition={{ duration: 0.8, delay: 0.4 + index * 0.1, ease: 'easeOut' }}
                                className={`h-full ${
                                  isBest ? 'bg-green-500' : 
                                  isWorst ? 'bg-red-500' : 
                                  'bg-primary'
                                }`}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Insights */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="rounded-lg border bg-muted/30 p-4"
            >
              <h4 className="mb-2 text-sm font-semibold">Key Insights</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <p>
                    <strong>Average DSO:</strong> Customers take an average of{' '}
                    <span className="font-semibold text-foreground">
                      {data.average_dso.toFixed(1)} days
                    </span>{' '}
                    to pay after invoice creation.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <p>
                    <strong>Median DSO:</strong> Half of all payments are received within{' '}
                    <span className="font-semibold text-foreground">
                      {data.median_dso.toFixed(1)} days
                    </span>
                    , indicating the typical payment timeline.
                  </p>
                </div>
                {bestBranch && worstBranch && (
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-green-500" />
                    <p>
                      <strong>Branch Performance:</strong>{' '}
                      <span className="font-semibold text-green-600">
                        {BRANCH_NAMES[bestBranch.branch]}
                      </span>{' '}
                      has the fastest payment time ({bestBranch.dso.toFixed(1)} days), while{' '}
                      <span className="font-semibold text-red-600">
                        {BRANCH_NAMES[worstBranch.branch]}
                      </span>{' '}
                      takes longest ({worstBranch.dso.toFixed(1)} days).
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
