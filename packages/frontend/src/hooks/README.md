# React Query Hooks

This directory contains React Query hooks for fetching and managing analytics data from the Subscription Recovery Analytics API.

## Overview

All hooks are built with React Query v5 and provide:
- **Automatic caching** with configurable stale times
- **Automatic refetching** on window focus and reconnect
- **Retry logic** with exponential backoff (3 attempts)
- **Error handling** with typed errors
- **TypeScript support** with full type safety

## Available Hooks

### Recovery Metrics

#### `useRecoveryMetrics(params, options)`

Fetches recovery rate metrics with optional filtering.

**Parameters:**
- `params` (optional): Query parameters
  - `branch?: string` - Filter by recovery branch ('3-day-notice', 'due-today', 'overdue')
  - `date_range?: string` - Date range filter (e.g., '30d', '60d', '90d')
  - `plan?: string` - Filter by subscription plan
- `options` (optional): Additional React Query options

**Returns:** Query result with `RecoveryRateResponse` data

**Example:**
```tsx
import { useRecoveryMetrics } from '@/hooks';

function RecoveryDashboard() {
  const { data, isLoading, error } = useRecoveryMetrics({
    branch: 'overdue',
    date_range: '30d'
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Recovery Rate: {data.recovery_rate}%</h2>
      <p>Total Attempts: {data.total_attempts}</p>
      <p>Successful Recoveries: {data.successful_recoveries}</p>
    </div>
  );
}
```

#### `useRecoveryMetricsRealtime(params, options)`

Variant for real-time data that bypasses cache and refetches every 30 seconds.

**Use case:** Current day queries where fresh data is critical

**Example:**
```tsx
const { data } = useRecoveryMetricsRealtime({
  date_range: 'today'
});
```

### DSO Metrics

#### `useDSOMetrics(params, options)`

Fetches Days Sales Outstanding (DSO) metrics.

**Parameters:**
- `params` (optional): Query parameters
  - `date_range?: string` - Date range filter
- `options` (optional): Additional React Query options

**Returns:** Query result with `DSOResponse` data

**Example:**
```tsx
import { useDSOMetrics } from '@/hooks';

function DSODashboard() {
  const { data, isLoading } = useDSOMetrics({
    date_range: '30d'
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Average DSO: {data.average_dso} days</h2>
      <h3>By Branch:</h3>
      <ul>
        <li>3-day notice: {data.by_branch['3-day-notice']} days</li>
        <li>Due today: {data.by_branch['due-today']} days</li>
        <li>Overdue: {data.by_branch['overdue']} days</li>
      </ul>
    </div>
  );
}
```

#### `useDSOMetricsRealtime(params, options)`

Variant for real-time DSO data.

#### `useDSOByBranch(params, options)`

Specialized hook that ensures `by_branch` data is always available with defaults.

### Cohort Analysis

#### `useCohortAnalysis(params, options)`

Fetches cohort analysis data grouped by subscription start month.

**Parameters:**
- `params` (optional): Query parameters
  - `start_month?: string` - Start month in YYYY-MM format
  - `end_month?: string` - End month in YYYY-MM format
- `options` (optional): Additional React Query options

**Returns:** Query result with `CohortAnalysisResponse` data

**Example:**
```tsx
import { useCohortAnalysis } from '@/hooks';

function CohortTable() {
  const { data, isLoading } = useCohortAnalysis({
    start_month: '2024-01',
    end_month: '2024-12'
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Cohort Month</th>
          <th>Total Customers</th>
          <th>Recovery Rate</th>
          <th>Significant?</th>
        </tr>
      </thead>
      <tbody>
        {data.cohorts.map((cohort) => (
          <tr key={cohort.cohort_month}>
            <td>{cohort.cohort_month}</td>
            <td>{cohort.total_customers}</td>
            <td>{cohort.billing_cycles[0]?.recovery_rate}%</td>
            <td>{cohort.is_statistically_significant ? 'Yes' : 'No'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### `useCohortMonth(cohortMonth, options)`

Fetches data for a specific cohort month.

**Parameters:**
- `cohortMonth`: Cohort month in YYYY-MM format
- `options` (optional): Additional React Query options

**Example:**
```tsx
const { data } = useCohortMonth('2024-06');
```

### Customer Billing

#### `useCustomerBilling(customerId, options)`

Fetches customer billing information for Chatwoot sidebar integration.

**Parameters:**
- `customerId`: Customer identifier
- `options` (optional): Additional React Query options

**Returns:** Query result with `CustomerBillingResponse` data

**Features:**
- Shorter stale time (1 minute) for frequently updated data
- Only fetches when `customerId` is provided
- Automatic refetching on window focus

**Example:**
```tsx
import { useCustomerBilling } from '@/hooks';

function BillingSidebar({ customerId }: { customerId: string }) {
  const { data, isLoading } = useCustomerBilling(customerId);

  if (isLoading) return <div>Loading billing info...</div>;

  return (
    <div>
      <h2>Outstanding Invoices</h2>
      <p>Total: R$ {data.total_outstanding / 100}</p>
      {data.outstanding_invoices.map((invoice) => (
        <div key={invoice.invoice_id}>
          <p>Amount: R$ {invoice.amount / 100}</p>
          <p>Due: {invoice.due_date}</p>
          <p>Status: {invoice.status}</p>
          {invoice.pix_code && (
            <button onClick={() => navigator.clipboard.writeText(invoice.pix_code!)}>
              Copy Pix Code
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

#### `useResendBoleto(options)`

Mutation hook for resending Boleto via n8n workflow.

**Returns:** Mutation result with `mutate` function

**Features:**
- Automatic retry on failure (3 attempts)
- Cache invalidation on success
- Optimistic updates support

**Example:**
```tsx
import { useResendBoleto } from '@/hooks';
import { useToast } from '@/hooks/use-toast';

function ResendBoletoButton({ customerId, invoiceId }: Props) {
  const { toast } = useToast();
  const { mutate, isPending } = useResendBoleto({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Boleto sent successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <button
      onClick={() => mutate({ customerId, invoiceId })}
      disabled={isPending}
    >
      {isPending ? 'Sending...' : 'Resend Boleto'}
    </button>
  );
}
```

#### `useHasOutstandingInvoices(customerId)`

Helper hook that returns boolean indicating if customer has outstanding invoices.

**Example:**
```tsx
const { data: hasOutstanding } = useHasOutstandingInvoices('customer-123');
if (hasOutstanding) {
  // Show payment options
}
```

#### `useOverdueInvoicesCount(customerId)`

Helper hook that returns count of overdue invoices.

**Example:**
```tsx
const { data: overdueCount } = useOverdueInvoicesCount('customer-123');
```

## Configuration

### Query Client

The global QueryClient is configured in `src/lib/queryClient.ts` with:

- **Default stale time:** 5 minutes
- **Default cache time:** 10 minutes
- **Retry attempts:** 3 with exponential backoff
- **Automatic refetching:** On window focus and reconnect

### Cache Strategy

- **Analytics metrics** (recovery rate, DSO, cohorts): 5-minute stale time
- **Customer billing data**: 1-minute stale time (frequently updated)
- **Real-time queries**: 0 stale time, refetch every 30 seconds
- **Current day queries**: Bypass cache entirely

### Helper Functions

The `queryClient.ts` file also exports helper functions:

```tsx
import {
  invalidateAnalyticsQueries,
  invalidateCustomerBillingQueries,
  prefetchRecoveryMetrics,
  prefetchDSOMetrics,
  prefetchCohortAnalysis,
} from '@/lib/queryClient';

// Invalidate all analytics caches
invalidateAnalyticsQueries();

// Invalidate specific customer billing cache
invalidateCustomerBillingQueries('customer-123');

// Prefetch data before navigation
await prefetchRecoveryMetrics({ branch: 'overdue', date_range: '30d' });
```

## Error Handling

All hooks handle errors gracefully:

```tsx
const { data, error, isError } = useRecoveryMetrics();

if (isError) {
  console.error('Failed to fetch recovery metrics:', error);
  // Show error UI
}
```

Errors are automatically retried 3 times with exponential backoff before failing.

## Testing

All hooks have comprehensive test coverage. See `*.test.tsx` files for examples.

Run tests:
```bash
npm test
```

## Type Safety

All hooks are fully typed with TypeScript. Import types from `@/types/api`:

```tsx
import type {
  RecoveryRateResponse,
  DSOResponse,
  CohortAnalysisResponse,
  CustomerBillingResponse,
} from '@/types/api';
```

## Best Practices

1. **Use the right hook variant:**
   - Use regular hooks for historical data
   - Use realtime variants for current day data
   - Use helper hooks for derived data

2. **Handle loading and error states:**
   ```tsx
   if (isLoading) return <Skeleton />;
   if (error) return <ErrorMessage error={error} />;
   ```

3. **Leverage caching:**
   - Don't refetch unnecessarily
   - Use prefetching for better UX
   - Invalidate caches after mutations

4. **Optimize performance:**
   - Use `select` option to transform data
   - Use `enabled` option for conditional fetching
   - Use `staleTime` and `gcTime` appropriately

## Requirements Validation

These hooks satisfy the following requirements:

- **Requirement 3.1:** Recovery rate API endpoint integration
- **Requirement 3.4:** DSO metrics API endpoint integration
- **Requirement 4.1:** Cohort analysis API endpoint integration
- **Requirement 5.1-5.5:** Chatwoot sidebar billing integration
- **Requirement 6.1:** Dashboard performance (2-second load time)
- **Requirement 6.2-6.3:** Caching strategy with 5-minute TTL
- **Requirement 6.4:** Current day cache bypass

## Related Files

- `src/lib/api.ts` - API client functions
- `src/lib/queryClient.ts` - QueryClient configuration
- `src/types/api.ts` - TypeScript type definitions
- `src/App.tsx` - QueryClientProvider setup
