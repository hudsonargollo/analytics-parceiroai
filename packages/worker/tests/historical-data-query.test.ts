/**
 * Historical Data Query Support Tests
 * 
 * Tests that all analytics queries support date ranges up to 24 months in the past.
 * Validates Requirements 8.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateRecoveryRate } from '../src/lib/recovery-rate';
import { calculateDSO } from '../src/lib/dso';
import { calculateCohortAnalysis } from '../src/lib/cohort-analysis';

// Mock D1 Database with support for historical data
class MockD1Database {
  private mockData: any[] = [];
  private lastQuery: string = '';
  private lastBindParams: any[] = [];
  
  setMockData(data: any[]) {
    this.mockData = data;
  }
  
  getLastQuery() {
    return this.lastQuery;
  }
  
  getLastBindParams() {
    return this.lastBindParams;
  }
  
  prepare(query: string) {
    this.lastQuery = query;
    return {
      bind: (...params: any[]) => {
        this.lastBindParams = params;
        return {
          first: async () => {
            // Return first result for main query
            if (this.mockData.length > 0 && this.mockData[0].recovery_branch) {
              return this.mockData[0];
            }
            return null;
          },
          all: async () => {
            // Return all results
            return { results: this.mockData };
          },
        };
      },
    };
  }
}

describe('Historical Data Query Support', () => {
  let mockDb: MockD1Database;
  
  beforeEach(() => {
    mockDb = new MockD1Database();
  });
  
  describe('Recovery Rate - Historical Data', () => {
    it('should support 24 month date range', async () => {
      // Mock data from 24 months ago
      const now = new Date();
      const twentyFourMonthsAgo = new Date(now);
      twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
      
      mockDb.setMockData([
        {
          recovery_branch: 'overdue',
          total_attempts: 100,
          successful_recoveries: 75,
          recovery_rate: 75.0,
          total_amount_attempted: 500000,
          total_amount_recovered: 375000,
        },
        {
          payment_method: 'pix',
          attempts: 60,
          recoveries: 50,
          rate: 83.33,
        },
      ]);
      
      // Query with 24 month range
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '730d', // ~24 months (730 days)
      });
      
      // Should successfully return results
      expect(result).toBeDefined();
      expect(result.total_attempts).toBe(100);
      expect(result.successful_recoveries).toBe(75);
      expect(result.recovery_rate).toBe(75.0);
      
      // Verify the query was executed with correct date range
      const bindParams = mockDb.getLastBindParams();
      expect(bindParams.length).toBeGreaterThan(0);
      
      // Verify start date is approximately 24 months ago
      const startDate = new Date(bindParams[0] as string);
      const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(720); // At least ~24 months
      expect(daysDiff).toBeLessThanOrEqual(740); // Not more than ~24.5 months
    });
    
    it('should support exact 24 month (730 day) date range', async () => {
      mockDb.setMockData([
        {
          recovery_branch: 'due-today',
          total_attempts: 50,
          successful_recoveries: 40,
          recovery_rate: 80.0,
          total_amount_attempted: 250000,
          total_amount_recovered: 200000,
        },
      ]);
      
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '730d',
      });
      
      expect(result).toBeDefined();
      expect(result.total_attempts).toBe(50);
      expect(result.date_range).toBe('730d');
    });
    
    it('should support 12 month date range', async () => {
      mockDb.setMockData([
        {
          recovery_branch: '3-day-notice',
          total_attempts: 80,
          successful_recoveries: 60,
          recovery_rate: 75.0,
          total_amount_attempted: 400000,
          total_amount_recovered: 300000,
        },
      ]);
      
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '365d',
      });
      
      expect(result).toBeDefined();
      expect(result.total_attempts).toBe(80);
      expect(result.date_range).toBe('365d');
    });
    
    it('should support 18 month date range', async () => {
      mockDb.setMockData([
        {
          recovery_branch: 'overdue',
          total_attempts: 120,
          successful_recoveries: 90,
          recovery_rate: 75.0,
          total_amount_attempted: 600000,
          total_amount_recovered: 450000,
        },
      ]);
      
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '547d', // ~18 months
      });
      
      expect(result).toBeDefined();
      expect(result.total_attempts).toBe(120);
    });
  });
  
  describe('DSO - Historical Data', () => {
    it('should support 24 month date range', async () => {
      // Mock DSO data from 24 months ago
      const now = new Date();
      const twentyFourMonthsAgo = new Date(now);
      twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
      
      mockDb.setMockData([
        {
          recovery_branch: '3-day-notice',
          dso_days: 5.5,
        },
        {
          recovery_branch: 'due-today',
          dso_days: 3.2,
        },
        {
          recovery_branch: 'overdue',
          dso_days: 15.8,
        },
      ]);
      
      const result = await calculateDSO(mockDb as any, {
        date_range: '730d',
      });
      
      // Should successfully return results
      expect(result).toBeDefined();
      expect(result.average_dso).toBeGreaterThan(0);
      expect(result.median_dso).toBeGreaterThan(0);
      expect(result.by_branch['3-day-notice']).toBeGreaterThan(0);
      expect(result.by_branch['due-today']).toBeGreaterThan(0);
      expect(result.by_branch['overdue']).toBeGreaterThan(0);
      
      // Verify the query was executed with correct date range
      const bindParams = mockDb.getLastBindParams();
      expect(bindParams.length).toBeGreaterThanOrEqual(2);
      
      // Verify start date is approximately 24 months ago
      const startDate = new Date(bindParams[0] as string);
      const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(720);
      expect(daysDiff).toBeLessThanOrEqual(740);
    });
    
    it('should support 12 month date range', async () => {
      mockDb.setMockData([
        {
          recovery_branch: 'overdue',
          dso_days: 12.5,
        },
      ]);
      
      const result = await calculateDSO(mockDb as any, {
        date_range: '365d',
      });
      
      expect(result).toBeDefined();
      expect(result.date_range).toBe('365d');
    });
    
    it('should support 18 month date range', async () => {
      mockDb.setMockData([
        {
          recovery_branch: 'due-today',
          dso_days: 4.8,
        },
      ]);
      
      const result = await calculateDSO(mockDb as any, {
        date_range: '547d',
      });
      
      expect(result).toBeDefined();
      expect(result.average_dso).toBeGreaterThan(0);
    });
  });
  
  describe('Cohort Analysis - Historical Data', () => {
    it('should support 24 month cohort range', async () => {
      // Mock cohort data from 24 months ago
      const now = new Date();
      const twentyFourMonthsAgo = new Date(now);
      twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
      
      const cohortMonth = `${twentyFourMonthsAgo.getFullYear()}-${String(twentyFourMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
      
      mockDb.setMockData([
        {
          cohort_month: cohortMonth,
          customer_id: 'cust_001',
          payment_date: twentyFourMonthsAgo.toISOString(),
          status: 'confirmed',
        },
        {
          cohort_month: cohortMonth,
          customer_id: 'cust_002',
          payment_date: twentyFourMonthsAgo.toISOString(),
          status: 'confirmed',
        },
        {
          cohort_month: cohortMonth,
          customer_id: 'cust_003',
          payment_date: twentyFourMonthsAgo.toISOString(),
          status: 'pending',
        },
      ]);
      
      const result = await calculateCohortAnalysis(mockDb as any, {
        start_month: cohortMonth,
        end_month: cohortMonth,
      });
      
      // Should successfully return results
      expect(result).toBeDefined();
      expect(result.cohorts).toBeDefined();
      expect(result.cohorts.length).toBeGreaterThan(0);
      
      // Verify the cohort month is correct
      const cohort = result.cohorts[0];
      expect(cohort.cohort_month).toBe(cohortMonth);
      expect(cohort.total_customers).toBe(3);
    });
    
    it('should support 12 month cohort range', async () => {
      const now = new Date();
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const startMonth = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
      const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      mockDb.setMockData([
        {
          cohort_month: startMonth,
          customer_id: 'cust_001',
          payment_date: twelveMonthsAgo.toISOString(),
          status: 'confirmed',
        },
      ]);
      
      const result = await calculateCohortAnalysis(mockDb as any, {
        start_month: startMonth,
        end_month: endMonth,
      });
      
      expect(result).toBeDefined();
      expect(result.cohorts).toBeDefined();
    });
    
    it('should support full 24 month cohort range', async () => {
      const now = new Date();
      const twentyFourMonthsAgo = new Date(now);
      twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
      
      const startMonth = `${twentyFourMonthsAgo.getFullYear()}-${String(twentyFourMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
      const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Create mock data for multiple cohorts across 24 months
      const mockData = [];
      for (let i = 0; i < 24; i++) {
        const cohortDate = new Date(twentyFourMonthsAgo);
        cohortDate.setMonth(cohortDate.getMonth() + i);
        const cohortMonth = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, '0')}`;
        
        mockData.push({
          cohort_month: cohortMonth,
          customer_id: `cust_${i}_001`,
          payment_date: cohortDate.toISOString(),
          status: 'confirmed',
        });
      }
      
      mockDb.setMockData(mockData);
      
      const result = await calculateCohortAnalysis(mockDb as any, {
        start_month: startMonth,
        end_month: endMonth,
      });
      
      expect(result).toBeDefined();
      expect(result.cohorts).toBeDefined();
      expect(result.cohorts.length).toBeGreaterThan(0);
    });
  });
  
  describe('Edge Cases - Historical Data', () => {
    it('should handle empty results for old date ranges', async () => {
      mockDb.setMockData([]);
      
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '730d',
      });
      
      expect(result).toBeDefined();
      expect(result.total_attempts).toBe(0);
      expect(result.successful_recoveries).toBe(0);
    });
    
    it('should handle very large date ranges (beyond 24 months)', async () => {
      mockDb.setMockData([
        {
          recovery_branch: 'overdue',
          total_attempts: 200,
          successful_recoveries: 150,
          recovery_rate: 75.0,
          total_amount_attempted: 1000000,
          total_amount_recovered: 750000,
        },
      ]);
      
      // Test with 36 months (3 years)
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '1095d', // ~36 months
      });
      
      expect(result).toBeDefined();
      expect(result.total_attempts).toBe(200);
    });
    
    it('should handle date ranges with partial months', async () => {
      mockDb.setMockData([
        {
          recovery_branch: 'due-today',
          total_attempts: 45,
          successful_recoveries: 30,
          recovery_rate: 66.67,
          total_amount_attempted: 225000,
          total_amount_recovered: 150000,
        },
      ]);
      
      // Test with 23.5 months (~715 days)
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '715d',
      });
      
      expect(result).toBeDefined();
      expect(result.total_attempts).toBe(45);
    });
  });
  
  describe('Date Range Parsing', () => {
    it('should correctly parse 730d as 24 months', async () => {
      mockDb.setMockData([
        {
          recovery_branch: 'overdue',
          total_attempts: 10,
          successful_recoveries: 8,
          recovery_rate: 80.0,
          total_amount_attempted: 50000,
          total_amount_recovered: 40000,
        },
      ]);
      
      await calculateRecoveryRate(mockDb as any, {
        date_range: '730d',
      });
      
      const bindParams = mockDb.getLastBindParams();
      const startDate = new Date(bindParams[0] as string);
      const endDate = new Date(bindParams[1] as string);
      
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(729);
      expect(daysDiff).toBeLessThanOrEqual(731);
    });
    
    it('should correctly parse 365d as 12 months', async () => {
      mockDb.setMockData([
        {
          recovery_branch: 'overdue',
          total_attempts: 10,
          successful_recoveries: 8,
          recovery_rate: 80.0,
          total_amount_attempted: 50000,
          total_amount_recovered: 40000,
        },
      ]);
      
      await calculateRecoveryRate(mockDb as any, {
        date_range: '365d',
      });
      
      const bindParams = mockDb.getLastBindParams();
      const startDate = new Date(bindParams[0] as string);
      const endDate = new Date(bindParams[1] as string);
      
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(364);
      expect(daysDiff).toBeLessThanOrEqual(366);
    });
  });
});
