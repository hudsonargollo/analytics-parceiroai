/**
 * PII Validation Module
 * 
 * Provides validation functions to prevent storage of Personally Identifiable Information (PII).
 * Implements LGPD (Brazilian Data Protection Law) compliance by detecting and rejecting
 * sensitive personal data fields.
 * 
 * Requirements: 7.3
 */

/**
 * List of sensitive field names that should not be stored
 * These fields contain PII that violates LGPD compliance
 */
const SENSITIVE_FIELD_NAMES = [
  // Personal identification
  'name',
  'full_name',
  'first_name',
  'last_name',
  'nome',
  'nome_completo',
  
  // Contact information
  'email',
  'email_address',
  'phone',
  'phone_number',
  'telephone',
  'mobile',
  'celular',
  'telefone',
  
  // Address information
  'address',
  'street',
  'street_address',
  'city',
  'state',
  'zip',
  'zip_code',
  'postal_code',
  'country',
  'endereco',
  'rua',
  'cidade',
  'estado',
  'cep',
  
  // Identity documents
  'cpf',
  'cnpj',
  'rg',
  'passport',
  'driver_license',
  'ssn',
  'tax_id',
  
  // Financial information (beyond transaction metadata)
  'credit_card',
  'credit_card_number',
  'card_number',
  'cvv',
  'card_holder',
  'bank_account',
  'account_number',
  'routing_number',
  
  // Other sensitive data
  'birth_date',
  'date_of_birth',
  'dob',
  'age',
  'gender',
  'nationality',
  'ip_address',
  'user_agent',
  'device_id',
  'location',
  'coordinates',
  'latitude',
  'longitude',
];

/**
 * Patterns to detect PII in field values
 * These regex patterns identify common PII formats
 */
const PII_VALUE_PATTERNS = [
  // Email pattern
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  
  // Phone patterns (various formats)
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // US format
  /\(\d{2,3}\)\s?\d{4,5}-?\d{4}/, // Brazilian format with parentheses
  /\b\+\d{1,3}\s?\d{1,14}\b/, // International format
  
  // CPF pattern (Brazilian tax ID)
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
  /\b\d{11}\b/, // CPF without formatting
  
  // CNPJ pattern (Brazilian company ID)
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/,
  /\b\d{14}\b/, // CNPJ without formatting
  
  // Credit card pattern (basic check)
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  
  // IP address pattern
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
];

/**
 * Allowed fields that can be stored (whitelist approach)
 * Only these fields and transaction metadata are permitted
 */
const ALLOWED_FIELDS = [
  // Identifiers (non-PII)
  'event_id',
  'customer_id',
  'invoice_id',
  'message_id',
  'transaction_id',
  'subscription_id',
  
  // Transaction metadata
  'amount',
  'payment_method',
  'status',
  'due_date',
  'timestamp',
  'created_at',
  'updated_at',
  'branch',
  'recovery_branch',
  
  // Engagement metadata
  'message_status',
  'delivery_status',
  'read_status',
  
  // Payment metadata (non-sensitive)
  'pix_code', // Pix payment code (not PII, it's a transaction code)
  'boleto_url', // Boleto URL (not PII, it's a payment link)
  'payment_link',
  'transaction_code',
  
  // Analytics metadata
  'cohort_month',
  'subscription_plan',
  'billing_cycle',
  'recovery_time_hours',
  'days_overdue',
];

/**
 * Result of PII validation
 */
export interface PIIValidationResult {
  isValid: boolean;
  violations: PIIViolation[];
  sanitizedData?: Record<string, any>;
}

/**
 * Details of a PII violation
 */
export interface PIIViolation {
  field: string;
  reason: string;
  value?: string; // Redacted value for logging
}

/**
 * Options for PII validation
 */
export interface PIIValidationOptions {
  /**
   * If true, strip sensitive fields instead of rejecting the entire payload
   * Default: false (reject entire payload)
   */
  stripSensitiveFields?: boolean;
  
  /**
   * If true, check field values for PII patterns (more thorough but slower)
   * Default: true
   */
  checkValuePatterns?: boolean;
  
  /**
   * If true, log warnings when PII is detected
   * Default: true
   */
  logWarnings?: boolean;
}

/**
 * Validates that a payload does not contain PII fields.
 * 
 * This function implements LGPD compliance by ensuring only customer_id
 * and transaction metadata are stored, with no sensitive personal information.
 * 
 * @param data - The payload data to validate
 * @param options - Validation options
 * @returns Validation result with violations and optionally sanitized data
 * 
 * @example
 * ```typescript
 * const result = validateNoPII({
 *   customer_id: 'cust_123',
 *   amount: 5000,
 *   email: 'user@example.com' // PII violation!
 * });
 * 
 * if (!result.isValid) {
 *   console.error('PII detected:', result.violations);
 * }
 * ```
 */
export function validateNoPII(
  data: Record<string, any>,
  options: PIIValidationOptions = {}
): PIIValidationResult {
  const {
    stripSensitiveFields = false,
    checkValuePatterns = true,
    logWarnings = true,
  } = options;
  
  const violations: PIIViolation[] = [];
  const sanitizedData: Record<string, any> = {};
  
  // Check each field in the payload
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // First, check if field is in the allowed list (whitelist takes precedence)
    const isAllowedField = ALLOWED_FIELDS.some(
      allowedField => lowerKey === allowedField.toLowerCase()
    );
    
    // If explicitly allowed, skip all other checks
    if (isAllowedField) {
      if (stripSensitiveFields) {
        sanitizedData[key] = value;
      }
      continue;
    }
    
    // Check if field name is in the sensitive list
    const isSensitiveField = SENSITIVE_FIELD_NAMES.some(
      sensitiveField => lowerKey.includes(sensitiveField.toLowerCase())
    );
    
    if (isSensitiveField) {
      violations.push({
        field: key,
        reason: 'Field name indicates sensitive personal information',
        value: '[REDACTED]',
      });
      
      // Skip this field if stripping, otherwise continue to collect all violations
      if (stripSensitiveFields) {
        continue;
      }
    }
    
    // If not explicitly allowed and not already flagged as sensitive, check value patterns
    if (!isSensitiveField && checkValuePatterns && typeof value === 'string') {
      const containsPII = PII_VALUE_PATTERNS.some(pattern => pattern.test(value));
      
      if (containsPII) {
        violations.push({
          field: key,
          reason: 'Field value matches PII pattern (email, phone, CPF, etc.)',
          value: value.substring(0, 10) + '...[REDACTED]',
        });
        
        // Skip this field if stripping
        if (stripSensitiveFields) {
          continue;
        }
      }
    }
    
    // If we're stripping and this field passed checks, include it in sanitized data
    if (stripSensitiveFields && !isSensitiveField) {
      sanitizedData[key] = value;
    } else if (!stripSensitiveFields) {
      // If not stripping, include all fields in sanitized data (for reference)
      sanitizedData[key] = value;
    }
  }
  
  // Log warnings if PII detected
  if (logWarnings && violations.length > 0) {
    console.warn('PII detected in webhook payload', {
      timestamp: new Date().toISOString(),
      violationCount: violations.length,
      violations: violations.map(v => ({
        field: v.field,
        reason: v.reason,
      })),
      action: stripSensitiveFields ? 'stripped' : 'rejected',
    });
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    sanitizedData: stripSensitiveFields ? sanitizedData : undefined,
  };
}

/**
 * Validates payment webhook payload for PII compliance.
 * 
 * This is a convenience wrapper around validateNoPII specifically for payment webhooks.
 * 
 * @param payload - Payment webhook payload
 * @param options - Validation options
 * @returns Validation result
 */
export function validatePaymentWebhookPII(
  payload: Record<string, any>,
  options: PIIValidationOptions = {}
): PIIValidationResult {
  return validateNoPII(payload, options);
}

/**
 * Validates engagement webhook payload for PII compliance.
 * 
 * This is a convenience wrapper around validateNoPII specifically for engagement webhooks.
 * 
 * @param payload - Engagement webhook payload
 * @param options - Validation options
 * @returns Validation result
 */
export function validateEngagementWebhookPII(
  payload: Record<string, any>,
  options: PIIValidationOptions = {}
): PIIValidationResult {
  return validateNoPII(payload, options);
}

/**
 * Sanitizes a payload by removing all PII fields.
 * 
 * This is a convenience function that always strips sensitive fields.
 * 
 * @param data - The payload data to sanitize
 * @returns Sanitized data with PII fields removed
 */
export function sanitizePII(data: Record<string, any>): Record<string, any> {
  const result = validateNoPII(data, {
    stripSensitiveFields: true,
    checkValuePatterns: true,
    logWarnings: true,
  });
  
  return result.sanitizedData || {};
}

/**
 * Checks if a payload contains any PII violations.
 * 
 * This is a convenience function for quick boolean checks.
 * 
 * @param data - The payload data to check
 * @returns True if payload is clean (no PII), false if PII detected
 */
export function isCleanPayload(data: Record<string, any>): boolean {
  const result = validateNoPII(data, {
    stripSensitiveFields: false,
    checkValuePatterns: true,
    logWarnings: false,
  });
  
  return result.isValid;
}
