# Recovery Rate Calculation Implementation

## Overview

The `calculateRecoveryRate` function provides analytics on payment recovery success rates across different recovery branches (3-day notice, due today, overdue) with support for flexible filtering and detailed breakdowns by payment method.

## Function Signature

```typescript
async function calculateRecoveryRate(
  db: D1Database,
  filters: RecoveryRateFilters = {}
): Promise<RecoveryRateResponse>
```

## Parameters

### `db: D1Database`
The Cloudflare D1 database instance containing payment events.

### `filters: RecoveryRateFilters` (optional)
An object containing optional filter parameters:

```typescript
interface RecoveryRateFilters {
  date_range?: string;          // e.g., "30d", "60d", "90d"
  subscription_plan?: string;   // Filter by subscription plan
  recovery_branch?: RecoveryBranch; // Filter by specific branch
}
```

**Filter Options:**
- `date_range`: Time period for analysis
  - Format: `"Xd"` where X is number of days (e.g., "30d", "60d", "90d")
  - Default: "30d" (last 30 days)
  
- `subscription_plan`: Filter results to specific subscription plan
  - Requires customer_cohorts table to be populated
  - Optional
  
- `recovery_branch`: Filter to specific recovery stage
  - Values: `"3-day-notice"`, `"due-today"`, `"overdue"`
  - Optional (returns all branches if not specified)

## Return Value

Returns a `RecoveryRateResponse` object:

```typescript
interface RecoveryRateResponse {
  branch: string;                      // Recovery branch or "all"
  date_range: string;                  // Date range used for calculation
  total_attempts: number;              // Total payment attempts
  successful_recoveries: number;       // Number of confirmed payments
  recovery_rate: number;               // Percentage (0-100)
  total_amount_attempted: number;      // Total amount in cents
  total_amount_recovered: number;      // Recovered amount in cents
  breakdown_by_method: {
    pix: { 
      attempts: number; 
      recoveries: number; 
      rate: number;
    };
    boleto: { 
      attempts: number; 
      recoveries: number; 
      rate: number;
    };
    credit_card: { 
      attempts: number; 
      recoveries: number; 
      rate: number;
    };
  };
}
```

## Usage Examples

### Basic Usage - All Branches, Last 30 Days

```typescript
const metrics = await calculateRecoveryRate(db);

console.log(`Recovery Rate: ${metrics.recovery_rate}%`);
console.log(`Total Attempts: ${metrics.total_attempts}`);
console.log(`Successful Recoveries: ${metrics.successful_recoveries}`);
```

### Filter by Recovery Branch

```typescript
const overdueMetrics = await calculateRecoveryRate(db, {
  recovery_branch: 'overdue'
});

console.log(`Overdue Recovery Rate: ${overdueMetrics.recovery_rate}%`);
```

### Custom Date Range

```typescript
const last60Days = await calculateRecoveryRate(db, {
  date_range: '60d'
});

console.log(`60-day Recovery Rate: ${last60Days.recovery_rate}%`);
```

### Filter by Subscription Plan

```typescript
const premiumMetrics = await calculateRecoveryRate(db, {
  subscription_plan: 'premium',
  date_range: '30d'
});

console.log(`Premium Plan Recovery Rate: ${premiumMetrics.recovery_rate}%`);
```

### Combined Filters

```typescript
const specificMetrics = await calculateRecoveryRate(db, {
  recovery_branch: 'overdue',
  subscription_plan: 'basic',
  date_range: '90d'
});
```

### Analyzing Payment Method Performance

```typescript
const metrics = await calculateRecoveryRate(db, {
  date_range: '30d'
});

console.log('Payment Method Performance:');
console.log(`Pix: ${metrics.breakdown_by_method.pix.rate}%`);
console.log(`Boleto: ${metrics.breakdown_by_method.boleto.rate}%`);
console.log(`Credit Card: ${metrics.breakdown_by_method.credit_card.rate}%`);
```

## Implementation Details

### SQL Query Structure

The function executes two SQL queries:

1. **Main Query**: Aggregates overall metrics by recovery branch
   - Counts total attempts
   - Counts successful recoveries (status = 'confirmed')
   - Calculates recovery rate percentage
   - Sums total amounts attempted and recovered

2. **Breakdown Query**: Aggregates metrics by payment method
   - Groups by payment_method (pix, boleto, credit_card)
   - Calculates attempts, recoveries, and rate for each method

### Date Range Parsing

The `parseDateRange` helper function converts the `date_range` parameter into ISO 8601 timestamps:

```typescript
// "30d" → { start_date: "2024-01-01T00:00:00.000Z", end_date: "2024-01-31T00:00:00.000Z" }
```

### Handling Missing Data

- If no payment events match the filters, returns zeros for all metrics
- If a payment method has no data, returns zeros for that method in the breakdown
- Always returns all three payment methods in the breakdown structure

### Error Handling

The function catches and re-throws database errors with descriptive messages:

```typescript
try {
  // Execute queries
} catch (error) {
  console.error('Error calculating recovery rate:', error);
  throw new Error(`Failed to calculate recovery rate: ${error.message}`);
}
```

## Database Requirements

### Required Tables

**payment_events**
- Must contain columns: `event_id`, `customer_id`, `amount`, `payment_method`, `status`, `recovery_branch`, `created_at`
- Status values: `'pending'`, `'confirmed'`, `'failed'`
- Payment method values: `'pix'`, `'boleto'`, `'credit_card'`

**customer_cohorts** (optional, for subscription_plan filtering)
- Must contain columns: `customer_id`, `subscription_plan`

### Required Indexes

For optimal performance, ensure these indexes exist:

```sql
CREATE INDEX idx_payment_created ON payment_events(created_at);
CREATE INDEX idx_payment_branch ON payment_events(recovery_branch);
CREATE INDEX idx_payment_status ON payment_events(status);
CREATE INDEX idx_payment_customer ON payment_events(customer_id);
```

## Performance Considerations

### Query Optimization

- Uses aggregate functions in SQL rather than application-level calculations
- Leverages indexes on `created_at`, `recovery_branch`, and `status` columns
- Single database round-trip for each query (main + breakdown)

### Caching Strategy

When used in API endpoints, results should be cached in KV:

```typescript
const cacheKey = `recovery_rate:${branch}:${date_range}:${plan}`;
let data = await KV.get(cacheKey, { type: 'json' });

if (!data) {
  data = await calculateRecoveryRate(db, filters);
  await KV.put(cacheKey, JSON.stringify(data), { 
    expirationTtl: 300  // 5 minutes
  });
}
```

### Expected Performance

- Query execution time: < 100ms for datasets up to 100K rows
- With proper indexes: < 500ms for datasets up to 1M rows
- Memory usage: Minimal (aggregation done in database)

## Testing

### Unit Tests

See `tests/recovery-rate.test.ts` for comprehensive unit tests covering:
- Basic recovery rate calculation
- Empty result handling
- 100% and 0% recovery rates
- All payment methods breakdown
- Missing payment methods
- Default date range behavior

### Manual Testing

Run manual tests with:

```bash
npx tsx tests/manual-test-recovery-rate.ts
```

### Integration Testing

Test with real database:

```typescript
// Insert test payment events
await insertPaymentEvent(db, {
  event_id: 'test_001',
  customer_id: 'cust_123',
  invoice_id: 'inv_456',
  amount: 5000,
  payment_method: 'pix',
  status: 'confirmed',
  due_date: '2024-01-20',
  timestamp: '2024-01-17T10:00:00Z'
});

// Calculate metrics
const metrics = await calculateRecoveryRate(db, {
  date_range: '30d'
});

// Verify results
assert(metrics.total_attempts > 0);
assert(metrics.recovery_rate >= 0 && metrics.recovery_rate <= 100);
```

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 3.2**: Supports filtering by date_range, subscription_plan, and recovery_branch
- **Requirement 3.3**: Calculates percentage of successful payments per total attempts for each branch

## Related Functions

- `insertPaymentEvent()` - Creates payment events that feed into recovery rate calculations
- `classifyRecoveryBranch()` - Determines the recovery branch for payment events
- `calculateDSO()` - Calculates Days Sales Outstanding metrics (to be implemented)
- `calculateCohortAnalysis()` - Provides cohort-based recovery analysis (to be implemented)

## Future Enhancements

1. **Trend Analysis**: Add time-series data to show recovery rate trends over time
2. **Comparison Metrics**: Compare current period to previous period
3. **Statistical Significance**: Flag results with insufficient sample size
4. **Predictive Metrics**: Estimate future recovery rates based on historical patterns
5. **Custom Aggregations**: Support grouping by custom dimensions (e.g., customer segment, region)
