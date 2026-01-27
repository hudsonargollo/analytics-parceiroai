/**
 * Manual Test Script for Parameter Validation
 * 
 * This script manually tests the validation functions to verify
 * they work correctly and return appropriate error messages.
 * 
 * Run with: npx tsx tests/manual-test-validation.ts
 * 
 * Requirements: 3.6
 */

import {
  validateDateRange,
  validateRecoveryBranch,
  validatePaymentMethod,
  validateEngagementStatus,
  validatePositiveInteger,
  validateMonth,
  validateISODate,
  validatePaginationParams,
  validateMonthRange,
  ValidationException,
  formatValidationErrors,
} from '../src/lib/validation';

console.log('=== Manual Validation Tests ===\n');

// Test 1: Valid date ranges
console.log('Test 1: Valid date ranges');
try {
  console.log('  7d:', validateDateRange('7d'));
  console.log('  30d:', validateDateRange('30d'));
  console.log('  today:', validateDateRange('today'));
  console.log('  ✓ All valid date ranges accepted\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 2: Invalid date range
console.log('Test 2: Invalid date range');
try {
  validateDateRange('invalid');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 3: Valid recovery branches
console.log('Test 3: Valid recovery branches');
try {
  console.log('  3-day-notice:', validateRecoveryBranch('3-day-notice'));
  console.log('  due-today:', validateRecoveryBranch('due-today'));
  console.log('  overdue:', validateRecoveryBranch('overdue'));
  console.log('  ✓ All valid branches accepted\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 4: Invalid recovery branch
console.log('Test 4: Invalid recovery branch');
try {
  validateRecoveryBranch('invalid-branch');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 5: Valid positive integers
console.log('Test 5: Valid positive integers');
try {
  console.log('  1:', validatePositiveInteger('1', 'test'));
  console.log('  100:', validatePositiveInteger('100', 'test'));
  console.log('  ✓ Valid integers accepted\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 6: Invalid positive integer (out of range)
console.log('Test 6: Invalid positive integer (out of range)');
try {
  validatePositiveInteger('0', 'page', 1, 100);
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 7: Invalid positive integer (non-numeric)
console.log('Test 7: Invalid positive integer (non-numeric)');
try {
  validatePositiveInteger('abc', 'page');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 8: Valid month formats
console.log('Test 8: Valid month formats');
try {
  console.log('  2024-01:', validateMonth('2024-01', 'test'));
  console.log('  2024-12:', validateMonth('2024-12', 'test'));
  console.log('  ✓ Valid months accepted\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 9: Invalid month format
console.log('Test 9: Invalid month format');
try {
  validateMonth('2024-1', 'test');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 10: Invalid month value
console.log('Test 10: Invalid month value');
try {
  validateMonth('2024-13', 'test');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 11: Valid pagination parameters
console.log('Test 11: Valid pagination parameters');
try {
  const result = validatePaginationParams('2', '50');
  console.log('  page=2, page_size=50:', result);
  console.log('  ✓ Valid pagination accepted\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 12: Invalid pagination parameters
console.log('Test 12: Invalid pagination parameters (multiple errors)');
try {
  validatePaginationParams('0', '-10');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Number of errors:', error.errors.length);
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 13: Valid month range
console.log('Test 13: Valid month range');
try {
  validateMonthRange('2024-01', '2024-12');
  console.log('  ✓ Valid month range accepted\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 14: Invalid month range (start after end)
console.log('Test 14: Invalid month range (start after end)');
try {
  validateMonthRange('2024-12', '2024-01');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 15: Format validation errors for HTTP response
console.log('Test 15: Format validation errors for HTTP response');
try {
  const errors = [
    { field: 'date_range', message: 'Invalid date_range format', expected: '7d, 30d, 60d' },
    { field: 'page', message: 'page must be a valid integer', expected: 'integer between 1 and 10000' },
  ];
  
  const formatted = formatValidationErrors(errors);
  console.log('  Formatted response:', JSON.stringify(formatted, null, 2));
  console.log('  ✓ Errors formatted correctly\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 16: Valid ISO dates
console.log('Test 16: Valid ISO dates');
try {
  console.log('  2024-01-15:', validateISODate('2024-01-15', 'test'));
  console.log('  2024-01-15T10:30:00Z:', validateISODate('2024-01-15T10:30:00Z', 'test'));
  console.log('  ✓ Valid ISO dates accepted\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 17: Invalid ISO date
console.log('Test 17: Invalid ISO date');
try {
  validateISODate('2024/01/15', 'test');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 18: Valid payment methods
console.log('Test 18: Valid payment methods');
try {
  console.log('  pix:', validatePaymentMethod('pix'));
  console.log('  boleto:', validatePaymentMethod('boleto'));
  console.log('  credit_card:', validatePaymentMethod('credit_card'));
  console.log('  ✓ Valid payment methods accepted\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 19: Invalid payment method
console.log('Test 19: Invalid payment method');
try {
  validatePaymentMethod('debit_card');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

// Test 20: Valid engagement statuses
console.log('Test 20: Valid engagement statuses');
try {
  console.log('  sent:', validateEngagementStatus('sent'));
  console.log('  delivered:', validateEngagementStatus('delivered'));
  console.log('  read:', validateEngagementStatus('read'));
  console.log('  failed:', validateEngagementStatus('failed'));
  console.log('  ✓ Valid engagement statuses accepted\n');
} catch (error) {
  console.log('  ✗ Unexpected error:', error);
}

// Test 21: Invalid engagement status
console.log('Test 21: Invalid engagement status');
try {
  validateEngagementStatus('pending');
  console.log('  ✗ Should have thrown ValidationException\n');
} catch (error) {
  if (error instanceof ValidationException) {
    console.log('  ✓ ValidationException thrown');
    console.log('  Error details:', JSON.stringify(error.errors, null, 2));
    console.log('');
  } else {
    console.log('  ✗ Wrong error type:', error);
  }
}

console.log('=== All Manual Tests Complete ===');
