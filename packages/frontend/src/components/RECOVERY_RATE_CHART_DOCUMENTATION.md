# RecoveryRateChart Component Documentation

## Overview

The `RecoveryRateChart` component is a comprehensive data visualization component that displays subscription recovery rates by branch using an interactive bar chart. It includes filter controls, loading states, error handling, and detailed breakdowns by payment method.

## Features

### 1. Interactive Bar Chart
- Built with Recharts library
- Displays recovery rate as a percentage
- Color-coded by recovery branch:
  - **3-day-notice**: Green (#10b981)
  - **due-today**: Amber (#f59e0b)
  - **overdue**: Red (#ef4444)
  - **all**: Blue (#3b82f6)
- Responsive design that adapts to container width
- Hover tooltips showing detailed information

### 2. Filter Controls
Three filter controls allow users to customize the data view:

#### Date Range Filter
- Last 7 days
- Last 30 days (default)
- Last 60 days
- Last 90 days
- Today (real-time data)

#### Recovery Branch Filter
- All Branches (default)
- 3-Day Notice
- Due Today
- Overdue

#### Subscription Plan Filter
- All Plans (default)
- Basic
- Pro
- Enterprise

### 3. Loading States
- Displays skeleton loaders during data fetch
- Skeleton for chart area (300px height)
- Skeleton for summary stats (3 cards)
- Smooth transition to loaded state

### 4. Error Handling
- Error state with icon and message
- Toast notifications for failed requests
- Retry capability through React Query
- User-friendly error messages

### 5. Summary Statistics
Three key metrics displayed below the chart:
- **Total Attempts**: Number of recovery attempts
- **Successful Recoveries**: Number of successful payments
- **Amount Recovered**: Total amount recovered in BRL

### 6. Payment Method Breakdown
Detailed breakdown showing recovery rates for each payment method:
- **Pix**: Brazilian instant payment
- **Boleto**: Brazilian bank slip
- **Credit Card**: Credit card payments

Each method shows:
- Recovery rate percentage
- Number of recoveries / total attempts

### 7. Trend Indicator
- Upward trend icon (green) for recovery rate > 50%
- Downward trend icon (red) for recovery rate ≤ 50%
- Displayed in card header with current recovery rate

## Props

```typescript
interface RecoveryRateChartProps {
  /**
   * Optional initial branch filter
   * @default 'all'
   */
  initialBranch?: string;
  
  /**
   * Optional initial date range filter
   * @default '30d'
   */
  initialDateRange?: string;
  
  /**
   * Optional initial plan filter
   * @default 'all'
   */
  initialPlan?: string;
  
  /**
   * Optional callback when filters change
   * Receives current filter values
   */
  onFiltersChange?: (filters: {
    branch?: string;
    date_range?: string;
    plan?: string;
  }) => void;
}
```

## Usage Examples

### Basic Usage
```tsx
import { RecoveryRateChart } from '@/components';

function Dashboard() {
  return <RecoveryRateChart />;
}
```

### With Initial Filters
```tsx
<RecoveryRateChart
  initialBranch="overdue"
  initialDateRange="60d"
  initialPlan="pro"
/>
```

### With Filter Change Callback
```tsx
function Dashboard() {
  const handleFiltersChange = (filters) => {
    console.log('Filters changed:', filters);
    // Update URL params, analytics, etc.
  };

  return (
    <RecoveryRateChart
      onFiltersChange={handleFiltersChange}
    />
  );
}
```

### In a Grid Layout
```tsx
function Dashboard() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <RecoveryRateChart initialDateRange="30d" />
      <DSOMetrics initialDateRange="30d" />
    </div>
  );
}
```

## Data Flow

1. **Component Mount**: Initializes with default or provided filter values
2. **Data Fetch**: `useRecoveryMetrics` hook fetches data from API
3. **Loading State**: Displays skeleton loaders while fetching
4. **Success State**: Renders chart and statistics with fetched data
5. **Error State**: Shows error message and triggers toast notification
6. **Filter Change**: Updates state and triggers new data fetch

## API Integration

The component uses the `useRecoveryMetrics` hook which:
- Fetches data from `/api/metrics/recovery-rate` endpoint
- Implements 5-minute cache (matches backend TTL)
- Retries failed requests with exponential backoff (3 attempts)
- Automatically refetches on window focus and reconnect

### Query Parameters
```typescript
{
  branch?: string;      // '3-day-notice' | 'due-today' | 'overdue'
  date_range?: string;  // '7d' | '30d' | '60d' | '90d' | 'today'
  plan?: string;        // 'basic' | 'pro' | 'enterprise'
}
```

### Response Format
```typescript
{
  branch: string;
  date_range: string;
  total_attempts: number;
  successful_recoveries: number;
  recovery_rate: number;        // Percentage (0-100)
  total_amount_attempted: number;
  total_amount_recovered: number;
  breakdown_by_method: {
    pix: { attempts: number; recoveries: number; rate: number };
    boleto: { attempts: number; recoveries: number; rate: number };
    credit_card: { attempts: number; recoveries: number; rate: number };
  };
}
```

## Styling

The component uses Tailwind CSS with shadcn/ui components:
- Responsive grid layouts
- Dark mode support via CSS variables
- Consistent spacing and typography
- Accessible color contrast ratios

### Customization
You can customize the appearance by:
1. Modifying the `BRANCH_COLORS` constant for different colors
2. Adjusting Tailwind classes in the component
3. Overriding CSS variables in your theme

## Accessibility

- Semantic HTML structure
- Proper ARIA labels on form controls
- Keyboard navigation support (via Radix UI)
- Screen reader friendly
- Color contrast meets WCAG AA standards

## Performance

### Optimizations
- React Query caching reduces API calls
- Memoized chart data preparation
- Lazy loading of Recharts components
- Efficient re-renders with proper dependencies

### Bundle Size
- Recharts: ~100KB (gzipped)
- Component code: ~5KB (gzipped)
- Total impact: ~105KB (gzipped)

## Testing

The component includes comprehensive tests:
- Loading state rendering
- Success state with data
- Error state handling
- Filter controls rendering
- Payment method breakdown
- Initial filter values
- Filter value handling ("all" → undefined)
- Trend indicator logic

Run tests:
```bash
npm test -- RecoveryRateChart.test.tsx
```

## Requirements Validation

This component validates the following requirements:

### Requirement 3.1: Recovery Metrics API
✅ Exposes recovery rate data through interactive visualization

### Requirement 3.2: Flexible Filtering
✅ Supports filtering by date_range, subscription_plan, and recovery_branch

### Requirement 3.3: Recovery Rate Calculation
✅ Displays calculated recovery rate percentage and breakdown

### Requirement 6.1: Dashboard Performance
✅ Renders within 2 seconds with skeleton loaders for perceived performance

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari, Chrome Android

## Known Limitations

1. **Chart Responsiveness**: Very small screens (<320px) may have cramped layouts
2. **Data Volume**: Performance may degrade with extremely large datasets (>10,000 records)
3. **Real-time Updates**: Requires manual refresh or window focus to update data
4. **Print Styles**: Chart may not render correctly when printing

## Future Enhancements

1. **Export Functionality**: Add CSV/PDF export of chart data
2. **Comparison Mode**: Compare multiple time periods side-by-side
3. **Drill-down**: Click on bars to see detailed transaction list
4. **Custom Date Ranges**: Allow users to select custom date ranges
5. **Annotations**: Add markers for significant events
6. **Multiple Charts**: Support multiple recovery branches in one chart

## Troubleshooting

### Chart Not Rendering
- Check browser console for errors
- Verify API endpoint is accessible
- Ensure data format matches expected structure

### Filters Not Working
- Check that `onFiltersChange` callback is properly connected
- Verify filter values are valid
- Check React Query cache for stale data

### Performance Issues
- Reduce date range to fetch less data
- Check network tab for slow API responses
- Consider implementing pagination for large datasets

## Related Components

- `DSOMetrics`: Displays Days Sales Outstanding metrics
- `CohortAnalysisTable`: Shows cohort-based recovery analysis
- `BillingSidebar`: Chatwoot integration for customer billing

## Support

For issues or questions:
1. Check this documentation
2. Review test files for usage examples
3. Check the API documentation
4. Contact the development team

## Changelog

### Version 1.0.0 (Current)
- Initial implementation
- Bar chart with Recharts
- Filter controls (date range, plan, branch)
- Loading skeleton
- Error handling with toast notifications
- Payment method breakdown
- Summary statistics
- Trend indicator
- Comprehensive test coverage

