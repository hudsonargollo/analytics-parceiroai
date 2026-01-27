/**
 * Recovery Rate Calculation Tests
 * 
 * Tests the calculateRecoveryRate function with various scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateRecoveryRate } from '../src/lib/recovery-rate';

// Mock D1 Database
class MockD1Database {
  private mockData: any[] = [];
  
  setMockData(data: any[]) {
    this.mockData = data;
  }
  
  prepare(query: string) {
    return {
      bind: (...params: any[]) => {
        return {
          first: async () => {
            // Return first result for main query
            if (this.mockData.length > 0 && this.mockData[0].recovery_branch) {
              return this.mockData[0];
            }
            return null;
          },
          all: async () => {
            // Return all results for breakdown query
            return { results: this.mockData.filter(row => row.payment_method) };
          },
        };
      },
    };
  }
}

describe('calculateRecoveryRate', () => {
  let mockDb: MockD1Database;
  
  beforeEach(() => {
    mockDb = new MockD1Database();
  });
  
  it('should calculate recovery rate with successful recoveries', async () => {
    // Mock data: 10 attempts, 7 successful
    mockDb.setMockData([
      {
        recovery_branch: 'overdue',
        total_attempts: 10,
        successful_recoveries: 7,
        recovery_rate: 70.0,
        total_amount_attempted: 50000,
        total_amount_recovered: 35000,
      },
      {
        payment_method: 'pix',
        attempts: 6,
        recoveries: 5,
        rate: 83.33,
      },
      {
        payment_method: 'boleto',
        attempts: 4,
        recoveries: 2,
        rate: 50.0,
      },
    ]);
    
    const result = await calculateRecoveryRate(mockDb as any, {
      date_range: '30d',
      recovery_branch: 'overdue',
    });
    
    expect(result.branch).toBe('overdue');
    expect(result.total_attempts).toBe(10);
    expect(result.successful_recoveries).toBe(7);
    expect(result.recovery_rate).toBe(70.0);
    expect(result.total_amount_attempted).toBe(50000);
    expect(result.total_amount_recovered).toBe(35000);
    expect(result.breakdown_by_method.pix.attempts).toBe(6);
    expect(result.breakdown_by_method.pix.recoveries).toBe(5);
    expect(result.breakdown_by_method.boleto.attempts).toBe(4);
    expect(result.breakdown_by_method.boleto.recoveries).toBe(2);
  });
  
  it('should return zeros when no data exists', async () => {
    mockDb.setMockData([]);
    
    const result = await calculateRecoveryRate(mockDb as any, {
      date_range: '30d',
    });
    
    expect(result.total_attempts).toBe(0);
    expect(result.successful_recoveries).toBe(0);
    expect(result.recovery_rate).toBe(0);
    expect(result.total_amount_attempted).toBe(0);
    expect(result.total_amount_recovered).toBe(0);
    expect(result.breakdown_by_method.pix.attempts).toBe(0);
    expect(result.breakdown_by_method.boleto.attempts).toBe(0);
    expect(result.breakdown_by_method.credit_card.attempts).toBe(0);
  });
  
  it('should handle 100% recovery rate', async () => {
    mockDb.setMockData([
      {
        recovery_branch: 'due-today',
        total_attempts: 5,
        successful_recoveries: 5,
        recovery_rate: 100.0,
        total_amount_attempted: 25000,
        total_amount_recovered: 25000,
      },
      {
        payment_method: 'pix',
        attempts: 5,
        recoveries: 5,
        rate: 100.0,
      },
    ]);
    
    const result = await calculateRecoveryRate(mockDb as any, {
      recovery_branch: 'due-today',
    });
    
    expect(result.recovery_rate).toBe(100.0);
    expect(result.total_attempts).toBe(result.successful_recoveries);
  });
  
  it('should handle 0% recovery rate', async () => {
    mockDb.setMockData([
      {
        recovery_branch: '3-day-notice',
        total_attempts: 8,
        successful_recoveries: 0,
        recovery_rate: 0.0,
        total_amount_attempted: 40000,
        total_amount_recovered: 0,
      },
      {
        payment_method: 'boleto',
        attempts: 8,
        recoveries: 0,
        rate: 0.0,
      },
    ]);
    
    const result = await calculateRecoveryRate(mockDb as any, {
      recovery_branch: '3-day-notice',
    });
    
    expect(result.recovery_rate).toBe(0.0);
    expect(result.successful_recoveries).toBe(0);
    expect(result.total_amount_recovered).toBe(0);
  });
  
  it('should use default date range of 30d when not specified', async () => {
    mockDb.setMockData([
      {
        recovery_branch: 'overdue',
        total_attempts: 3,
        successful_recoveries: 2,
        recovery_rate: 66.67,
        total_amount_attempted: 15000,
        total_amount_recovered: 10000,
      },
    ]);
    
    const result = await calculateRecoveryRate(mockDb as any);
    
    expect(result.date_range).toBe('30d');
  });
  
  it('should include breakdown for all payment methods', async () => {
    mockDb.setMockData([
      {
        recovery_branch: 'overdue',
        total_attempts: 15,
        successful_recoveries: 10,
        recovery_rate: 66.67,
        total_amount_attempted: 75000,
        total_amount_recovered: 50000,
      },
      {
        payment_method: 'pix',
        attempts: 8,
        recoveries: 6,
        rate: 75.0,
      },
      {
        payment_method: 'boleto',
        attempts: 5,
        recoveries: 3,
        rate: 60.0,
      },
      {
        payment_method: 'credit_card',
        attempts: 2,
        recoveries: 1,
        rate: 50.0,
      },
    ]);
    
    const result = await calculateRecoveryRate(mockDb as any);
    
    expect(result.breakdown_by_method.pix.attempts).toBe(8);
    expect(result.breakdown_by_method.pix.recoveries).toBe(6);
    expect(result.breakdown_by_method.pix.rate).toBe(75.0);
    
    expect(result.breakdown_by_method.boleto.attempts).toBe(5);
    expect(result.breakdown_by_method.boleto.recoveries).toBe(3);
    expect(result.breakdown_by_method.boleto.rate).toBe(60.0);
    
    expect(result.breakdown_by_method.credit_card.attempts).toBe(2);
    expect(result.breakdown_by_method.credit_card.recoveries).toBe(1);
    expect(result.breakdown_by_method.credit_card.rate).toBe(50.0);
  });
  
  it('should handle missing payment methods in breakdown', async () => {
    mockDb.setMockData([
      {
        recovery_branch: 'overdue',
        total_attempts: 5,
        successful_recoveries: 3,
        recovery_rate: 60.0,
        total_amount_attempted: 25000,
        total_amount_recovered: 15000,
      },
      {
        payment_method: 'pix',
        attempts: 5,
        recoveries: 3,
        rate: 60.0,
      },
      // No boleto or credit_card data
    ]);
    
    const result = await calculateRecoveryRate(mockDb as any);
    
    expect(result.breakdown_by_method.pix.attempts).toBe(5);
    expect(result.breakdown_by_method.boleto.attempts).toBe(0);
    expect(result.breakdown_by_method.credit_card.attempts).toBe(0);
  });
});
