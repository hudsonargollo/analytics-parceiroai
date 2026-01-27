import { useState, useMemo } from 'react';
import { useCohortAnalysis } from '@/hooks/useCohortAnalysis';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Users, TrendingUp } from 'lucide-react';

interface CohortAnalysisTableProps {
  /**
   * Optional initial date range filters
   */
  initialStartMonth?: string;
  initialEndMonth?: string;
  /**
   * Optional callback when filters change
   */
  onFiltersChange?: (filters: { start_month?: string; end_month?: string }) => void;
}

type SortField = 'cohort_month' | 'total_customers' | 'recovery_rate';
type SortDirection = 'asc' | 'desc';

/**
 * CohortAnalysisTable Component
 * 
 * Displays cohort analysis data in a table format with recovery rates across billing cycles.
 * Highlights statistically insignificant cohorts (< 10 customers) and provides sorting/filtering.
 * 
 * Features:
 * - Data table with shadcn/ui Table component
 * - Display cohorts with recovery rates across billing cycles
 * - Highlight statistically insignificant cohorts with badges
 * - Sorting by cohort month, total customers, or recovery rate
 * - Date range filtering
 * - Loading skeleton during data fetch
 * - Error handling with toast notifications
 * - Responsive design
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * 
 * @example
 * ```tsx
 * <CohortAnalysisTable 
 *   initialStartMonth="2024-01"
 *   initialEndMonth="2024-12"
 *   onFiltersChange={(filters) => console.log(filters)}
 * />
 * ```
 */
export function CohortAnalysisTable({
  initialStartMonth,
  initialEndMonth,
  onFiltersChange,
}: CohortAnalysisTableProps) {
  const { toast } = useToast();
  
  // Filter state
  const [startMonth, setStartMonth] = useState(initialStartMonth);
  const [endMonth, setEndMonth] = useState(initialEndMonth);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('cohort_month');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch data with current filters
  const { data, isLoading, error, isError } = useCohortAnalysis(
    {
      start_month: startMonth,
      end_month: endMonth,
    }
  );

  // Show error toast when query fails
  if (isError && error) {
    toast({
      variant: 'destructive',
      title: 'Failed to load cohort data',
      description: error.message || 'An error occurred while fetching cohort analysis.',
    });
  }

  // Handle filter changes
  const handleStartMonthChange = (value: string) => {
    setStartMonth(value);
    onFiltersChange?.({ start_month: value, end_month: endMonth });
  };

  const handleEndMonthChange = (value: string) => {
    setEndMonth(value);
    onFiltersChange?.({ start_month: startMonth, end_month: value });
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort cohorts
  const sortedCohorts = useMemo(() => {
    if (!data?.cohorts) return [];

    const cohorts = [...data.cohorts];
    
    cohorts.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortField === 'cohort_month') {
        aValue = a.cohort_month;
        bValue = b.cohort_month;
      } else if (sortField === 'total_customers') {
        aValue = a.total_customers;
        bValue = b.total_customers;
      } else {
        // recovery_rate - calculate average across all billing cycles
        aValue = a.billing_cycles.length > 0
          ? a.billing_cycles.reduce((sum, cycle) => sum + cycle.recovery_rate, 0) / a.billing_cycles.length
          : 0;
        bValue = b.billing_cycles.length > 0
          ? b.billing_cycles.reduce((sum, cycle) => sum + cycle.recovery_rate, 0) / b.billing_cycles.length
          : 0;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return cohorts;
  }, [data?.cohorts, sortField, sortDirection]);

  // Generate month options for filters (last 24 months)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    
    return options;
  }, []);

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  // Calculate max billing cycles for table columns
  const maxBillingCycles = useMemo(() => {
    if (!sortedCohorts.length) return 0;
    return Math.max(...sortedCohorts.map(c => c.billing_cycles.length));
  }, [sortedCohorts]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Cohort Analysis</span>
          {data && (
            <div className="flex items-center gap-2 text-sm font-normal">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {data.cohorts.length} cohort{data.cohorts.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Track customer recovery rates by subscription start month across billing cycles
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Filter Controls */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Start Month Filter */}
          <div className="space-y-2">
            <Label htmlFor="start-month">Start Month</Label>
            <Select value={startMonth} onValueChange={handleStartMonthChange}>
              <SelectTrigger id="start-month">
                <SelectValue placeholder="Select start month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* End Month Filter */}
          <div className="space-y-2">
            <Label htmlFor="end-month">End Month</Label>
            <Select value={endMonth} onValueChange={handleEndMonthChange}>
              <SelectTrigger id="end-month">
                <SelectValue placeholder="Select end month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
            <h3 className="mb-2 text-lg font-semibold">Failed to load data</h3>
            <p className="text-sm text-muted-foreground">
              {error?.message || 'An error occurred while fetching cohort analysis.'}
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && sortedCohorts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No cohort data available</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your date range filters to see cohort analysis.
            </p>
          </div>
        )}

        {/* Table */}
        {!isLoading && !isError && sortedCohorts.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('cohort_month')}
                    >
                      Cohort Month
                      <SortIcon field="cohort_month" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[140px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('total_customers')}
                    >
                      Customers
                      <SortIcon field="total_customers" />
                    </Button>
                  </TableHead>
                  {Array.from({ length: maxBillingCycles }, (_, i) => (
                    <TableHead key={i} className="text-center">
                      Cycle {i + 1}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('recovery_rate')}
                    >
                      Avg Rate
                      <SortIcon field="recovery_rate" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCohorts.map((cohort) => {
                  // Calculate average recovery rate
                  const avgRecoveryRate = cohort.billing_cycles.length > 0
                    ? cohort.billing_cycles.reduce((sum, cycle) => sum + cycle.recovery_rate, 0) / cohort.billing_cycles.length
                    : 0;

                  return (
                    <TableRow
                      key={cohort.cohort_month}
                      className={!cohort.is_statistically_significant ? 'bg-muted/30' : ''}
                    >
                      <TableCell className="font-medium">
                        {new Date(cohort.cohort_month + '-01').toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {cohort.total_customers.toLocaleString()}
                        </div>
                      </TableCell>
                      {Array.from({ length: maxBillingCycles }, (_, i) => {
                        const cycle = cohort.billing_cycles.find(c => c.cycle_number === i + 1);
                        return (
                          <TableCell key={i} className="text-center">
                            {cycle ? (
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {cycle.recovery_rate.toFixed(1)}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {cycle.recovered}/{cycle.attempted}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {avgRecoveryRate.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {!cohort.is_statistically_significant ? (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Low Sample
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                            Significant
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary Stats */}
        {!isLoading && !isError && sortedCohorts.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-medium text-muted-foreground">
                Total Cohorts
              </div>
              <div className="mt-2 text-2xl font-bold">
                {sortedCohorts.length}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-medium text-muted-foreground">
                Total Customers
              </div>
              <div className="mt-2 text-2xl font-bold">
                {sortedCohorts.reduce((sum, c) => sum + c.total_customers, 0).toLocaleString()}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-medium text-muted-foreground">
                Statistically Significant
              </div>
              <div className="mt-2 text-2xl font-bold text-green-600">
                {sortedCohorts.filter(c => c.is_statistically_significant).length}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {((sortedCohorts.filter(c => c.is_statistically_significant).length / sortedCohorts.length) * 100).toFixed(0)}% of cohorts
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        {!isLoading && !isError && sortedCohorts.length > 0 && (
          <div className="mt-6 rounded-lg border bg-muted/30 p-4">
            <h4 className="mb-2 text-sm font-semibold">Legend</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                  Significant
                </Badge>
                <span>Cohorts with 10 or more customers (statistically significant)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Low Sample
                </Badge>
                <span>Cohorts with fewer than 10 customers (statistically insignificant)</span>
              </div>
              <div className="mt-3 text-xs">
                <strong>Note:</strong> Rows with low sample sizes are highlighted with a gray background.
                Recovery rates for these cohorts should be interpreted with caution.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
