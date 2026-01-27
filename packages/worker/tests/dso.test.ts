/**
 * Unit tests for DSO calculation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDSO } from '../src/lib/dso';

// Mock D1 Database
class MockD1Database {
  private mockResults: any[] = [];

  setMockResults(results: any[]) {
    this.mockResults = results;
  }

  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        all: async () => ({
          results: this.mockResults,
        }),
      }),
    };
  }
}

describe('calculateDSO', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  it('should calculate average and median DSO correctly', async () => {
    // Mock data: 3 recovery logs with different DSO values
    mockDb.setMockResults([
      { recovery_branch: '3-day-notice', dso_days: 2 },
      { recovery_branch: 'due-today', dso_days: 4 },
      { recovery_branch: 'overdue', dso_days: 6 },
    ]);

    const result = await calculateDSO(mockDb as any, { date_range: '30d' });

    // Average: (2 + 4 + 6) / 3 = 4
    expect(result.average_dso).toBe(4);
    // Median: 4 (middle value)
    expect(result.median_dso).toBe(4);
    expect(result.date_range).toBe('30d');
  });

  it('should calculate DSO by branch correctly', async () => {
    mockDb.setMockResults([
      { recovery_branch: '3-day-notice', dso_days: 2 },
      { recovery_branch: '3-day-notice', dso_days: 4 },
      { recovery_branch: 'due-today', dso_days: 3 },
      { recovery_branch: 'overdue', dso_days: 10 },
      { recovery_branch: 'overdue', dso_days: 8 },
    ]);

    const result = await calculateDSO(mockDb as any, { date_range: '30d' });

    // 3-day-notice: (2 + 4) / 2 = 3
    expect(result.by_branch['3-day-notice']).toBe(3);
    // due-today: 3 / 1 = 3
    expect(result.by_branch['due-today']).toBe(3);
    // overdue: (10 + 8) / 2 = 9
    expect(result.by_branch['overdue']).toBe(9);
  });

  it('should return zeros when no data is available', async () => {
    mockDb.setMockResults([]);

    const result = await calculateDSO(mockDb as any, { date_range: '30d' });

    expect(result.average_dso).toBe(0);
    expect(result.median_dso).toBe(0);
    expect(result.by_branch['3-day-notice']).toBe(0);
    expect(result.by_branch['due-today']).toBe(0);
    expect(result.by_branch['overdue']).toBe(0);
  });

  it('should calculate median correctly for even number of values', async () => {
    mockDb.setMockResults([
      { recovery_branch: '3-day-notice', dso_days: 2 },
      { recovery_branch: 'due-today', dso_days: 4 },
      { recovery_branch: 'overdue', dso_days: 6 },
      { recovery_branch: 'overdue', dso_days: 8 },
    ]);

    const result = await calculateDSO(mockDb as any, { date_range: '30d' });

    // Median of [2, 4, 6, 8] = (4 + 6) / 2 = 5
    expect(result.median_dso).toBe(5);
  });

  it('should calculate median correctly for odd number of values', async () => {
    mockDb.setMockResults([
      { recovery_branch: '3-day-notice', dso_days: 1 },
      { recovery_branch: 'due-today', dso_days: 3 },
      { recovery_branch: 'overdue', dso_days: 5 },
    ]);

    const result = await calculateDSO(mockDb as any, { date_range: '30d' });

    // Median of [1, 3, 5] = 3
    expect(result.median_dso).toBe(3);
  });

  it('should handle branches with no data', async () => {
    mockDb.setMockResults([
      { recovery_branch: '3-day-notice', dso_days: 5 },
      { recovery_branch: '3-day-notice', dso_days: 7 },
    ]);

    const result = await calculateDSO(mockDb as any, { date_range: '30d' });

    // Only 3-day-notice has data
    expect(result.by_branch['3-day-notice']).toBe(6); // (5 + 7) / 2
    expect(result.by_branch['due-today']).toBe(0);
    expect(result.by_branch['overdue']).toBe(0);
  });

  it('should round results to 2 decimal places', async () => {
    mockDb.setMockResults([
      { recovery_branch: '3-day-notice', dso_days: 2.333 },
      { recovery_branch: 'due-today', dso_days: 4.666 },
      { recovery_branch: 'overdue', dso_days: 6.999 },
    ]);

    const result = await calculateDSO(mockDb as any, { date_range: '30d' });

    // Average: (2.333 + 4.666 + 6.999) / 3 = 4.666 -> 4.67
    expect(result.average_dso).toBe(4.67);
    // Check that values are rounded
    expect(result.by_branch['3-day-notice']).toBe(2.33);
    expect(result.by_branch['due-today']).toBe(4.67);
    expect(result.by_branch['overdue']).toBe(7);
  });

  it('should use default date range of 30d when not specified', async () => {
    mockDb.setMockResults([
      { recovery_branch: '3-day-notice', dso_days: 5 },
    ]);

    const result = await calculateDSO(mockDb as any);

    expect(result.date_range).toBe('30d');
  });

  it('should handle custom date ranges', async () => {
    mockDb.setMockResults([
      { recovery_branch: '3-day-notice', dso_days: 5 },
    ]);

    const result = await calculateDSO(mockDb as any, { date_range: '60d' });

    expect(result.date_range).toBe('60d');
  });

  it('should throw error when database query fails', async () => {
    // Create a mock that throws an error
    const errorDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => {
            throw new Error('Database connection failed');
          },
        }),
      }),
    };

    await expect(calculateDSO(errorDb as any, { date_range: '30d' }))
      .rejects
      .toThrow('Failed to calculate DSO: Database connection failed');
  });

  it('should handle single data point correctly', async () => {
    mockDb.setMockResults([
      { recovery_branch: 'overdue', dso_days: 7.5 },
    ]);

    const result = await calculateDSO(mockDb as any, { date_range: '30d' });

    expect(result.average_dso).toBe(7.5);
    expect(result.median_dso).toBe(7.5);
    expect(result.by_branch['overdue']).toBe(7.5);
    expect(result.by_branch['3-day-notice']).toBe(0);
    expect(result.by_branch['due-today']).toBe(0);
  });

  it('should handle large datasets efficiently', async () => {
    // Generate 1000 data points
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      recovery_branch: ['3-day-notice', 'due-today', 'overdue'][i % 3],
      dso_days: Math.random() * 30,
    }));

    mockDb.setMockResults(largeDataset);

    const result = await calculateDSO(mockDb as any, { date_range: '30d' });

    // Just verify it completes without error and returns valid structure
    expect(result.average_dso).toBeGreaterThanOrEqual(0);
    expect(result.median_dso).toBeGreaterThanOrEqual(0);
    expect(result.by_branch['3-day-notice']).toBeGreaterThanOrEqual(0);
    expect(result.by_branch['due-today']).toBeGreaterThanOrEqual(0);
    expect(result.by_branch['overdue']).toBeGreaterThanOrEqual(0);
  });
});
