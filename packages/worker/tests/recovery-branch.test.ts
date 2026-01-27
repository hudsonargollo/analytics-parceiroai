import { describe, it, expect } from 'vitest';
import { classifyRecoveryBranch } from '../src/lib/recovery-branch';

describe('classifyRecoveryBranch', () => {
  describe('Basic classification', () => {
    it('should classify as "3-day-notice" when due in exactly 3 days', () => {
      const result = classifyRecoveryBranch('2024-01-18', '2024-01-15');
      expect(result).toBe('3-day-notice');
    });

    it('should classify as "due-today" when due today', () => {
      const result = classifyRecoveryBranch('2024-01-15', '2024-01-15');
      expect(result).toBe('due-today');
    });

    it('should classify as "overdue" when past due date', () => {
      const result = classifyRecoveryBranch('2024-01-10', '2024-01-15');
      expect(result).toBe('overdue');
    });

    it('should classify as "overdue" when 1 day overdue', () => {
      const result = classifyRecoveryBranch('2024-01-14', '2024-01-15');
      expect(result).toBe('overdue');
    });

    it('should classify as "overdue" when many days overdue', () => {
      const result = classifyRecoveryBranch('2024-01-01', '2024-01-15');
      expect(result).toBe('overdue');
    });
  });

  describe('Default classification for other day differences', () => {
    it('should default to "3-day-notice" when due in 1 day', () => {
      const result = classifyRecoveryBranch('2024-01-16', '2024-01-15');
      expect(result).toBe('3-day-notice');
    });

    it('should default to "3-day-notice" when due in 2 days', () => {
      const result = classifyRecoveryBranch('2024-01-17', '2024-01-15');
      expect(result).toBe('3-day-notice');
    });

    it('should default to "3-day-notice" when due in 4 days', () => {
      const result = classifyRecoveryBranch('2024-01-19', '2024-01-15');
      expect(result).toBe('3-day-notice');
    });

    it('should default to "3-day-notice" when due in 7 days', () => {
      const result = classifyRecoveryBranch('2024-01-22', '2024-01-15');
      expect(result).toBe('3-day-notice');
    });

    it('should default to "3-day-notice" when due in 30 days', () => {
      const result = classifyRecoveryBranch('2024-02-14', '2024-01-15');
      expect(result).toBe('3-day-notice');
    });
  });

  describe('Timezone and time-of-day edge cases', () => {
    it('should handle ISO 8601 timestamps with time components', () => {
      // Due date at 10:30 AM, current date at 2:45 PM - should still be "due-today"
      const result = classifyRecoveryBranch(
        '2024-01-15T10:30:00Z',
        '2024-01-15T14:45:00Z'
      );
      expect(result).toBe('due-today');
    });

    it('should handle timestamps near midnight boundary', () => {
      // Due date at 23:59, current date at 00:01 next day - should be "overdue"
      const result = classifyRecoveryBranch(
        '2024-01-15T23:59:59Z',
        '2024-01-16T00:01:00Z'
      );
      expect(result).toBe('overdue');
    });

    it('should handle timestamps with different times on same day', () => {
      // Both on same day but different times - should be "due-today"
      const result = classifyRecoveryBranch(
        '2024-01-15T08:00:00Z',
        '2024-01-15T20:00:00Z'
      );
      expect(result).toBe('due-today');
    });

    it('should handle dates with timezone offsets', () => {
      // Dates with timezone info should normalize to UTC
      const result = classifyRecoveryBranch(
        '2024-01-18T00:00:00-03:00', // Brazilian time
        '2024-01-15T00:00:00-03:00'
      );
      expect(result).toBe('3-day-notice');
    });

    it('should handle dates without time component', () => {
      // Simple date strings without time
      const result = classifyRecoveryBranch('2024-01-18', '2024-01-15');
      expect(result).toBe('3-day-notice');
    });
  });

  describe('Month and year boundaries', () => {
    it('should handle month boundary correctly', () => {
      // Due Jan 2, current Dec 30 - should be 3 days
      const result = classifyRecoveryBranch('2024-01-02', '2023-12-30');
      expect(result).toBe('3-day-notice');
    });

    it('should handle year boundary correctly', () => {
      // Due Jan 3, current Dec 31 - should be 3 days
      const result = classifyRecoveryBranch('2024-01-03', '2023-12-31');
      expect(result).toBe('3-day-notice');
    });

    it('should handle leap year correctly', () => {
      // Due Mar 1, current Feb 27 (leap year) - should be 3 days
      const result = classifyRecoveryBranch('2024-03-01', '2024-02-27');
      expect(result).toBe('3-day-notice');
    });

    it('should handle non-leap year correctly', () => {
      // Due Mar 1, current Feb 26 (non-leap year) - should be 3 days
      const result = classifyRecoveryBranch('2023-03-01', '2023-02-26');
      expect(result).toBe('3-day-notice');
    });
  });

  describe('Default current date behavior', () => {
    it('should use current date when not provided', () => {
      // Create a date 3 days in the future
      const now = new Date();
      const threeDaysLater = new Date(now);
      threeDaysLater.setDate(now.getDate() + 3);
      
      const dueDateStr = threeDaysLater.toISOString().split('T')[0];
      const result = classifyRecoveryBranch(dueDateStr);
      
      expect(result).toBe('3-day-notice');
    });

    it('should classify as due-today when due date is today', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = classifyRecoveryBranch(today);
      
      expect(result).toBe('due-today');
    });

    it('should classify as overdue when due date was yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const result = classifyRecoveryBranch(yesterdayStr);
      
      expect(result).toBe('overdue');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle Brazilian payment scenario - Pix due in 3 days', () => {
      // Invoice created on Monday, due on Thursday
      const result = classifyRecoveryBranch('2024-01-18', '2024-01-15');
      expect(result).toBe('3-day-notice');
    });

    it('should handle Boleto due today scenario', () => {
      // Boleto due today, customer checking payment options
      const result = classifyRecoveryBranch('2024-01-15', '2024-01-15');
      expect(result).toBe('due-today');
    });

    it('should handle overdue subscription scenario', () => {
      // Subscription payment failed 5 days ago
      const result = classifyRecoveryBranch('2024-01-10', '2024-01-15');
      expect(result).toBe('overdue');
    });

    it('should handle weekend due date', () => {
      // Due on Saturday (Jan 20), checking on Wednesday (Jan 17)
      const result = classifyRecoveryBranch('2024-01-20', '2024-01-17');
      expect(result).toBe('3-day-notice');
    });
  });

  describe('Edge cases with invalid or unusual inputs', () => {
    it('should handle dates far in the past', () => {
      const result = classifyRecoveryBranch('2020-01-01', '2024-01-15');
      expect(result).toBe('overdue');
    });

    it('should handle dates far in the future', () => {
      const result = classifyRecoveryBranch('2025-01-15', '2024-01-15');
      expect(result).toBe('3-day-notice');
    });

    it('should handle same timestamp for both dates', () => {
      const timestamp = '2024-01-15T12:00:00Z';
      const result = classifyRecoveryBranch(timestamp, timestamp);
      expect(result).toBe('due-today');
    });
  });

  describe('Explicit branch parameter override', () => {
    it('should return explicit branch when provided, ignoring calculated branch', () => {
      // Due in 3 days, but explicitly set to "overdue"
      const result = classifyRecoveryBranch('2024-01-18', '2024-01-15', 'overdue');
      expect(result).toBe('overdue');
    });

    it('should return explicit "3-day-notice" even when due today', () => {
      // Due today, but explicitly set to "3-day-notice"
      const result = classifyRecoveryBranch('2024-01-15', '2024-01-15', '3-day-notice');
      expect(result).toBe('3-day-notice');
    });

    it('should return explicit "due-today" even when overdue', () => {
      // Overdue, but explicitly set to "due-today"
      const result = classifyRecoveryBranch('2024-01-10', '2024-01-15', 'due-today');
      expect(result).toBe('due-today');
    });

    it('should calculate branch normally when explicit branch is undefined', () => {
      // Due in 3 days, no explicit branch
      const result = classifyRecoveryBranch('2024-01-18', '2024-01-15', undefined);
      expect(result).toBe('3-day-notice');
    });

    it('should handle explicit branch with default current date', () => {
      // Using default current date with explicit branch
      const result = classifyRecoveryBranch('2024-01-18', undefined, 'overdue');
      expect(result).toBe('overdue');
    });

    it('should prioritize explicit branch over any date calculation', () => {
      // Far future date, but explicitly set to "overdue"
      const result = classifyRecoveryBranch('2025-12-31', '2024-01-15', 'overdue');
      expect(result).toBe('overdue');
    });

    it('should work with all three branch types as explicit values', () => {
      const dueDate = '2024-01-18';
      const currentDate = '2024-01-15';
      
      expect(classifyRecoveryBranch(dueDate, currentDate, '3-day-notice')).toBe('3-day-notice');
      expect(classifyRecoveryBranch(dueDate, currentDate, 'due-today')).toBe('due-today');
      expect(classifyRecoveryBranch(dueDate, currentDate, 'overdue')).toBe('overdue');
    });
  });
});
