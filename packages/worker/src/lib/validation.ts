/**
 * Parameter Validation Utilities
 * 
 * This module provides validation functions for API query parameters.
 * It validates date formats, numeric ranges, and enum values.
 * 
 * Requirements: 3.6
 */

export interface ValidationError {
  field: string;
  message: string;
  expected?: string;
}

export class ValidationException extends Error {
  public errors: ValidationError[];
  
  constructor(errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
    this.errors = errors;
  }
}

/**
 * Valid date range formats
 */
const VALID_DATE_RANGES = ['7d', '30d', '60d', '90d', '180d', '365d', 'today', 'current'] as const;
export type DateRange = typeof VALID_DATE_RANGES[number];

/**
 * Valid recovery branches
 */
const VALID_RECOVERY_BRANCHES = ['3-day-notice', 'due-today', 'overdue'] as const;
export type RecoveryBranch = typeof VALID_RECOVERY_BRANCHES[number];

/**
 * Valid payment methods
 */
const VALID_PAYMENT_METHODS = ['pix', 'boleto', 'credit_card'] as const;
export type PaymentMethod = typeof VALID_PAYMENT_METHODS[number];

/**
 * Valid engagement statuses
 */
const VALID_ENGAGEMENT_STATUSES = ['sent', 'delivered', 'read', 'failed'] as const;
export type EngagementStatus = typeof VALID_ENGAGEMENT_STATUSES[number];

/**
 * Validates a date range parameter
 * 
 * @param value - The date range value to validate
 * @param fieldName - The name of the field (for error messages)
 * @returns The validated date range or undefined if not provided
 * @throws ValidationException if the date range is invalid
 */
export function validateDateRange(value: string | undefined, fieldName: string = 'date_range'): DateRange | undefined {
  if (!value) {
    return undefined;
  }
  
  if (!VALID_DATE_RANGES.includes(value as DateRange)) {
    throw new ValidationException([{
      field: fieldName,
      message: `Invalid ${fieldName} format`,
      expected: VALID_DATE_RANGES.join(', ')
    }]);
  }
  
  return value as DateRange;
}

/**
 * Validates a recovery branch parameter
 * 
 * @param value - The recovery branch value to validate
 * @param fieldName - The name of the field (for error messages)
 * @returns The validated recovery branch or undefined if not provided
 * @throws ValidationException if the recovery branch is invalid
 */
export function validateRecoveryBranch(value: string | undefined, fieldName: string = 'branch'): RecoveryBranch | undefined {
  if (!value) {
    return undefined;
  }
  
  if (!VALID_RECOVERY_BRANCHES.includes(value as RecoveryBranch)) {
    throw new ValidationException([{
      field: fieldName,
      message: `Invalid ${fieldName} value`,
      expected: VALID_RECOVERY_BRANCHES.join(', ')
    }]);
  }
  
  return value as RecoveryBranch;
}

/**
 * Validates a payment method parameter
 * 
 * @param value - The payment method value to validate
 * @param fieldName - The name of the field (for error messages)
 * @returns The validated payment method or undefined if not provided
 * @throws ValidationException if the payment method is invalid
 */
export function validatePaymentMethod(value: string | undefined, fieldName: string = 'payment_method'): PaymentMethod | undefined {
  if (!value) {
    return undefined;
  }
  
  if (!VALID_PAYMENT_METHODS.includes(value as PaymentMethod)) {
    throw new ValidationException([{
      field: fieldName,
      message: `Invalid ${fieldName} value`,
      expected: VALID_PAYMENT_METHODS.join(', ')
    }]);
  }
  
  return value as PaymentMethod;
}

/**
 * Validates an engagement status parameter
 * 
 * @param value - The engagement status value to validate
 * @param fieldName - The name of the field (for error messages)
 * @returns The validated engagement status or undefined if not provided
 * @throws ValidationException if the engagement status is invalid
 */
export function validateEngagementStatus(value: string | undefined, fieldName: string = 'status'): EngagementStatus | undefined {
  if (!value) {
    return undefined;
  }
  
  if (!VALID_ENGAGEMENT_STATUSES.includes(value as EngagementStatus)) {
    throw new ValidationException([{
      field: fieldName,
      message: `Invalid ${fieldName} value`,
      expected: VALID_ENGAGEMENT_STATUSES.join(', ')
    }]);
  }
  
  return value as EngagementStatus;
}

/**
 * Validates a positive integer parameter
 * 
 * @param value - The value to validate
 * @param fieldName - The name of the field (for error messages)
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @returns The validated integer or undefined if not provided
 * @throws ValidationException if the value is invalid
 */
export function validatePositiveInteger(
  value: string | undefined,
  fieldName: string,
  min: number = 1,
  max: number = Number.MAX_SAFE_INTEGER
): number | undefined {
  if (!value) {
    return undefined;
  }
  
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) {
    throw new ValidationException([{
      field: fieldName,
      message: `${fieldName} must be a valid integer`,
      expected: `integer between ${min} and ${max}`
    }]);
  }
  
  if (parsed < min || parsed > max) {
    throw new ValidationException([{
      field: fieldName,
      message: `${fieldName} must be between ${min} and ${max}`,
      expected: `integer between ${min} and ${max}`
    }]);
  }
  
  return parsed;
}

/**
 * Validates a month parameter in YYYY-MM format
 * 
 * @param value - The month value to validate
 * @param fieldName - The name of the field (for error messages)
 * @returns The validated month string or undefined if not provided
 * @throws ValidationException if the month format is invalid
 */
export function validateMonth(value: string | undefined, fieldName: string): string | undefined {
  if (!value) {
    return undefined;
  }
  
  // Check format: YYYY-MM
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  
  if (!monthRegex.test(value)) {
    throw new ValidationException([{
      field: fieldName,
      message: `Invalid ${fieldName} format`,
      expected: 'YYYY-MM (e.g., 2024-01)'
    }]);
  }
  
  // Validate that it's a real date
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  
  if (date.getFullYear() !== year || date.getMonth() !== month - 1) {
    throw new ValidationException([{
      field: fieldName,
      message: `Invalid ${fieldName} value`,
      expected: 'Valid month in YYYY-MM format'
    }]);
  }
  
  return value;
}

/**
 * Validates an ISO 8601 date string
 * 
 * @param value - The date value to validate
 * @param fieldName - The name of the field (for error messages)
 * @returns The validated date string or undefined if not provided
 * @throws ValidationException if the date format is invalid
 */
export function validateISODate(value: string | undefined, fieldName: string): string | undefined {
  if (!value) {
    return undefined;
  }
  
  // Check ISO 8601 format
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  
  if (!isoDateRegex.test(value)) {
    throw new ValidationException([{
      field: fieldName,
      message: `Invalid ${fieldName} format`,
      expected: 'ISO 8601 date format (e.g., 2024-01-15 or 2024-01-15T10:30:00Z)'
    }]);
  }
  
  // Validate that it's a real date
  const date = new Date(value);
  
  if (isNaN(date.getTime())) {
    throw new ValidationException([{
      field: fieldName,
      message: `Invalid ${fieldName} value`,
      expected: 'Valid ISO 8601 date'
    }]);
  }
  
  return value;
}

/**
 * Validates pagination parameters
 * 
 * @param page - The page number
 * @param pageSize - The page size
 * @returns Validated pagination parameters
 * @throws ValidationException if parameters are invalid
 */
export function validatePaginationParams(
  page: string | undefined,
  pageSize: string | undefined
): { page: number; pageSize: number } {
  const errors: ValidationError[] = [];
  
  let validatedPage = 1;
  let validatedPageSize = 100;
  
  if (page) {
    try {
      const parsed = validatePositiveInteger(page, 'page', 1, 10000);
      if (parsed !== undefined) {
        validatedPage = parsed;
      }
    } catch (error) {
      if (error instanceof ValidationException) {
        errors.push(...error.errors);
      }
    }
  }
  
  if (pageSize) {
    try {
      const parsed = validatePositiveInteger(pageSize, 'page_size', 1, 1000);
      if (parsed !== undefined) {
        validatedPageSize = parsed;
      }
    } catch (error) {
      if (error instanceof ValidationException) {
        errors.push(...error.errors);
      }
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationException(errors);
  }
  
  return { page: validatedPage, pageSize: validatedPageSize };
}

/**
 * Validates that start_month is before or equal to end_month
 * 
 * @param startMonth - The start month in YYYY-MM format
 * @param endMonth - The end month in YYYY-MM format
 * @throws ValidationException if start_month is after end_month
 */
export function validateMonthRange(startMonth: string | undefined, endMonth: string | undefined): void {
  if (!startMonth || !endMonth) {
    return;
  }
  
  const start = new Date(startMonth + '-01');
  const end = new Date(endMonth + '-01');
  
  if (start > end) {
    throw new ValidationException([{
      field: 'start_month',
      message: 'start_month must be before or equal to end_month',
      expected: 'start_month <= end_month'
    }]);
  }
}

/**
 * Helper function to format validation errors for HTTP response
 * 
 * @param errors - Array of validation errors
 * @returns Formatted error response object
 */
export function formatValidationErrors(errors: ValidationError[]): {
  error: string;
  message: string;
  details: ValidationError[];
} {
  return {
    error: 'Bad Request',
    message: 'Invalid request parameters',
    details: errors
  };
}
