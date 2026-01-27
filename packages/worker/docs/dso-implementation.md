# DSO (Days Sales Outstanding) Implementation

## Overview

The DSO calculation module provides metrics for measuring the average time between invoice creation and payment receipt. This is a critical metric for understanding cash flow efficiency and the effectiveness of different recovery branches.

## Implementation Details

### Function: `calculateDSO`

**Location:** `packages/worker/src/lib/dso.ts`

**Purpose:** Calculate average and median Days Sales Outstanding (DSO) metrics from recovery logs, grouped by recovery branch.

### How It Works

1. **Date Range Parsing**: Converts date range parameters (e.g., "30d", "60d") into ISO date strings
2. **SQL Query**: Queries the `recovery_logs` table to calculate the difference in days between `message_sent_at` (invoice creation) and `payment_received_at`
3. **Aggregation**: Groups DSO values by recovery branch and calculates:
   - Overall average DSO
   - Overall median DSO
   - Average DSO per branch (3-day-notice, due-today, overdue)
4. **Rounding**: Rounds all values to 2 decimal places for consistency

### SQL Query

```sql
SELECT 
  recovery_branch,
  JULIANDAY(payment_received_at) - JULIANDAY(message_sent_at) as dso_days
FROM recovery_logs
WHERE payment_received_at IS NOT NULL
  AND message_sent_at IS NOT NULL
  AND created_at >= ? 
  AND created_at <= ?
ORDER BY recovery_branch
```

**Key Points:**
- Uses SQLite's `JULIANDAY()` function to calculate date differences
- Filters out incomplete records (missing payment or message timestamps)
- Supports date range filtering via bind parameters

### Response Structure

```typescript
interface DSOResponse {
  date_range: string;           // e.g., "30d"
  average_dso: number;          // Overall average in days
  median_dso: number;           // Overall median in days
  by_branch: {
    '3-day-notice': number;     // Average DSO for 3-day-notice branch
    'due-today': number;        // Average DSO for due-today branch
    'overdue': number;          // Average DSO for overdue branch
  };
}
```

### Example Usage

```typescript
import { calculateDSO } from './lib/dso';

// Calculate DSO for last 30 days
const dsoMetrics = await calculateDSO(db, {
  date_range: '30d'
});

console.log(`Average DSO: ${dsoMetrics.average_dso} days`);
console.log(`Median DSO: ${dsoMetrics.median_dso} days`);
console.log(`Overdue branch DSO: ${dsoMetrics.by_branch.overdue} days`);
```

## Median Calculation

The median is calculated by:
1. Sorting all DSO values in ascending order
2. For odd-length arrays: returning the middle value
3. For even-length arrays: returning the average of the two middle values

This provides a more robust measure of central tendency that's less affected by outliers than the mean.

## Edge Cases Handled

1. **No Data**: Returns zeros for all metrics
2. **Missing Branches**: Branches with no data return 0
3. **Decimal Values**: All results rounded to 2 decimal places
4. **Single Data Point**: Correctly handles average and median
5. **Database Errors**: Catches and re-throws with descriptive error messages

## Testing

### Manual Tests

Run manual tests with:
```bash
npx tsx tests/manual-test-dso.ts
```

Tests cover:
- Basic DSO calculation
- DSO by branch
- Empty data handling
- Median calculation (even and odd number of values)
- Decimal rounding
- Single branch scenarios

### Unit Tests

Unit tests are available in `tests/dso.test.ts` and can be run with:
```bash
npm test -- dso.test.ts
```

## Integration with API

The `calculateDSO` function is designed to be called from the API endpoint:

```typescript
app.get('/api/metrics/dso',
  authenticateApiKey,
  rateLimiter(100),
  async (c) => {
    const { date_range } = c.req.query()
    const cacheKey = `dso:${date_range}`
    
    let data = await c.env.KV.get(cacheKey, { type: 'json' })
    if (!data) {
      data = await calculateDSO(c.env.DB, { date_range })
      await c.env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 })
    }
    
    return c.json(data)
  }
)
```

## Performance Considerations

1. **Index Usage**: The query uses indexes on `created_at` and `recovery_branch` for efficient filtering
2. **Filtering**: Only queries records with both `message_sent_at` and `payment_received_at` to avoid unnecessary processing
3. **Caching**: Results should be cached in KV for 5 minutes to reduce database load
4. **Date Range**: Supports flexible date ranges (30d, 60d, 90d, etc.)

## Requirements Validation

This implementation validates **Requirement 3.4**:
> WHEN querying DSO metrics, THE API SHALL calculate the average days between invoice creation and payment

The function:
- ✅ Calculates average days between invoice and payment
- ✅ Groups by recovery_branch
- ✅ Supports date_range filtering
- ✅ Returns DSOResponse with average and median DSO
- ✅ Handles edge cases gracefully

## Future Enhancements

Potential improvements:
1. Add percentile calculations (p50, p75, p90, p95)
2. Support filtering by payment method
3. Add trend analysis (DSO over time)
4. Include standard deviation for variability analysis
5. Add cohort-based DSO analysis
