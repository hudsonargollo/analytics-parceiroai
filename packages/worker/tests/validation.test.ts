/**
 * Unit Tests for Parameter Validation
 * 
 * Tests validation functions for API query parameters including
 * date formats, numeric ranges, and enum values.
 * 
 * Requirements: 3.6
 */

import { describe, it, expect } from 'vitest';
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

describe('validateDateRange', () => {
  it('should accept valid date range formats', () => {
    expect(validateDateRange('7d')).toBe('7d');
    expect(validateDateRange('30d')).toBe('30d');
    expect(validateDateRange('60d')).toBe('60d');
    expect(validateDateRange('90d')).toBe('90d');
    expect(validateDateRange('180d')).toBe('180d');
    expect(validateDateRange('365d')).toBe('365d');
    expect(validateDateRange('today')).toBe('today');
    expect(validateDateRange('current')).toBe('current');
  });

  it('should return undefined for undefined input', () => {
    expect(validateDateRange(undefined)).toBeUndefined();
  });

  it('should throw ValidationException for invalid date range', () => {
    expect(() => validateDateRange('invalid')).toThrow(ValidationException);
    expect(() => validateDateRange('100d')).toThrow(ValidationException);
    expect(() => validateDateRange('1d')).toThrow(ValidationException);
  });

  it('should include expected values in error message', () => {
    try {
      validateDateRange('invalid');
      expect.fail('Should have thrown ValidationException');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      const validationError = error as ValidationException;
      expect(validationError.errors[0].expected).toContain('7d');
      expect(validationError.errors[0].expected).toContain('30d');
      expect(validationError.errors[0].expected).toContain('today');
    }
  });
});

describe('validateRecoveryBranch', () => {
  it('should accept valid recovery branch values', () => {
    expect(validateRecoveryBranch('3-day-notice')).toBe('3-day-notice');
    expect(validateRecoveryBranch('due-today')).toBe('due-today');
    expect(validateRecoveryBranch('overdue')).toBe('overdue');
  });

  it('should return undefined for undefined input', () => {
    expect(validateRecoveryBranch(undefined)).toBeUndefined();
  });

  it('should throw ValidationException for invalid branch', () => {
    expect(() => validateRecoveryBranch('invalid')).toThrow(ValidationException);
    expect(() => validateRecoveryBranch('3-days')).toThrow(ValidationException);
    expect(() => validateRecoveryBranch('past-due')).toThrow(ValidationException);
  });

  it('should include expected values in error message', () => {
    try {
      validateRecoveryBranch('invalid');
      expect.fail('Should have thrown ValidationException');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      const validationError = error as ValidationException;
      expect(validationError.errors[0].expected).toContain('3-day-notice');
      expect(validationError.errors[0].expected).toContain('due-today');
      expect(validationError.errors[0].expected).toContain('overdue');
    }
  });
});

describe('validatePaymentMethod', () => {
  it('should accept valid payment method values', () => {
    expect(validatePaymentMethod('pix')).toBe('pix');
    expect(validatePaymentMethod('boleto')).toBe('boleto');
    expect(validatePaymentMethod('credit_card')).toBe('credit_card');
  });

  it('should return undefined for undefined input', () => {
    expect(validatePaymentMethod(undefined)).toBeUndefined();
  });

  it('should throw ValidationException for invalid payment method', () => {
    expect(() => validatePaymentMethod('invalid')).toThrow(ValidationException);
    expect(() => validatePaymentMethod('debit_card')).toThrow(ValidationException);
    expect(() => validatePaymentMethod('cash')).toThrow(ValidationException);
  });
});

describe('validateEngagementStatus', () => {
  it('should accept valid engagement status values', () => {
    expect(validateEngagementStatus('sent')).toBe('sent');
    expect(validateEngagementStatus('delivered')).toBe('delivered');
    expect(validateEngagementStatus('read')).toBe('read');
    expect(validateEngagementStatus('failed')).toBe('failed');
  });

  it('should return undefined for undefined input', () => {
    expect(validateEngagementStatus(undefined)).toBeUndefined();
  });

  it('should throw ValidationException for invalid status', () => {
    expect(() => validateEngagementStatus('invalid')).toThrow(ValidationException);
    expect(() => validateEngagementStatus('pending')).toThrow(ValidationException);
  });
});

describe('validatePositiveInteger', () => {
  it('should accept valid positive integers', () => {
    expect(validatePositiveInteger('1', 'test')).toBe(1);
    expect(validatePositiveInteger('100', 'test')).toBe(100);
    expect(validatePositiveInteger('999', 'test')).toBe(999);
  });

  it('should return undefined for undefined input', () => {
    expect(validatePositiveInteger(undefined, 'test')).toBeUndefined();
  });

  it('should throw ValidationException for non-numeric values', () => {
    expect(() => validatePositiveInteger('abc', 'test')).toThrow(ValidationException);
    expect(() => validatePositiveInteger('12.5', 'test')).toThrow(ValidationException);
    expect(() => validatePositiveInteger('', 'test')).toThrow(ValidationException);
  });

  it('should throw ValidationException for values outside range', () => {
    expect(() => validatePositiveInteger('0', 'test', 1, 100)).toThrow(ValidationException);
    expect(() => validatePositiveInteger('101', 'test', 1, 100)).toThrow(ValidationException);
    expect(() => validatePositiveInteger('-5', 'test', 1, 100)).toThrow(ValidationException);
  });

  it('should respect custom min and max values', () => {
    expect(validatePositiveInteger('50', 'test', 10, 100)).toBe(50);
    expect(validatePositiveInteger('10', 'test', 10, 100)).toBe(10);
    expect(validatePositiveInteger('100', 'test', 10, 100)).toBe(100);
  });

  it('should include range in error message', () => {
    try {
      validatePositiveInteger('150', 'test', 1, 100);
      expect.fail('Should have thrown ValidationException');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      const validationError = error as ValidationException;
      expect(validationError.errors[0].expected).toContain('1');
      expect(validationError.errors[0].expected).toContain('100');
    }
  });
});

describe('validateMonth', () => {
  it('should accept valid month formats', () => {
    expect(validateMonth('2024-01', 'test')).toBe('2024-01');
    expect(validateMonth('2024-12', 'test')).toBe('2024-12');
    expect(validateMonth('2023-06', 'test')).toBe('2023-06');
  });

  it('should return undefined for undefined input', () => {
    expect(validateMonth(undefined, 'test')).toBeUndefined();
  });

  it('should throw ValidationException for invalid month format', () => {
    expect(() => validateMonth('2024-1', 'test')).toThrow(ValidationException);
    expect(() => validateMonth('24-01', 'test')).toThrow(ValidationException);
    expect(() => validateMonth('2024/01', 'test')).toThrow(ValidationException);
    expect(() => validateMonth('invalid', 'test')).toThrow(ValidationException);
  });

  it('should throw ValidationException for invalid month values', () => {
    expect(() => validateMonth('2024-00', 'test')).toThrow(ValidationException);
    expect(() => validateMonth('2024-13', 'test')).toThrow(ValidationException);
  });

  it('should include expected format in error message', () => {
    try {
      validateMonth('2024-1', 'test');
      expect.fail('Should have thrown ValidationException');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      const validationError = error as ValidationException;
      expect(validationError.errors[0].expected).toContain('YYYY-MM');
    }
  });
});

describe('validateISODate', () => {
  it('should accept valid ISO 8601 date formats', () => {
    expect(validateISODate('2024-01-15', 'test')).toBe('2024-01-15');
    expect(validateISODate('2024-01-15T10:30:00Z', 'test')).toBe('2024-01-15T10:30:00Z');
    expect(validateISODate('2024-01-15T10:30:00.123Z', 'test')).toBe('2024-01-15T10:30:00.123Z');
  });

  it('should return undefined for undefined input', () => {
    expect(validateISODate(undefined, 'test')).toBeUndefined();
  });

  it('should throw ValidationException for invalid date format', () => {
    expect(() => validateISODate('2024/01/15', 'test')).toThrow(ValidationException);
    expect(() => validateISODate('15-01-2024', 'test')).toThrow(ValidationException);
    expect(() => validateISODate('invalid', 'test')).toThrow(ValidationException);
  });

  it('should throw ValidationException for invalid date values', () => {
    expect(() => validateISODate('2024-13-01', 'test')).toThrow(ValidationException);
    expect(() => validateISODate('2024-02-30', 'test')).toThrow(ValidationException);
  });
});

describe('validatePaginationParams', () => {
  it('should return default values when no parameters provided', () => {
    const result = validatePaginationParams(undefined, undefined);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
  });

  it('should accept valid pagination parameters', () => {
    const result = validatePaginationParams('2', '50');
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
  });

  it('should throw ValidationException for invalid page number', () => {
    expect(() => validatePaginationParams('0', '50')).toThrow(ValidationException);
    expect(() => validatePaginationParams('-1', '50')).toThrow(ValidationException);
    expect(() => validatePaginationParams('abc', '50')).toThrow(ValidationException);
  });

  it('should throw ValidationException for invalid page size', () => {
    expect(() => validatePaginationParams('1', '0')).toThrow(ValidationException);
    expect(() => validatePaginationParams('1', '-10')).toThrow(ValidationException);
    expect(() => validatePaginationParams('1', 'abc')).toThrow(ValidationException);
  });

  it('should enforce maximum page number', () => {
    expect(() => validatePaginationParams('10001', '50')).toThrow(ValidationException);
  });

  it('should enforce maximum page size', () => {
    expect(() => validatePaginationParams('1', '1001')).toThrow(ValidationException);
  });

  it('should collect multiple validation errors', () => {
    try {
      validatePaginationParams('abc', 'xyz');
      expect.fail('Should have thrown ValidationException');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      const validationError = error as ValidationException;
      expect(validationError.errors.length).toBe(2);
    }
  });
});

describe('validateMonthRange', () => {
  it('should accept valid month ranges', () => {
    expect(() => validateMonthRange('2024-01', '2024-12')).not.toThrow();
    expect(() => validateMonthRange('2024-01', '2024-01')).not.toThrow();
    expect(() => validateMonthRange('2023-12', '2024-01')).not.toThrow();
  });

  it('should not throw when either parameter is undefined', () => {
    expect(() => validateMonthRange(undefined, '2024-12')).not.toThrow();
    expect(() => validateMonthRange('2024-01', undefined)).not.toThrow();
    expect(() => validateMonthRange(undefined, undefined)).not.toThrow();
  });

  it('should throw ValidationException when start_month is after end_month', () => {
    expect(() => validateMonthRange('2024-12', '2024-01')).toThrow(ValidationException);
    expect(() => validateMonthRange('2024-06', '2024-05')).toThrow(ValidationException);
  });

  it('should include helpful error message', () => {
    try {
      validateMonthRange('2024-12', '2024-01');
      expect.fail('Should have thrown ValidationException');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      const validationError = error as ValidationException;
      expect(validationError.errors[0].message).toContain('start_month');
      expect(validationError.errors[0].message).toContain('end_month');
    }
  });
});

describe('formatValidationErrors', () => {
  it('should format validation errors for HTTP response', () => {
    const errors = [
      { field: 'date_range', message: 'Invalid date_range format', expected: '7d, 30d, 60d' },
      { field: 'page', message: 'page must be a valid integer', expected: 'integer between 1 and 10000' },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted.error).toBe('Bad Request');
    expect(formatted.message).toBe('Invalid request parameters');
    expect(formatted.details).toEqual(errors);
    expect(formatted.details.length).toBe(2);
  });

  it('should handle single error', () => {
    const errors = [
      { field: 'branch', message: 'Invalid branch value', expected: '3-day-notice, due-today, overdue' },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted.error).toBe('Bad Request');
    expect(formatted.details.length).toBe(1);
    expect(formatted.details[0].field).toBe('branch');
  });

  it('should handle errors without expected field', () => {
    const errors = [
      { field: 'start_month', message: 'start_month must be before or equal to end_month' },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted.details[0].expected).toBeUndefined();
  });
});

describe('ValidationException', () => {
  it('should create exception with errors array', () => {
    const errors = [
      { field: 'test', message: 'Test error' },
    ];

    const exception = new ValidationException(errors);

    expect(exception).toBeInstanceOf(Error);
    expect(exception.name).toBe('ValidationException');
    expect(exception.message).toBe('Validation failed');
    expect(exception.errors).toEqual(errors);
  });

  it('should handle multiple errors', () => {
    const errors = [
      { field: 'field1', message: 'Error 1' },
      { field: 'field2', message: 'Error 2' },
      { field: 'field3', message: 'Error 3' },
    ];

    const exception = new ValidationException(errors);

    expect(exception.errors.length).toBe(3);
    expect(exception.errors).toEqual(errors);
  });
});
