/**
 * Unit tests for Cohort Analysis calculation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateCohortAnalysis } from '../src/lib/cohort-analysis';

// Mock D1 Database
class MockD1Database {
  private data: any[] = [];

  setMockData(data: any[]) {
    this.data = data;
  }

  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        all: async () => ({
          results: this.data,
        }),
      }),
    };
  }
}

describe('calculateCohortAnalysis', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  it('should return empty cohorts array when no data exists', async () => {
    mockDb.setMockData([]);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toEqual([]);
  });

  it('should group customers by cohort month', async () => {
    mockDb.setMockData([
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: null, status: null },
      { cohort_month: '2024-01', customer_id: 'cust2', payment_date: null, status: null },
      { cohort_month: '2024-02', customer_id: 'cust3', payment_date: null, status: null },
    ]);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toHaveLength(2);
    expect(result.cohorts[0].cohort_month).toBe('2024-01');
    expect(result.cohorts[0].total_customers).toBe(2);
    expect(result.cohorts[1].cohort_month).toBe('2024-02');
    expect(result.cohorts[1].total_customers).toBe(1);
  });

  it('should calculate recovery rates for billing cycles', async () => {
    mockDb.setMockData([
      // Cohort 2024-01 with 2 customers
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: '2024-01-15T10:00:00Z', status: 'confirmed' },
      { cohort_month: '2024-01', customer_id: 'cust2', payment_date: '2024-01-20T10:00:00Z', status: 'pending' },
      // Cycle 2 (February)
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: '2024-02-15T10:00:00Z', status: 'confirmed' },
      { cohort_month: '2024-01', customer_id: 'cust2', payment_date: '2024-02-20T10:00:00Z', status: 'confirmed' },
    ]);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toHaveLength(1);
    const cohort = result.cohorts[0];
    
    expect(cohort.cohort_month).toBe('2024-01');
    expect(cohort.total_customers).toBe(2);
    expect(cohort.billing_cycles).toHaveLength(2);
    
    // Cycle 1 (January) - 1 recovered out of 2 attempted
    expect(cohort.billing_cycles[0].cycle_number).toBe(1);
    expect(cohort.billing_cycles[0].attempted).toBe(2);
    expect(cohort.billing_cycles[0].recovered).toBe(1);
    expect(cohort.billing_cycles[0].recovery_rate).toBe(50);
    
    // Cycle 2 (February) - 2 recovered out of 2 attempted
    expect(cohort.billing_cycles[1].cycle_number).toBe(2);
    expect(cohort.billing_cycles[1].attempted).toBe(2);
    expect(cohort.billing_cycles[1].recovered).toBe(2);
    expect(cohort.billing_cycles[1].recovery_rate).toBe(100);
  });

  it('should flag cohorts with < 10 customers as statistically insignificant', async () => {
    // Create a cohort with 9 customers
    const mockData = [];
    for (let i = 1; i <= 9; i++) {
      mockData.push({
        cohort_month: '2024-01',
        customer_id: `cust${i}`,
        payment_date: null,
        status: null,
      });
    }
    mockDb.setMockData(mockData);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toHaveLength(1);
    expect(result.cohorts[0].total_customers).toBe(9);
    expect(result.cohorts[0].is_statistically_significant).toBe(false);
  });

  it('should flag cohorts with >= 10 customers as statistically significant', async () => {
    // Create a cohort with 10 customers
    const mockData = [];
    for (let i = 1; i <= 10; i++) {
      mockData.push({
        cohort_month: '2024-01',
        customer_id: `cust${i}`,
        payment_date: null,
        status: null,
      });
    }
    mockDb.setMockData(mockData);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toHaveLength(1);
    expect(result.cohorts[0].total_customers).toBe(10);
    expect(result.cohorts[0].is_statistically_significant).toBe(true);
  });

  it('should handle multiple billing cycles correctly', async () => {
    mockDb.setMockData([
      // Customer 1 pays in cycles 1, 2, and 3
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: '2024-01-15T10:00:00Z', status: 'confirmed' },
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: '2024-02-15T10:00:00Z', status: 'confirmed' },
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: '2024-03-15T10:00:00Z', status: 'pending' },
    ]);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toHaveLength(1);
    const cohort = result.cohorts[0];
    
    expect(cohort.billing_cycles).toHaveLength(3);
    expect(cohort.billing_cycles[0].cycle_number).toBe(1);
    expect(cohort.billing_cycles[1].cycle_number).toBe(2);
    expect(cohort.billing_cycles[2].cycle_number).toBe(3);
  });

  it('should handle customers with no payment events', async () => {
    mockDb.setMockData([
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: null, status: null },
      { cohort_month: '2024-01', customer_id: 'cust2', payment_date: null, status: null },
    ]);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toHaveLength(1);
    expect(result.cohorts[0].total_customers).toBe(2);
    expect(result.cohorts[0].billing_cycles).toHaveLength(0);
  });

  it('should calculate recovery rate as 0 when no recoveries', async () => {
    mockDb.setMockData([
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: '2024-01-15T10:00:00Z', status: 'pending' },
      { cohort_month: '2024-01', customer_id: 'cust2', payment_date: '2024-01-20T10:00:00Z', status: 'failed' },
    ]);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toHaveLength(1);
    const cohort = result.cohorts[0];
    
    expect(cohort.billing_cycles).toHaveLength(1);
    expect(cohort.billing_cycles[0].attempted).toBe(2);
    expect(cohort.billing_cycles[0].recovered).toBe(0);
    expect(cohort.billing_cycles[0].recovery_rate).toBe(0);
  });

  it('should round recovery rate to 2 decimal places', async () => {
    mockDb.setMockData([
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: '2024-01-15T10:00:00Z', status: 'confirmed' },
      { cohort_month: '2024-01', customer_id: 'cust2', payment_date: '2024-01-20T10:00:00Z', status: 'pending' },
      { cohort_month: '2024-01', customer_id: 'cust3', payment_date: '2024-01-25T10:00:00Z', status: 'pending' },
    ]);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toHaveLength(1);
    const cohort = result.cohorts[0];
    
    // 1 recovered out of 3 = 33.333...%
    expect(cohort.billing_cycles[0].recovery_rate).toBe(33.33);
  });

  it('should handle multiple cohorts with different billing cycles', async () => {
    mockDb.setMockData([
      // Cohort 2024-01
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: '2024-01-15T10:00:00Z', status: 'confirmed' },
      { cohort_month: '2024-01', customer_id: 'cust1', payment_date: '2024-02-15T10:00:00Z', status: 'confirmed' },
      // Cohort 2024-02
      { cohort_month: '2024-02', customer_id: 'cust2', payment_date: '2024-02-15T10:00:00Z', status: 'confirmed' },
      { cohort_month: '2024-02', customer_id: 'cust2', payment_date: '2024-03-15T10:00:00Z', status: 'pending' },
    ]);

    const result = await calculateCohortAnalysis(mockDb as any, {
      start_month: '2024-01',
      end_month: '2024-12',
    });

    expect(result.cohorts).toHaveLength(2);
    
    // Cohort 2024-01 should have 2 cycles
    expect(result.cohorts[0].cohort_month).toBe('2024-01');
    expect(result.cohorts[0].billing_cycles).toHaveLength(2);
    
    // Cohort 2024-02 should have 2 cycles
    expect(result.cohorts[1].cohort_month).toBe('2024-02');
    expect(result.cohorts[1].billing_cycles).toHaveLength(2);
  });

  it('should throw error when database query fails', async () => {
    const errorDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => {
            throw new Error('Database connection failed');
          },
        }),
      }),
    };

    await expect(
      calculateCohortAnalysis(errorDb as any, {
        start_month: '2024-01',
        end_month: '2024-12',
      })
    ).rejects.toThrow('Failed to calculate cohort analysis');
  });
});
