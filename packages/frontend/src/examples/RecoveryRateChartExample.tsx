/**
 * Example usage of RecoveryRateChart component
 * 
 * This file demonstrates how to integrate the RecoveryRateChart
 * component into your dashboard or application.
 * 
 * To use this example:
 * 1. Import this component in your App.tsx or Dashboard.tsx
 * 2. Ensure QueryClientProvider is set up (already done in App.tsx)
 * 3. Ensure API_URL and API_KEY are configured in .env
 */

import { RecoveryRateChart } from '@/components';

/**
 * Example 1: Basic Usage
 * 
 * The simplest way to use the component with default settings.
 */
export function BasicExample() {
  return (
    <div className="container mx-auto p-6">
      <h2 className="mb-4 text-xl font-semibold">Basic Recovery Rate Chart</h2>
      <RecoveryRateChart />
    </div>
  );
}

/**
 * Example 2: With Initial Filters
 * 
 * Pre-configure the chart with specific filters.
 */
export function WithInitialFiltersExample() {
  return (
    <div className="container mx-auto p-6">
      <h2 className="mb-4 text-xl font-semibold">Overdue Recovery Analysis</h2>
      <RecoveryRateChart
        initialBranch="overdue"
        initialDateRange="60d"
        initialPlan="pro"
      />
    </div>
  );
}

/**
 * Example 3: With Filter Change Callback
 * 
 * Track filter changes for analytics or URL synchronization.
 */
export function WithCallbackExample() {
  const handleFiltersChange = (filters: {
    branch?: string;
    date_range?: string;
    plan?: string;
  }) => {
    console.log('Filters changed:', filters);
    
    // Example: Update URL parameters
    const params = new URLSearchParams();
    if (filters.branch && filters.branch !== 'all') {
      params.set('branch', filters.branch);
    }
    if (filters.date_range) {
      params.set('range', filters.date_range);
    }
    if (filters.plan && filters.plan !== 'all') {
      params.set('plan', filters.plan);
    }
    
    // Update URL without page reload
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
    
    // Example: Send to analytics
    // analytics.track('recovery_chart_filter_changed', filters);
  };

  return (
    <div className="container mx-auto p-6">
      <h2 className="mb-4 text-xl font-semibold">Interactive Recovery Chart</h2>
      <RecoveryRateChart onFiltersChange={handleFiltersChange} />
    </div>
  );
}

/**
 * Example 4: In a Dashboard Grid
 * 
 * Integrate with other dashboard components in a responsive grid.
 */
export function DashboardGridExample() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Recovery Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recovery Rate Chart */}
        <div className="lg:col-span-2">
          <RecoveryRateChart initialDateRange="30d" />
        </div>
        
        {/* Placeholder for other components */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold">DSO Metrics</h3>
          <p className="text-sm text-muted-foreground">Coming soon...</p>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold">Cohort Analysis</h3>
          <p className="text-sm text-muted-foreground">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Example 5: Multiple Charts with Different Filters
 * 
 * Show multiple recovery charts side-by-side for comparison.
 */
export function ComparisonExample() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Recovery Branch Comparison</h1>
      
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <RecoveryRateChart
          initialBranch="3-day-notice"
          initialDateRange="30d"
        />
        
        <RecoveryRateChart
          initialBranch="due-today"
          initialDateRange="30d"
        />
        
        <RecoveryRateChart
          initialBranch="overdue"
          initialDateRange="30d"
        />
      </div>
    </div>
  );
}

/**
 * Example 6: Real-time Today View
 * 
 * Show today's recovery data with real-time updates.
 */
export function RealtimeExample() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Today's Recovery Performance</h2>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          Live
        </span>
      </div>
      
      <RecoveryRateChart initialDateRange="today" />
    </div>
  );
}

/**
 * Example 7: Responsive Mobile View
 * 
 * Optimized layout for mobile devices.
 */
export function MobileExample() {
  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-semibold">Recovery Metrics</h2>
      <RecoveryRateChart initialDateRange="7d" />
    </div>
  );
}

/**
 * Complete Dashboard Example
 * 
 * Full dashboard implementation with all features.
 */
export function CompleteDashboardExample() {
  const handleFiltersChange = (filters: any) => {
    console.log('Dashboard filters changed:', filters);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Subscription Recovery Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Track and analyze subscription recovery performance
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Key Metrics Summary */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Overall Recovery Rate
            </div>
            <div className="mt-2 text-3xl font-bold">62.5%</div>
            <div className="mt-1 text-xs text-green-600">+5.2% from last month</div>
          </div>
          
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Total Recovered
            </div>
            <div className="mt-2 text-3xl font-bold">R$ 125,430</div>
            <div className="mt-1 text-xs text-green-600">+12.8% from last month</div>
          </div>
          
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Active Recoveries
            </div>
            <div className="mt-2 text-3xl font-bold">342</div>
            <div className="mt-1 text-xs text-muted-foreground">In progress</div>
          </div>
        </div>

        {/* Recovery Rate Chart */}
        <div className="mb-8">
          <RecoveryRateChart
            initialDateRange="30d"
            onFiltersChange={handleFiltersChange}
          />
        </div>

        {/* Additional Charts Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">DSO Metrics</h3>
            <p className="text-sm text-muted-foreground">
              Days Sales Outstanding analysis coming soon...
            </p>
          </div>
          
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Cohort Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Customer cohort recovery trends coming soon...
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Subscription Recovery Analytics © 2024
          </p>
        </div>
      </footer>
    </div>
  );
}

// Export all examples
export default {
  BasicExample,
  WithInitialFiltersExample,
  WithCallbackExample,
  DashboardGridExample,
  ComparisonExample,
  RealtimeExample,
  MobileExample,
  CompleteDashboardExample,
};
