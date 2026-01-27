# Component Examples

This directory contains example implementations of dashboard components to help developers understand how to integrate and use them effectively.

## Available Examples

### RecoveryRateChartExample.tsx

Comprehensive examples showing different ways to use the `RecoveryRateChart` component:

1. **BasicExample** - Simplest usage with default settings
2. **WithInitialFiltersExample** - Pre-configured with specific filters
3. **WithCallbackExample** - Track filter changes for analytics/URL sync
4. **DashboardGridExample** - Integration in a responsive dashboard grid
5. **ComparisonExample** - Multiple charts for branch comparison
6. **RealtimeExample** - Today's data with live indicator
7. **MobileExample** - Optimized for mobile devices
8. **CompleteDashboardExample** - Full dashboard implementation

## How to Use Examples

### Option 1: Import in App.tsx

```tsx
import { CompleteDashboardExample } from '@/examples/RecoveryRateChartExample';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CompleteDashboardExample />
      <Toaster />
    </QueryClientProvider>
  );
}
```

### Option 2: Copy and Customize

1. Copy the example code you want to use
2. Paste it into your component file
3. Customize as needed for your use case

### Option 3: Use as Reference

Browse the examples to understand:
- Component props and configuration
- Integration patterns
- Layout strategies
- Error handling approaches

## Running Examples

To see the examples in action:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Import the example in `src/App.tsx`:
   ```tsx
   import { BasicExample } from '@/examples/RecoveryRateChartExample';
   
   function App() {
     return (
       <QueryClientProvider client={queryClient}>
         <BasicExample />
         <Toaster />
       </QueryClientProvider>
     );
   }
   ```

3. Open http://localhost:5173 in your browser

## Prerequisites

Before using these examples, ensure:

1. **Environment Variables** are set in `.env`:
   ```env
   VITE_API_URL=http://localhost:8787
   VITE_API_KEY=your-api-key-here
   ```

2. **Backend API** is running and accessible

3. **Dependencies** are installed:
   ```bash
   npm install
   ```

## Example Structure

Each example follows this pattern:

```tsx
export function ExampleName() {
  // Optional: State management
  const [state, setState] = useState();
  
  // Optional: Event handlers
  const handleEvent = () => {
    // Handle events
  };
  
  return (
    <div className="container">
      {/* Component usage */}
      <RecoveryRateChart
        initialBranch="overdue"
        onFiltersChange={handleEvent}
      />
    </div>
  );
}
```

## Best Practices

### 1. Container Layout
Always wrap components in a container for proper spacing:
```tsx
<div className="container mx-auto p-6">
  <RecoveryRateChart />
</div>
```

### 2. Responsive Design
Use Tailwind's responsive utilities:
```tsx
<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <RecoveryRateChart />
</div>
```

### 3. Error Handling
The component handles errors internally, but you can add additional handling:
```tsx
<RecoveryRateChart
  onFiltersChange={(filters) => {
    try {
      // Your logic
    } catch (error) {
      console.error('Filter change error:', error);
    }
  }}
/>
```

### 4. Performance
For multiple charts, consider lazy loading:
```tsx
const RecoveryRateChart = lazy(() => 
  import('@/components').then(m => ({ default: m.RecoveryRateChart }))
);
```

## Common Patterns

### URL Synchronization
Keep filters in sync with URL parameters:
```tsx
const handleFiltersChange = (filters) => {
  const params = new URLSearchParams();
  if (filters.branch !== 'all') params.set('branch', filters.branch);
  if (filters.date_range) params.set('range', filters.date_range);
  window.history.pushState({}, '', `?${params.toString()}`);
};
```

### Analytics Tracking
Track user interactions:
```tsx
const handleFiltersChange = (filters) => {
  analytics.track('recovery_chart_filter_changed', {
    branch: filters.branch,
    date_range: filters.date_range,
    plan: filters.plan,
  });
};
```

### State Management
Share filters across components:
```tsx
const [globalFilters, setGlobalFilters] = useState({
  date_range: '30d',
  branch: 'all',
});

<RecoveryRateChart
  initialDateRange={globalFilters.date_range}
  initialBranch={globalFilters.branch}
  onFiltersChange={setGlobalFilters}
/>
```

## Troubleshooting

### Chart Not Rendering
- Check browser console for errors
- Verify API endpoint is accessible
- Ensure environment variables are set

### Filters Not Working
- Check that callback is properly connected
- Verify filter values are valid
- Check React Query cache

### Styling Issues
- Ensure Tailwind CSS is properly configured
- Check that shadcn/ui components are installed
- Verify CSS variables are defined

## Additional Resources

- [RecoveryRateChart Documentation](../components/RECOVERY_RATE_CHART_DOCUMENTATION.md)
- [React Query Documentation](https://tanstack.com/query/latest)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Recharts Documentation](https://recharts.org)

## Contributing

To add new examples:

1. Create a new example function in the appropriate file
2. Follow the existing naming convention
3. Add JSDoc comments explaining the example
4. Export the example at the bottom of the file
5. Update this README with the new example

## License

MIT

