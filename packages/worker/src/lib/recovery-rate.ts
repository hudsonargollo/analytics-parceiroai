/**
 * Recovery Rate Calculation Module
 * 
 * Handles calculation of recovery rates from payment events with support for
 * filtering by date range, subscription plan, and recovery branch.
 */

import { RecoveryRateResponse, RecoveryBranch } from '../types';

/**
 * Filter options for recovery rate calculation
 */
export interface RecoveryRateFilters {
  date_range?: string;          // e.g., "30d", "60d", "90d", or ISO date range
  subscription_plan?: string;   // Filter by subscription plan
  recovery_branch?: RecoveryBranch; // Filter by specific branch
}

/**
 * Parses date_range parameter and returns start and end dates
 * 
 * @param dateRange - Date range string (e.g., "30d", "60d", "90d")
 * @returns Object with start_date and end_date in ISO format
 */
function parseDateRange(dateRange?: string): { start_date: string; end_date: string } {
  const now = new Date();
  const end_date = now.toISOString();
  
  if (!dateRange) {
    // Default to 30 days
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { start_date: start.toISOString(), end_date };
  }
  
  // Parse "Xd" format (e.g., "30d", "60d", "90d")
  const daysMatch = dateRange.match(/^(\d+)d$/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return { start_date: start.toISOString(), end_date };
  }
  
  // If not in "Xd" format, assume it's already an ISO date or handle as needed
  // For now, default to 30 days if format is unrecognized
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  return { start_date: start.toISOString(), end_date };
}

/**
 * Calculates recovery rate metrics from payment events.
 * 
 * Features:
 * - Aggregates payment events by recovery branch
 * - Calculates total attempts, successful recoveries, and percentage
 * - Supports filtering by date_range, subscription_plan, recovery_branch
 * - Returns breakdown by payment method (pix, boleto, credit_card)
 * 
 * @param db - D1 Database instance
 * @param filters - Optional filters for date range, plan, and branch
 * @returns Promise resolving to RecoveryRateResponse with metrics
 * 
 * @example
 * ```typescript
 * const metrics = await calculateRecoveryRate(db, {
 *   date_range: '30d',
 *   recovery_branch: 'overdue'
 * });
 * ```
 */
export async function calculateRecoveryRate(
  db: D1Database,
  filters: RecoveryRateFilters = {}
): Promise<RecoveryRateResponse> {
  const { start_date, end_date } = parseDateRange(filters.date_range);
  
  // Build the main query to get overall metrics
  const mainQuery = `
    SELECT 
      recovery_branch,
      COUNT(*) as total_attempts,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as successful_recoveries,
      CAST(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as recovery_rate,
      SUM(amount) as total_amount_attempted,
      SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END) as total_amount_recovered
    FROM payment_events
    WHERE created_at >= ? AND created_at <= ?
      ${filters.recovery_branch ? 'AND recovery_branch = ?' : ''}
      ${filters.subscription_plan ? 'AND customer_id IN (SELECT customer_id FROM customer_cohorts WHERE subscription_plan = ?)' : ''}
    GROUP BY recovery_branch
  `;
  
  // Build the breakdown query for payment methods
  const breakdownQuery = `
    SELECT 
      payment_method,
      COUNT(*) as attempts,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as recoveries,
      CAST(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as rate
    FROM payment_events
    WHERE created_at >= ? AND created_at <= ?
      ${filters.recovery_branch ? 'AND recovery_branch = ?' : ''}
      ${filters.subscription_plan ? 'AND customer_id IN (SELECT customer_id FROM customer_cohorts WHERE subscription_plan = ?)' : ''}
    GROUP BY payment_method
  `;
  
  // Prepare bind parameters
  const bindParams: (string | number)[] = [start_date, end_date];
  if (filters.recovery_branch) {
    bindParams.push(filters.recovery_branch);
  }
  if (filters.subscription_plan) {
    bindParams.push(filters.subscription_plan);
  }
  
  try {
    // Execute main query
    const mainResult = await db
      .prepare(mainQuery)
      .bind(...bindParams)
      .first<{
        recovery_branch: string;
        total_attempts: number;
        successful_recoveries: number;
        recovery_rate: number;
        total_amount_attempted: number;
        total_amount_recovered: number;
      }>();
    
    // Execute breakdown query
    const breakdownResult = await db
      .prepare(breakdownQuery)
      .bind(...bindParams)
      .all<{
        payment_method: string;
        attempts: number;
        recoveries: number;
        rate: number;
      }>();
    
    // Initialize breakdown structure
    const breakdown = {
      pix: { attempts: 0, recoveries: 0, rate: 0 },
      boleto: { attempts: 0, recoveries: 0, rate: 0 },
      credit_card: { attempts: 0, recoveries: 0, rate: 0 },
    };
    
    // Populate breakdown from query results
    if (breakdownResult.results) {
      for (const row of breakdownResult.results) {
        const method = row.payment_method as 'pix' | 'boleto' | 'credit_card';
        if (method in breakdown) {
          breakdown[method] = {
            attempts: row.attempts,
            recoveries: row.recoveries,
            rate: row.rate || 0,
          };
        }
      }
    }
    
    // If no results, return zeros
    if (!mainResult) {
      return {
        branch: filters.recovery_branch || 'all',
        date_range: filters.date_range || '30d',
        total_attempts: 0,
        successful_recoveries: 0,
        recovery_rate: 0,
        total_amount_attempted: 0,
        total_amount_recovered: 0,
        breakdown_by_method: breakdown,
      };
    }
    
    // Return the response
    return {
      branch: mainResult.recovery_branch || filters.recovery_branch || 'all',
      date_range: filters.date_range || '30d',
      total_attempts: mainResult.total_attempts,
      successful_recoveries: mainResult.successful_recoveries,
      recovery_rate: mainResult.recovery_rate || 0,
      total_amount_attempted: mainResult.total_amount_attempted,
      total_amount_recovered: mainResult.total_amount_recovered,
      breakdown_by_method: breakdown,
    };
  } catch (error) {
    // Log error and re-throw
    console.error('Error calculating recovery rate:', error);
    throw new Error(`Failed to calculate recovery rate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
