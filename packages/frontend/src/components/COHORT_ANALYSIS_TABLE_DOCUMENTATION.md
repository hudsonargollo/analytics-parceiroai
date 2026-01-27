# CohortAnalysisTable Component Documentation

## Overview

The `CohortAnalysisTable` component displays cohort analysis data in a comprehensive table format, showing customer recovery rates grouped by subscription start month across multiple billing cycles. It provides sorting, filtering, and visual indicators for statistical significance.

## Features

- **Data Table**: Built with shadcn/ui Table component for consistent styling
- **Cohort Display**: Shows cohorts with recovery rates across billing cycles
- **Statistical Significance**: Highlights cohorts with fewer than 10 customers
- **Sorting**: Sort by cohort month, total customers, or average recovery rate
- **Filtering**: Date range filters for start and end months
- **Loading States**: Skeleton loaders during data fetch
- **Error Handling**: Toast notifications for errors
- **Responsive Design**: Adapts to different screen sizes
- **Summary Statistics**: Displays aggregate metrics

## Requirements Satisfied

- **Requirement 4.1**: Groups customers by subscription start month
- **Requirement 4.2**: Shows recovery rates across multiple billing cycles
- **Requirement 4.3**: Includes total customers, recovered customers, and recovery percentage
- **Requirement 4.4**: Flags cohorts with < 10 customers as statistically insignificant

## Props

```typescript
interface CohortAnalysisTableProps {
  /**
   * Optional initial start month filter (YYYY-MM format)
   */
  initialStartMonth?: string;
  
  /**
   * Optional initial end month filter (YYYY-MM format)
   */
  initialEndMonth?: string;
  
  /**
   * Optional callback when filters change
   */
  onFiltersChange?: (filters: { 
    start_month?: string; 
    end_month?: string 
  }) => void;
}
```

## Usage Examples

### Basic Usage

```tsx
import { CohortAnalysisTable } from '@/components/CohortAnalysisTable';

function Dashboard() {
  return <CohortAnalysisTable />;
}
```

### With Initial Filters

```tsx
<CohortAnalysisTable
  initialStartMonth="2024-01"
  initialEndMonth="2024-12"
/>
```

### With Filter Change Callback

```tsx
function Dashboard() {
  const handleFiltersChange = (filters) => {
    console.log('Filters changed:', filters);
    // Update URL params, trigger analytics, etc.
  };

  return (
    <CohortAnalysisTable
      initialStartMonth="2024-01"
      initialEndMonth="2024-12"
      onFiltersChange={handleFiltersChange}
    />
  );
}
```

## Data Structure

The component expects data from the `useCohortAnalysis` hook with the following structure:

```typescript
interface CohortAnalysisResponse {
  cohorts: Array<{
    cohort_month: string;       // YYYY-MM format
    total_customers: number;
    billing_cycles: Array<{
      cycle_number: number;
      attempted: number;
      recovered: number;
      recovery_rate: number;    // Percentage (0-100)
    }>;
    is_statistically_significant: boolean;
  }>;
}
```

## Visual Indicators

### Statistical Significance Badges

- **Significant** (Green): Cohorts with 10 or more customers
- **Low Sample** (Yellow): Cohorts with fewer than 10 customers

### Row Highlighting

Rows with statistically insignificant cohorts are highlighted with a gray background to draw attention to the limited sample size.

## Sorting

The table supports sorting by three fields:

1. **Cohort Month**: Sorts alphabetically by YYYY-MM format
2. **Total Customers**: Sorts numerically by customer count
3. **Average Recovery Rate**: Sorts by the average recovery rate across all billing cycles

Click a column header to sort by that field. Click again to toggle between ascending and descending order.

## Filtering

### Date Range Filters

- **Start Month**: Select the earliest cohort month to display
- **End Month**: Select the latest cohort month to display

The filters generate month options for the last 24 months automatically.

## States

### Loading State

Displays skeleton loaders while fetching data from the API.

### Error State

Shows an error message with the error details when data fetch fails. Also triggers a toast notification.

### Empty State

Displays a friendly message when no cohort data is available for the selected filters.

### Success State

Shows the full table with cohort data, summary statistics, and legend.

## Summary Statistics

The component displays three key metrics:

1. **Total Cohorts**: Number of cohorts in the current view
2. **Total Customers**: Sum of all customers across all cohorts
3. **Statistically Significant**: Count and percentage of significant cohorts

## Legend

A legend at the bottom explains the badge colors and row highlighting:

- Green badge: Statistically significant cohorts (≥10 customers)
- Yellow badge: Low sample size cohorts (<10 customers)
- Gray background: Rows with low sample sizes

## Accessibility

- Semantic HTML table structure
- Proper ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly

## Performance Considerations

- Uses React Query for automatic caching (5-minute stale time)
- Memoizes sorted data to prevent unnecessary re-renders
- Efficient sorting algorithm
- Responsive design with CSS Grid

## Testing

The component includes comprehensive tests covering:

- Loading, error, and empty states
- Data display and formatting
- Sorting functionality
- Filtering functionality
- Statistical significance highlighting
- Requirements validation
- Responsive design

Run tests with:

```bash
npm test CohortAnalysisTable.test.tsx
```

## Integration with Dashboard

The component is designed to work seamlessly with other dashboard components:

```tsx
import { RecoveryRateChart } from '@/components/RecoveryRateChart';
import { CohortAnalysisTable } from '@/components/CohortAnalysisTable';
import { DSOMetrics } from '@/components/DSOMetrics';

function Dashboard() {
  return (
    <div className="space-y-8">
      <RecoveryRateChart />
      <CohortAnalysisTable />
      <DSOMetrics />
    </div>
  );
}
```

## Customization

The component uses Tailwind CSS classes and can be customized by:

1. Modifying the color scheme in the badge variants
2. Adjusting spacing and sizing with Tailwind utilities
3. Extending the component with additional props
4. Overriding styles with custom CSS classes

## Dependencies

- React 18+
- @tanstack/react-query
- shadcn/ui components (Table, Card, Badge, Button, Select, Skeleton)
- Lucide React icons
- Tailwind CSS

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Known Limitations

1. Maximum of 24 months of historical data in filter dropdowns
2. Table may become horizontally scrollable with many billing cycles
3. Sorting is client-side only (not server-side)

## Future Enhancements

Potential improvements for future versions:

1. Export to CSV functionality
2. Drill-down to individual cohort details
3. Comparison mode for multiple date ranges
4. Custom cohort definitions (beyond subscription start month)
5. Trend indicators showing improvement/decline over time
6. Server-side sorting and pagination for large datasets

## Support

For issues or questions, please refer to:

- Component source: `packages/frontend/src/components/CohortAnalysisTable.tsx`
- Tests: `packages/frontend/src/components/CohortAnalysisTable.test.tsx`
- Examples: `packages/frontend/src/examples/CohortAnalysisTableExample.tsx`
- API hook: `packages/frontend/src/hooks/useCohortAnalysis.ts`
