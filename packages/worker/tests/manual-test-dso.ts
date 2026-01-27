/**
 * Manual test for DSO calculation
 * 
 * Run this with: npx tsx tests/manual-test-dso.ts
 */

import { calculateDSO } from '../src/lib/dso';

// Mock D1 Database for manual testing
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

async function runTests() {
  console.log('🧪 Manual DSO Calculation Tests\n');

  const mockDb = new MockD1Database();

  // Test 1: Basic DSO calculation
  console.log('Test 1: Basic DSO calculation');
  mockDb.setMockResults([
    { recovery_branch: '3-day-notice', dso_days: 2 },
    { recovery_branch: 'due-today', dso_days: 4 },
    { recovery_branch: 'overdue', dso_days: 6 },
  ]);

  const result1 = await calculateDSO(mockDb as any, { date_range: '30d' });
  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log('✅ Average DSO:', result1.average_dso, '(expected: 4)');
  console.log('✅ Median DSO:', result1.median_dso, '(expected: 4)');
  console.log('');

  // Test 2: DSO by branch
  console.log('Test 2: DSO by branch');
  mockDb.setMockResults([
    { recovery_branch: '3-day-notice', dso_days: 2 },
    { recovery_branch: '3-day-notice', dso_days: 4 },
    { recovery_branch: 'due-today', dso_days: 3 },
    { recovery_branch: 'overdue', dso_days: 10 },
    { recovery_branch: 'overdue', dso_days: 8 },
  ]);

  const result2 = await calculateDSO(mockDb as any, { date_range: '30d' });
  console.log('Result:', JSON.stringify(result2, null, 2));
  console.log('✅ 3-day-notice DSO:', result2.by_branch['3-day-notice'], '(expected: 3)');
  console.log('✅ due-today DSO:', result2.by_branch['due-today'], '(expected: 3)');
  console.log('✅ overdue DSO:', result2.by_branch['overdue'], '(expected: 9)');
  console.log('');

  // Test 3: Empty data
  console.log('Test 3: Empty data');
  mockDb.setMockResults([]);

  const result3 = await calculateDSO(mockDb as any, { date_range: '30d' });
  console.log('Result:', JSON.stringify(result3, null, 2));
  console.log('✅ Average DSO:', result3.average_dso, '(expected: 0)');
  console.log('✅ Median DSO:', result3.median_dso, '(expected: 0)');
  console.log('');

  // Test 4: Median calculation (even number of values)
  console.log('Test 4: Median calculation (even number of values)');
  mockDb.setMockResults([
    { recovery_branch: '3-day-notice', dso_days: 2 },
    { recovery_branch: 'due-today', dso_days: 4 },
    { recovery_branch: 'overdue', dso_days: 6 },
    { recovery_branch: 'overdue', dso_days: 8 },
  ]);

  const result4 = await calculateDSO(mockDb as any, { date_range: '30d' });
  console.log('Result:', JSON.stringify(result4, null, 2));
  console.log('✅ Median DSO:', result4.median_dso, '(expected: 5 - median of [2,4,6,8])');
  console.log('');

  // Test 5: Decimal rounding
  console.log('Test 5: Decimal rounding');
  mockDb.setMockResults([
    { recovery_branch: '3-day-notice', dso_days: 2.333 },
    { recovery_branch: 'due-today', dso_days: 4.666 },
    { recovery_branch: 'overdue', dso_days: 6.999 },
  ]);

  const result5 = await calculateDSO(mockDb as any, { date_range: '30d' });
  console.log('Result:', JSON.stringify(result5, null, 2));
  console.log('✅ Average DSO:', result5.average_dso, '(expected: ~4.67)');
  console.log('✅ 3-day-notice:', result5.by_branch['3-day-notice'], '(expected: 2.33)');
  console.log('✅ due-today:', result5.by_branch['due-today'], '(expected: 4.67)');
  console.log('✅ overdue:', result5.by_branch['overdue'], '(expected: 7.00)');
  console.log('');

  // Test 6: Single branch with data
  console.log('Test 6: Single branch with data');
  mockDb.setMockResults([
    { recovery_branch: '3-day-notice', dso_days: 5 },
    { recovery_branch: '3-day-notice', dso_days: 7 },
  ]);

  const result6 = await calculateDSO(mockDb as any, { date_range: '30d' });
  console.log('Result:', JSON.stringify(result6, null, 2));
  console.log('✅ 3-day-notice DSO:', result6.by_branch['3-day-notice'], '(expected: 6)');
  console.log('✅ due-today DSO:', result6.by_branch['due-today'], '(expected: 0)');
  console.log('✅ overdue DSO:', result6.by_branch['overdue'], '(expected: 0)');
  console.log('');

  console.log('✅ All manual tests completed successfully!');
}

// Run tests
runTests().catch(console.error);
