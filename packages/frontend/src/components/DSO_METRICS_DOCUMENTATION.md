# DSOMetrics Component Documentation

## Overview

The `DSOMetrics` component displays Days Sales Outstanding (DSO) metrics with average and median values, along with a breakdown by recovery branch. It features animated metric changes using Framer Motion and provides comprehensive insights into payment timing across different communication stages.

## Features

- ✅ **Metric Cards**: Display average and median DSO with animated values
- ✅ **Branch Comparison**: Show DSO for each recovery branch (3-Day Notice, Due Today, Overdue)
- ✅ **Performance Indicators**: Highlight best and worst performing branches
- ✅ **Date Range Filter**: Filter data by time period (7d, 30d, 60d, 90d, today)
- ✅ **Animated Changes**: Smooth animations for metric updates using Framer Motion
- ✅ **Visual Progress Bars**: Animated bars showing relative DSO values
- ✅ **Key Insights**: Automatic analysis of DSO patterns and trends
- ✅ **Loading States**: Skeleton loaders during data fetch
- ✅ **Error Handling**: Toast notifications for errors
- ✅ **Responsive Design**: Mobile-friendly layout

## Requirements

Validates: **Requirements 3.4** - DSO Metrics Calculation and Display

## Installation

```tsx
import { DSOMetrics } from '@/components/DSOMetrics';
```

## Basic Usage

```tsx
// Simple usage with defaults
<DSOMetrics />

// With custom initial date range
<DSOMetrics initialDateRange="60d" />

// With filter change handler
<DSOMetrics
  initialDateRange="30d"
  onFiltersChange={(filters) => console.log('Filters changed:', filters)}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialDateRange` | `string` | `'30d'` | Initial date range filter. Options: `'7d'`, `'30d'`, `'60d'`, `'90d'`, `'today'` |
| `onFiltersChange` | `(filters: { date_range?: string }) => void` | `undefined` | Callback function called when filters change |

## Data Structure

The component expects data from the `useDSOMetrics` hook with the following structure:

```typescript
interface DSOResponse {
  date_range: string;
  average_dso: number;          // Days (average)
  median_dso: number;           // Days (median)
  by_branch: {
    '3-day-notice': number;     // DSO for 3-day notice branch
    'due-today': number;        // DSO for due today branch
    'overdue': number;          // DSO for overdue branch
  };
}
```

## Component Structure

### 1. Primary Metrics Section

Displays two main metric cards:

- **Average DSO**: Mean time to payment across all invoices
- **Median DSO**: Median time to payment (50th percentile)

Both cards feature:
- Large, animated numbers
- Descriptive labels
- Icon indicators
- Gradient backgrounds

### 2. DSO by Branch Section

Shows detailed breakdown for each recovery branch:

- **Branch Name**: 3-Day Notice, Due Today, or Overdue
- **DSO Value**: Days to payment for that branch
- **Performance Badge**: "Best" or "Slowest" indicator
- **Comparison**: Percentage difference from average
- **Visual Bar**: Animated progress bar showing relative performance

### 3. Key Insights Section

Automatically generated insights including:
- Average DSO interpretation
- Median DSO interpretation
- Branch performance comparison

## Animations

The component uses Framer Motion for smooth animations:

### Card Entrance
```typescript
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
};
```

### Number Updates
```typescript
const numberVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' }
  },
};
```

### Progress Bars
- Animate from 0 to calculated width
- Staggered delays for sequential appearance
- Color-coded based on performance

## Styling

### Branch Colors

```typescript
const BRANCH_COLORS = {
  '3-day-notice': 'text-green-600',
  'due-today': 'text-amber-600',
  'overdue': 'text-red-600',
};
```

### Performance Indicators

- **Best Branch**: Green border and background (`border-green-500/50 bg-green-50/50`)
- **Worst Branch**: Red border and background (`border-red-500/50 bg-red-50/50`)
- **Other Branches**: Default card styling

## States

### Loading State
- Displays skeleton loaders for metric cards and branch section
- Uses shadcn/ui `Skeleton` component

### Error State
- Shows error icon and message
- Displays error details from API
- Triggers toast notification

### Empty State
- Not applicable (DSO always returns data or error)

## Accessibility

- ✅ Proper label associations for form controls
- ✅ Descriptive text for screen readers
- ✅ Semantic HTML structure
- ✅ Keyboard navigation support
- ✅ ARIA labels where appropriate

## Performance Considerations

1. **React Query Caching**: Data is cached for 5 minutes by default
2. **Memoization**: Branch performance calculations are done once per render
3. **Conditional Rendering**: Only renders sections when data is available
4. **Optimized Animations**: Uses GPU-accelerated transforms

## Testing

The component includes comprehensive tests covering:

- ✅ Loading states
- ✅ Error states
- ✅ Data display
- ✅ Filter interactions
- ✅ Responsive design
- ✅ Edge cases (zero values, large values, decimal precision)
- ✅ Accessibility

Run tests with:
```bash
npm test DSOMetrics.test.tsx
```

## Examples

### Example 1: Dashboard Integration

```tsx
import { DSOMetrics } from '@/components/DSOMetrics';

function Dashboard() {
  return (
    <div className="grid gap-6">
      <DSOMetrics initialDateRange="30d" />
      {/* Other dashboard components */}
    </div>
  );
}
```

### Example 2: With State Management

```tsx
import { useState } from 'react';
import { DSOMetrics } from '@/components/DSOMetrics';

function AnalyticsPage() {
  const [filters, setFilters] = useState({ date_range: '30d' });

  return (
    <div>
      <h1>DSO Analysis</h1>
      <DSOMetrics
        initialDateRange={filters.date_range}
        onFiltersChange={setFilters}
      />
      <pre>{JSON.stringify(filters, null, 2)}</pre>
    </div>
  );
}
```

### Example 3: Real-time Monitoring

```tsx
import { DSOMetrics } from '@/components/DSOMetrics';

function RealtimeMonitor() {
  return (
    <div>
      <h1>Today's DSO</h1>
      <DSOMetrics initialDateRange="today" />
    </div>
  );
}
```

## Dependencies

- `react` - Core React library
- `@tanstack/react-query` - Data fetching and caching
- `framer-motion` - Animation library
- `lucide-react` - Icon library
- `@/components/ui/*` - shadcn/ui components
- `@/hooks/useDSOMetrics` - Custom React Query hook
- `@/hooks/use-toast` - Toast notification hook

## Related Components

- `RecoveryRateChart` - Displays recovery rates by branch
- `CohortAnalysisTable` - Shows cohort-based recovery analysis
- `Dashboard` - Main dashboard component that composes all metrics

## API Integration

The component uses the `useDSOMetrics` hook which calls:

```
GET /api/metrics/dso?date_range={date_range}
```

Response format:
```json
{
  "date_range": "30d",
  "average_dso": 15.5,
  "median_dso": 12.3,
  "by_branch": {
    "3-day-notice": 10.2,
    "due-today": 14.8,
    "overdue": 21.5
  }
}
```

## Troubleshooting

### Issue: Animations not working
**Solution**: Ensure `framer-motion` is installed and imported correctly. Check for CSS conflicts.

### Issue: Data not loading
**Solution**: Verify the API endpoint is accessible and returning correct data format. Check React Query DevTools.

### Issue: Toast notifications not appearing
**Solution**: Ensure `<Toaster />` component is rendered in your app root.

### Issue: Styling looks broken
**Solution**: Verify Tailwind CSS is configured correctly and all required classes are available.

## Future Enhancements

Potential improvements for future versions:

1. **Export Functionality**: Add ability to export DSO data as CSV/PDF
2. **Historical Comparison**: Show DSO trends over time with line charts
3. **Custom Thresholds**: Allow users to set DSO targets and alerts
4. **Drill-down**: Click on branches to see detailed customer-level data
5. **Forecasting**: Predict future DSO based on historical patterns
6. **Multi-currency Support**: Handle DSO for different currencies
7. **Custom Date Ranges**: Allow users to select arbitrary date ranges

## Changelog

### Version 1.0.0 (Current)
- Initial release
- Average and median DSO metrics
- DSO by branch comparison
- Date range filtering
- Framer Motion animations
- Comprehensive test coverage

## License

Part of the Subscription Recovery Analytics system.

## Support

For issues or questions, please refer to the main project documentation or contact the development team.
