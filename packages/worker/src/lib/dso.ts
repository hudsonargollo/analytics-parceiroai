/**
 * DSO (Days Sales Outstanding) Calculation Module
 * 
 * Handles calculation of DSO metrics from recovery logs with support for
 * filtering by date range and grouping by recovery branch.
 */

import { DSOResponse } from '../types';

/**
 * Filter options for DSO calculation
 */
export interface DSOFilters {
  date_range?: string;  // e.g., "30d", "60d", "90d", or ISO date range
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
 * Calculates median from an array of numbers
 * 
 * @param values - Array of numeric values
 * @returns Median value, or 0 if array is empty
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculates DSO (Days Sales Outstanding) metrics from recovery logs.
 * 
 * DSO measures the average number of days between invoice creation and payment.
 * This function:
 * - Queries recovery logs with payment data
 * - Calculates days between message_sent_at (invoice creation) and payment_received_at
 * - Computes average and median DSO overall and by recovery branch
 * - Supports filtering by date range
 * 
 * @param db - D1 Database instance
 * @param filters - Optional filters for date range
 * @returns Promise resolving to DSOResponse with average and median DSO metrics
 * 
 * @example
 * ```typescript
 * const dsoMetrics = await calculateDSO(db, {
 *   date_range: '30d'
 * });
 * ```
 */
export async function calculateDSO(
  db: D1Database,
  filters: DSOFilters = {}
): Promise<DSOResponse> {
  const { start_date, end_date } = parseDateRange(filters.date_range);
  
  // Query to calculate DSO by branch
  // We calculate the difference in days between message_sent_at and payment_received_at
  const query = `
    SELECT 
      recovery_branch,
      JULIANDAY(payment_received_at) - JULIANDAY(message_sent_at) as dso_days
    FROM recovery_logs
    WHERE payment_received_at IS NOT NULL
      AND message_sent_at IS NOT NULL
      AND created_at >= ? 
      AND created_at <= ?
    ORDER BY recovery_branch
  `;
  
  try {
    // Execute query
    const result = await db
      .prepare(query)
      .bind(start_date, end_date)
      .all<{
        recovery_branch: string;
        dso_days: number;
      }>();
    
    // If no results, return zeros
    if (!result.results || result.results.length === 0) {
      return {
        date_range: filters.date_range || '30d',
        average_dso: 0,
        median_dso: 0,
        by_branch: {
          '3-day-notice': 0,
          'due-today': 0,
          'overdue': 0,
        },
      };
    }
    
    // Group DSO values by branch
    const dsoByBranch: Record<string, number[]> = {
      '3-day-notice': [],
      'due-today': [],
      'overdue': [],
    };
    
    const allDsoValues: number[] = [];
    
    for (const row of result.results) {
      const branch = row.recovery_branch;
      const dso = row.dso_days;
      
      allDsoValues.push(dso);
      
      if (branch in dsoByBranch) {
        dsoByBranch[branch].push(dso);
      }
    }
    
    // Calculate overall average and median
    const average_dso = allDsoValues.length > 0
      ? allDsoValues.reduce((sum, val) => sum + val, 0) / allDsoValues.length
      : 0;
    
    const median_dso = calculateMedian(allDsoValues);
    
    // Calculate average DSO by branch
    const by_branch = {
      '3-day-notice': dsoByBranch['3-day-notice'].length > 0
        ? dsoByBranch['3-day-notice'].reduce((sum, val) => sum + val, 0) / dsoByBranch['3-day-notice'].length
        : 0,
      'due-today': dsoByBranch['due-today'].length > 0
        ? dsoByBranch['due-today'].reduce((sum, val) => sum + val, 0) / dsoByBranch['due-today'].length
        : 0,
      'overdue': dsoByBranch['overdue'].length > 0
        ? dsoByBranch['overdue'].reduce((sum, val) => sum + val, 0) / dsoByBranch['overdue'].length
        : 0,
    };
    
    return {
      date_range: filters.date_range || '30d',
      average_dso: Math.round(average_dso * 100) / 100, // Round to 2 decimal places
      median_dso: Math.round(median_dso * 100) / 100,   // Round to 2 decimal places
      by_branch: {
        '3-day-notice': Math.round(by_branch['3-day-notice'] * 100) / 100,
        'due-today': Math.round(by_branch['due-today'] * 100) / 100,
        'overdue': Math.round(by_branch['overdue'] * 100) / 100,
      },
    };
  } catch (error) {
    // Log error and re-throw
    console.error('Error calculating DSO:', error);
    throw new Error(`Failed to calculate DSO: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
