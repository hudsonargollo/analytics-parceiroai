import { CohortAnalysisTable } from '@/components/CohortAnalysisTable';

/**
 * Example usage of the CohortAnalysisTable component
 * 
 * This example demonstrates:
 * - Basic usage with default settings
 * - Usage with initial date range filters
 * - Usage with filter change callback
 * - Integration in a dashboard layout
 */

// Example 1: Basic usage
export function BasicCohortAnalysisTableExample() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Cohort Analysis</h1>
      <CohortAnalysisTable />
    </div>
  );
}

// Example 2: With initial filters
export function FilteredCohortAnalysisTableExample() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Cohort Analysis - Last 6 Months</h1>
      <CohortAnalysisTable
        initialStartMonth="2024-01"
        initialEndMonth="2024-06"
      />
    </div>
  );
}

// Example 3: With filter change callback
export function InteractiveCohortAnalysisTableExample() {
  const handleFiltersChange = (filters: { start_month?: string; end_month?: string }) => {
    console.log('Filters changed:', filters);
    // You could update URL params, trigger analytics, etc.
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Interactive Cohort Analysis</h1>
      <CohortAnalysisTable
        initialStartMonth="2024-01"
        initialEndMonth="2024-12"
        onFiltersChange={handleFiltersChange}
      />
    </div>
  );
}

// Example 4: Dashboard integration
export function DashboardWithCohortAnalysisExample() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Subscription Recovery Dashboard</h1>
        <p className="text-muted-foreground">
          Track recovery metrics and cohort performance
        </p>
      </div>

      <div className="space-y-8">
        {/* Other dashboard components would go here */}
        
        <section>
          <h2 className="mb-4 text-2xl font-semibold">Cohort Analysis</h2>
          <CohortAnalysisTable
            initialStartMonth="2024-01"
            initialEndMonth="2024-12"
          />
        </section>
      </div>
    </div>
  );
}

// Example 5: Side-by-side comparison
export function ComparisonCohortAnalysisExample() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Cohort Comparison</h1>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Q1 2024</h2>
          <CohortAnalysisTable
            initialStartMonth="2024-01"
            initialEndMonth="2024-03"
          />
        </div>
        
        <div>
          <h2 className="mb-4 text-xl font-semibold">Q2 2024</h2>
          <CohortAnalysisTable
            initialStartMonth="2024-04"
            initialEndMonth="2024-06"
          />
        </div>
      </div>
    </div>
  );
}

// Default export for easy importing
export default BasicCohortAnalysisTableExample;
