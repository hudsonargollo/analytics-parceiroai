import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DSOMetrics } from '@/components/DSOMetrics';
import { Toaster } from '@/components/ui/toaster';

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

/**
 * Example usage of the DSOMetrics component
 * 
 * This example demonstrates:
 * - Basic usage with default settings
 * - Custom initial date range
 * - Handling filter changes
 * - Integration with React Query
 */
export function DSOMetricsExample() {
  const [selectedFilters, setSelectedFilters] = useState<{ date_range?: string }>({
    date_range: '30d',
  });

  const handleFiltersChange = (filters: { date_range?: string }) => {
    console.log('Filters changed:', filters);
    setSelectedFilters(filters);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">DSO Metrics Example</h1>
          <p className="text-muted-foreground">
            Demonstrating the DSOMetrics component with various configurations
          </p>
        </div>

        {/* Example 1: Basic Usage */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Basic Usage</h2>
            <p className="text-sm text-muted-foreground">
              Default configuration with 30-day date range
            </p>
          </div>
          <DSOMetrics />
        </section>

        {/* Example 2: Custom Initial Date Range */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Custom Initial Date Range</h2>
            <p className="text-sm text-muted-foreground">
              Starting with 90-day date range
            </p>
          </div>
          <DSOMetrics initialDateRange="90d" />
        </section>

        {/* Example 3: With Filter Change Handler */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">With Filter Change Handler</h2>
            <p className="text-sm text-muted-foreground">
              Logs filter changes to console and displays current selection
            </p>
            <div className="mt-2 rounded-lg border bg-muted p-3">
              <p className="text-sm">
                <strong>Current filters:</strong>{' '}
                <code className="rounded bg-background px-2 py-1">
                  {JSON.stringify(selectedFilters, null, 2)}
                </code>
              </p>
            </div>
          </div>
          <DSOMetrics
            initialDateRange="30d"
            onFiltersChange={handleFiltersChange}
          />
        </section>

        {/* Example 4: Today's Data (Real-time) */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Today's Data (Real-time)</h2>
            <p className="text-sm text-muted-foreground">
              Shows current day data with cache bypass
            </p>
          </div>
          <DSOMetrics initialDateRange="today" />
        </section>

        {/* Usage Instructions */}
        <section className="space-y-4 rounded-lg border bg-muted/30 p-6">
          <h2 className="text-2xl font-semibold">Usage Instructions</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Installation</h3>
              <pre className="rounded-lg bg-background p-4 overflow-x-auto">
                <code>{`import { DSOMetrics } from '@/components/DSOMetrics';`}</code>
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Basic Example</h3>
              <pre className="rounded-lg bg-background p-4 overflow-x-auto">
                <code>{`<DSOMetrics />`}</code>
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">With Props</h3>
              <pre className="rounded-lg bg-background p-4 overflow-x-auto">
                <code>{`<DSOMetrics
  initialDateRange="60d"
  onFiltersChange={(filters) => console.log(filters)}
/>`}</code>
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Props</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>
                  <code className="rounded bg-background px-2 py-1">initialDateRange</code>
                  {' '}(optional): Initial date range filter. Options: '7d', '30d', '60d', '90d', 'today'. Default: '30d'
                </li>
                <li>
                  <code className="rounded bg-background px-2 py-1">onFiltersChange</code>
                  {' '}(optional): Callback function called when filters change. Receives an object with date_range property.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Features</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Displays average and median DSO metrics</li>
                <li>Shows DSO breakdown by recovery branch (3-Day Notice, Due Today, Overdue)</li>
                <li>Highlights best and worst performing branches</li>
                <li>Animated metric changes with Framer Motion</li>
                <li>Date range filtering</li>
                <li>Loading states with skeleton loaders</li>
                <li>Error handling with toast notifications</li>
                <li>Responsive design for mobile and desktop</li>
                <li>Key insights section with performance analysis</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Requirements</h3>
              <p className="text-sm">
                This component requires:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm mt-2">
                <li>React Query (TanStack Query) for data fetching</li>
                <li>Framer Motion for animations</li>
                <li>shadcn/ui components (Card, Select, Skeleton, etc.)</li>
                <li>Lucide React for icons</li>
                <li>The useDSOMetrics hook from @/hooks/useDSOMetrics</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Toast notifications */}
      <Toaster />
    </QueryClientProvider>
  );
}

export default DSOMetricsExample;
