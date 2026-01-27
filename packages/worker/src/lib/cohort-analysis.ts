/**
 * Cohort Analysis Calculation Module
 * 
 * Handles calculation of cohort-based recovery analysis from customer cohorts
 * and payment events. Groups customers by subscription start month and tracks
 * recovery rates across billing cycles.
 */

import { CohortAnalysisResponse } from '../types';

/**
 * Filter options for cohort analysis calculation
 */
export interface CohortAnalysisFilters {
  start_month?: string;  // YYYY-MM format
  end_month?: string;    // YYYY-MM format
}

/**
 * Parses month parameters and returns start and end months
 * If not provided, defaults to last 12 months
 * 
 * @param startMonth - Start month in YYYY-MM format
 * @param endMonth - End month in YYYY-MM format
 * @returns Object with start_month and end_month in YYYY-MM format
 */
function parseMonthRange(startMonth?: string, endMonth?: string): { start_month: string; end_month: string } {
  const now = new Date();
  
  // Default end month is current month
  const end_month = endMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  if (!startMonth) {
    // Default to 12 months ago
    const start = new Date(now);
    start.setMonth(start.getMonth() - 12);
    const start_month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    return { start_month, end_month };
  }
  
  return { start_month: startMonth, end_month };
}

/**
 * Extracts YYYY-MM format from ISO date string
 * 
 * @param isoDate - ISO 8601 date string
 * @returns Month in YYYY-MM format
 */
function extractMonth(isoDate: string): string {
  const date = new Date(isoDate);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calculates the billing cycle number for a payment event relative to cohort start
 * 
 * @param cohortMonth - Cohort month in YYYY-MM format
 * @param paymentMonth - Payment month in YYYY-MM format
 * @returns Billing cycle number (1-based)
 */
function calculateCycleNumber(cohortMonth: string, paymentMonth: string): number {
  const [cohortYear, cohortMonthNum] = cohortMonth.split('-').map(Number);
  const [paymentYear, paymentMonthNum] = paymentMonth.split('-').map(Number);
  
  const monthsDiff = (paymentYear - cohortYear) * 12 + (paymentMonthNum - cohortMonthNum);
  return monthsDiff + 1; // 1-based cycle number
}

/**
 * Calculates cohort-based recovery analysis.
 * 
 * This function:
 * - Groups customers by their subscription start month (cohort)
 * - Calculates recovery rates for each cohort across multiple billing cycles
 * - Includes total_customers, recovered_customers, and recovery_rate for each cycle
 * - Flags cohorts with < 10 customers as statistically insignificant
 * - Supports filtering by start_month and end_month
 * 
 * @param db - D1 Database instance
 * @param filters - Optional filters for month range
 * @returns Promise resolving to CohortAnalysisResponse with cohort metrics
 * 
 * @example
 * ```typescript
 * const cohortMetrics = await calculateCohortAnalysis(db, {
 *   start_month: '2024-01',
 *   end_month: '2024-12'
 * });
 * ```
 */
export async function calculateCohortAnalysis(
  db: D1Database,
  filters: CohortAnalysisFilters = {}
): Promise<CohortAnalysisResponse> {
  const { start_month, end_month } = parseMonthRange(filters.start_month, filters.end_month);
  
  // Query to get cohort data with payment events
  // We need to:
  // 1. Get all customers in each cohort
  // 2. Get their payment events
  // 3. Calculate recovery rates by billing cycle
  const query = `
    SELECT 
      cc.cohort_month,
      cc.customer_id,
      pe.created_at as payment_date,
      pe.status
    FROM customer_cohorts cc
    LEFT JOIN payment_events pe ON cc.customer_id = pe.customer_id
    WHERE cc.cohort_month >= ? AND cc.cohort_month <= ?
    ORDER BY cc.cohort_month, cc.customer_id, pe.created_at
  `;
  
  try {
    // Execute query
    const result = await db
      .prepare(query)
      .bind(start_month, end_month)
      .all<{
        cohort_month: string;
        customer_id: string;
        payment_date: string | null;
        status: string | null;
      }>();
    
    // If no results, return empty cohorts array
    if (!result.results || result.results.length === 0) {
      return {
        cohorts: [],
      };
    }
    
    // Group data by cohort
    const cohortMap = new Map<string, {
      customers: Set<string>;
      cycles: Map<number, { attempted: Set<string>; recovered: Set<string> }>;
    }>();
    
    for (const row of result.results) {
      const cohortMonth = row.cohort_month;
      const customerId = row.customer_id;
      
      // Initialize cohort if not exists
      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, {
          customers: new Set(),
          cycles: new Map(),
        });
      }
      
      const cohort = cohortMap.get(cohortMonth)!;
      cohort.customers.add(customerId);
      
      // If there's a payment event, process it
      if (row.payment_date && row.status) {
        const paymentMonth = extractMonth(row.payment_date);
        const cycleNumber = calculateCycleNumber(cohortMonth, paymentMonth);
        
        // Initialize cycle if not exists
        if (!cohort.cycles.has(cycleNumber)) {
          cohort.cycles.set(cycleNumber, {
            attempted: new Set(),
            recovered: new Set(),
          });
        }
        
        const cycle = cohort.cycles.get(cycleNumber)!;
        cycle.attempted.add(customerId);
        
        if (row.status === 'confirmed') {
          cycle.recovered.add(customerId);
        }
      }
    }
    
    // Build response
    const cohorts = Array.from(cohortMap.entries()).map(([cohortMonth, data]) => {
      const totalCustomers = data.customers.size;
      const isStatisticallySignificant = totalCustomers >= 10;
      
      // Build billing cycles array
      const billingCycles = Array.from(data.cycles.entries())
        .sort(([a], [b]) => a - b) // Sort by cycle number
        .map(([cycleNumber, cycleData]) => {
          const attempted = cycleData.attempted.size;
          const recovered = cycleData.recovered.size;
          const recoveryRate = attempted > 0 ? (recovered / attempted) * 100 : 0;
          
          return {
            cycle_number: cycleNumber,
            attempted,
            recovered,
            recovery_rate: Math.round(recoveryRate * 100) / 100, // Round to 2 decimal places
          };
        });
      
      return {
        cohort_month: cohortMonth,
        total_customers: totalCustomers,
        billing_cycles: billingCycles,
        is_statistically_significant: isStatisticallySignificant,
      };
    });
    
    return {
      cohorts,
    };
  } catch (error) {
    // Log error and re-throw
    console.error('Error calculating cohort analysis:', error);
    throw new Error(`Failed to calculate cohort analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
