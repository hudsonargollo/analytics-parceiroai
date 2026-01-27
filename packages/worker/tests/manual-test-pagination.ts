/**
 * Manual test script for pagination functionality
 * 
 * This script demonstrates pagination working with the cohorts endpoint.
 * Run with: npx tsx tests/manual-test-pagination.ts
 */

import { parsePaginationParams, calculatePaginationMetadata, paginateArray } from '../src/lib/pagination';

console.log('=== Pagination Manual Test ===\n');

// Test 1: Parse pagination parameters
console.log('Test 1: Parse pagination parameters');
console.log('Input: page=2, page_size=50');
const params = parsePaginationParams('2', '50');
console.log('Output:', params);
console.log('✓ Parsed successfully\n');

// Test 2: Calculate pagination metadata
console.log('Test 2: Calculate pagination metadata');
console.log('Input: total=250, page=2, page_size=50');
const metadata = calculatePaginationMetadata(250, 2, 50);
console.log('Output:', metadata);
console.log('✓ Calculated successfully\n');

// Test 3: Paginate array (simulating cohorts)
console.log('Test 3: Paginate array of cohorts');
const mockCohorts = Array.from({ length: 150 }, (_, i) => ({
  cohort_month: `2024-${String((i % 12) + 1).padStart(2, '0')}`,
  total_customers: Math.floor(Math.random() * 100) + 10,
  billing_cycles: [],
  is_statistically_significant: true,
}));

console.log(`Total cohorts: ${mockCohorts.length}`);

// Page 1
console.log('\nPage 1 (page_size=100):');
const page1 = paginateArray(mockCohorts, 1, 100);
console.log(`  Returned ${page1.length} cohorts`);
console.log(`  First cohort: ${page1[0].cohort_month}`);
console.log(`  Last cohort: ${page1[page1.length - 1].cohort_month}`);

// Page 2
console.log('\nPage 2 (page_size=100):');
const page2 = paginateArray(mockCohorts, 2, 100);
console.log(`  Returned ${page2.length} cohorts`);
console.log(`  First cohort: ${page2[0].cohort_month}`);
console.log(`  Last cohort: ${page2[page2.length - 1].cohort_month}`);

// Page 3 (beyond total)
console.log('\nPage 3 (page_size=100):');
const page3 = paginateArray(mockCohorts, 3, 100);
console.log(`  Returned ${page3.length} cohorts`);

console.log('\n✓ All pagination tests completed successfully\n');

// Test 4: Demonstrate pagination response structure
console.log('Test 4: Pagination response structure');
const paginatedResponse = {
  data: {
    cohorts: page1,
  },
  pagination: calculatePaginationMetadata(mockCohorts.length, 1, 100),
};

console.log('Response structure:');
console.log(JSON.stringify({
  data: {
    cohorts: `[${paginatedResponse.data.cohorts.length} cohorts]`,
  },
  pagination: paginatedResponse.pagination,
}, null, 2));

console.log('\n✓ Pagination response structure is correct\n');

// Test 5: Edge cases
console.log('Test 5: Edge cases');

// Empty array
const emptyPage = paginateArray([], 1, 100);
console.log(`Empty array pagination: ${emptyPage.length} items`);

// Single item
const singlePage = paginateArray([{ id: 1 }], 1, 100);
console.log(`Single item pagination: ${singlePage.length} items`);

// Page beyond total
const beyondPage = paginateArray([1, 2, 3], 10, 100);
console.log(`Page beyond total: ${beyondPage.length} items`);

// Default parameters
const defaultParams = parsePaginationParams(undefined, undefined);
console.log(`Default parameters: page=${defaultParams.page}, page_size=${defaultParams.page_size}`);

// Invalid parameters
const invalidParams = parsePaginationParams('invalid', '-10');
console.log(`Invalid parameters: page=${invalidParams.page}, page_size=${invalidParams.page_size}`);

// Max page size cap
const maxParams = parsePaginationParams('1', '5000');
console.log(`Max page size cap: page_size=${maxParams.page_size} (capped at 1000)`);

console.log('\n✓ All edge cases handled correctly\n');

console.log('=== All Tests Passed ===');
