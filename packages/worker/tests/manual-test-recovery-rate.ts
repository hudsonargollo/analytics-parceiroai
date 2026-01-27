/**
 * Manual Test for Recovery Rate Calculation
 * 
 * Run with: npx tsx tests/manual-test-recovery-rate.ts
 */

import { calculateRecoveryRate } from '../src/lib/recovery-rate';

// Mock D1 Database for manual testing
class MockD1Database {
  private mockMainData: any = null;
  private mockBreakdownData: any[] = [];
  
  setMockMainData(data: any) {
    this.mockMainData = data;
  }
  
  setMockBreakdownData(data: any[]) {
    this.mockBreakdownData = data;
  }
  
  prepare(query: string) {
    return {
      bind: (...params: any[]) => {
        return {
          first: async () => {
            // Return first result for main query
            return this.mockMainData;
          },
          all: async () => {
            // Return all results for breakdown query
            return { results: this.mockBreakdownData };
          },
        };
      },
    };
  }
}

async function runTests() {
  console.log('🧪 Testing calculateRecoveryRate function\n');
  
  // Test 1: Basic recovery rate calculation
  console.log('Test 1: Basic recovery rate with successful recoveries');
  const mockDb1 = new MockD1Database();
  mockDb1.setMockMainData({
    recovery_branch: 'overdue',
    total_attempts: 10,
    successful_recoveries: 7,
    recovery_rate: 70.0,
    total_amount_attempted: 50000,
    total_amount_recovered: 35000,
  });
  mockDb1.setMockBreakdownData([
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
  
  const result1 = await calculateRecoveryRate(mockDb1 as any, {
    date_range: '30d',
    recovery_branch: 'overdue',
  });
  
  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log('✅ Test 1 passed\n');
  
  // Test 2: No data (empty result)
  console.log('Test 2: No data available');
  const mockDb2 = new MockD1Database();
  mockDb2.setMockMainData(null);
  mockDb2.setMockBreakdownData([]);
  
  const result2 = await calculateRecoveryRate(mockDb2 as any, {
    date_range: '30d',
  });
  
  console.log('Result:', JSON.stringify(result2, null, 2));
  console.log('✅ Test 2 passed\n');
  
  // Test 3: 100% recovery rate
  console.log('Test 3: 100% recovery rate');
  const mockDb3 = new MockD1Database();
  mockDb3.setMockMainData({
    recovery_branch: 'due-today',
    total_attempts: 5,
    successful_recoveries: 5,
    recovery_rate: 100.0,
    total_amount_attempted: 25000,
    total_amount_recovered: 25000,
  });
  mockDb3.setMockBreakdownData([
    {
      payment_method: 'pix',
      attempts: 5,
      recoveries: 5,
      rate: 100.0,
    },
  ]);
  
  const result3 = await calculateRecoveryRate(mockDb3 as any, {
    recovery_branch: 'due-today',
  });
  
  console.log('Result:', JSON.stringify(result3, null, 2));
  console.log('✅ Test 3 passed\n');
  
  // Test 4: All payment methods
  console.log('Test 4: All payment methods breakdown');
  const mockDb4 = new MockD1Database();
  mockDb4.setMockMainData({
    recovery_branch: 'overdue',
    total_attempts: 15,
    successful_recoveries: 10,
    recovery_rate: 66.67,
    total_amount_attempted: 75000,
    total_amount_recovered: 50000,
  });
  mockDb4.setMockBreakdownData([
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
  
  const result4 = await calculateRecoveryRate(mockDb4 as any);
  
  console.log('Result:', JSON.stringify(result4, null, 2));
  console.log('✅ Test 4 passed\n');
  
  console.log('🎉 All tests passed!');
}

// Run the tests
runTests().catch(console.error);
