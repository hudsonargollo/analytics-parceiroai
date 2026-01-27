/**
 * Manual test script for classifyRecoveryBranch function
 * Run with: npx tsx tests/manual-test-recovery-branch.ts
 */

import { classifyRecoveryBranch } from '../src/lib/recovery-branch';

console.log('Testing classifyRecoveryBranch function...\n');

// Test 1: 3-day notice
const test1 = classifyRecoveryBranch('2024-01-18', '2024-01-15');
console.log('Test 1 - Due in 3 days:', test1);
console.assert(test1 === '3-day-notice', 'Test 1 failed');

// Test 2: Due today
const test2 = classifyRecoveryBranch('2024-01-15', '2024-01-15');
console.log('Test 2 - Due today:', test2);
console.assert(test2 === 'due-today', 'Test 2 failed');

// Test 3: Overdue
const test3 = classifyRecoveryBranch('2024-01-10', '2024-01-15');
console.log('Test 3 - Overdue:', test3);
console.assert(test3 === 'overdue', 'Test 3 failed');

// Test 4: Due in 1 day (defaults to 3-day-notice)
const test4 = classifyRecoveryBranch('2024-01-16', '2024-01-15');
console.log('Test 4 - Due in 1 day:', test4);
console.assert(test4 === '3-day-notice', 'Test 4 failed');

// Test 5: Timezone handling - same day different times
const test5 = classifyRecoveryBranch('2024-01-15T08:00:00Z', '2024-01-15T20:00:00Z');
console.log('Test 5 - Same day, different times:', test5);
console.assert(test5 === 'due-today', 'Test 5 failed');

// Test 6: Midnight boundary
const test6 = classifyRecoveryBranch('2024-01-15T23:59:59Z', '2024-01-16T00:01:00Z');
console.log('Test 6 - Midnight boundary:', test6);
console.assert(test6 === 'overdue', 'Test 6 failed');

// Test 7: Month boundary
const test7 = classifyRecoveryBranch('2024-01-02', '2023-12-30');
console.log('Test 7 - Month boundary (3 days):', test7);
console.assert(test7 === '3-day-notice', 'Test 7 failed');

// Test 8: Leap year
const test8 = classifyRecoveryBranch('2024-03-01', '2024-02-27');
console.log('Test 8 - Leap year (3 days):', test8);
console.assert(test8 === '3-day-notice', 'Test 8 failed');

console.log('\n✅ All manual tests passed!');
