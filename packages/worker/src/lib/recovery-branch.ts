import { RecoveryBranch } from '../types';

/**
 * Classifies a recovery branch based on the due date and current date.
 * 
 * Classification rules:
 * - If explicit branch is provided, it is returned directly (override behavior)
 * - "3-day-notice": Invoice is due in exactly 3 days
 * - "due-today": Invoice is due today (0 days difference)
 * - "overdue": Invoice is past due date (negative days difference)
 * - Default: "3-day-notice" for other cases (e.g., due in 1, 2, 4+ days)
 * 
 * Edge cases handled:
 * - Timezone considerations: Uses UTC for consistent date comparison
 * - Exact day boundaries: Compares dates at midnight (00:00:00)
 * - Normalizes both dates to start of day to avoid time-of-day issues
 * 
 * @param dueDate - ISO 8601 date string (e.g., "2024-01-15" or "2024-01-15T10:30:00Z")
 * @param currentDate - Optional ISO 8601 date string for current date (defaults to now)
 * @param explicitBranch - Optional explicit branch parameter to override calculation
 * @returns RecoveryBranch - One of "3-day-notice", "due-today", or "overdue"
 * 
 * @example
 * // Invoice due in 3 days
 * classifyRecoveryBranch("2024-01-18", "2024-01-15") // "3-day-notice"
 * 
 * @example
 * // Invoice due today
 * classifyRecoveryBranch("2024-01-15", "2024-01-15") // "due-today"
 * 
 * @example
 * // Invoice overdue
 * classifyRecoveryBranch("2024-01-10", "2024-01-15") // "overdue"
 * 
 * @example
 * // Explicit branch override
 * classifyRecoveryBranch("2024-01-18", "2024-01-15", "overdue") // "overdue"
 */
export function classifyRecoveryBranch(
  dueDate: string,
  currentDate: string = new Date().toISOString(),
  explicitBranch?: RecoveryBranch
): RecoveryBranch {
  // If explicit branch is provided, return it immediately
  if (explicitBranch) {
    return explicitBranch;
  }
  // Parse dates and normalize to UTC midnight to avoid timezone issues
  const due = new Date(dueDate);
  const now = new Date(currentDate);
  
  // Set both dates to midnight UTC for accurate day-level comparison
  // This ensures we're comparing dates, not timestamps
  due.setUTCHours(0, 0, 0, 0);
  now.setUTCHours(0, 0, 0, 0);
  
  // Calculate difference in days
  // Using UTC time to avoid DST and timezone issues
  const diffInMs = due.getTime() - now.getTime();
  const daysDiff = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  // Classify based on days difference
  if (daysDiff === 3) {
    return '3-day-notice';
  } else if (daysDiff === 0) {
    return 'due-today';
  } else if (daysDiff < 0) {
    return 'overdue';
  } else {
    // Default to 3-day-notice for other cases (1, 2, 4+ days)
    return '3-day-notice';
  }
}
