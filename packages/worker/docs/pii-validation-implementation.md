# PII Validation Implementation

## Overview

This document describes the implementation of PII (Personally Identifiable Information) validation for the Subscription Recovery Analytics system. The validation ensures LGPD (Brazilian Data Protection Law) compliance by preventing storage of sensitive personal information.

**Requirements:** 7.3

## Implementation Details

### Core Module

**File:** `src/lib/pii-validation.ts`

The PII validation module provides functions to detect and reject sensitive personal information in webhook payloads. It implements a multi-layered approach:

1. **Field Name Validation**: Checks if field names indicate sensitive data (e.g., `email`, `phone`, `name`, `cpf`)
2. **Value Pattern Matching**: Scans field values for PII patterns (e.g., email addresses, phone numbers, CPF/CNPJ)
3. **Whitelist Approach**: Explicitly allows only approved fields (customer_id, transaction metadata)

### Key Features

#### 1. Sensitive Field Detection

The module maintains a comprehensive list of sensitive field names in both English and Portuguese:

- **Personal identification**: name, full_name, first_name, last_name, nome
- **Contact information**: email, phone, telephone, mobile, celular, telefone
- **Address information**: address, street, city, state, zip, endereco, rua, cidade, estado, cep
- **Identity documents**: cpf, cnpj, rg, passport, driver_license, ssn, tax_id
- **Financial information**: credit_card, card_number, cvv, bank_account
- **Other sensitive data**: birth_date, age, gender, ip_address, location

#### 2. Pattern Matching

The module uses regex patterns to detect PII in field values:

- Email addresses: `user@example.com`
- Phone numbers: `(11) 98765-4321`, `+55 11 98765-4321`
- CPF (Brazilian tax ID): `123.456.789-00`
- CNPJ (Brazilian company ID): `12.345.678/0001-90`
- Credit card numbers
- IP addresses

#### 3. Allowed Fields (Whitelist)

Only these fields are permitted for storage:

- **Identifiers**: event_id, customer_id, invoice_id, message_id, transaction_id
- **Transaction metadata**: amount, payment_method, status, due_date, timestamp
- **Engagement metadata**: message_status, delivery_status, read_status
- **Payment metadata**: pix_code, boleto_url, payment_link
- **Analytics metadata**: cohort_month, subscription_plan, recovery_time_hours

### API Functions

#### `validateNoPII(data, options)`

Main validation function that checks a payload for PII violations.

**Parameters:**
- `data`: Record<string, any> - The payload to validate
- `options`: PIIValidationOptions
  - `stripSensitiveFields`: boolean - If true, remove PII fields instead of rejecting
  - `checkValuePatterns`: boolean - If true, scan values for PII patterns
  - `logWarnings`: boolean - If true, log warnings when PII detected

**Returns:** PIIValidationResult
- `isValid`: boolean - True if no PII detected
- `violations`: PIIViolation[] - Array of detected violations
- `sanitizedData`: Record<string, any> - Cleaned data (if stripping enabled)

**Example:**
```typescript
const result = validateNoPII({
  customer_id: 'cust_123',
  amount: 5000,
  email: 'user@example.com' // PII violation!
});

if (!result.isValid) {
  console.error('PII detected:', result.violations);
  // violations: [{ field: 'email', reason: '...', value: '[REDACTED]' }]
}
```

#### `validatePaymentWebhookPII(payload, options)`

Convenience wrapper for validating payment webhook payloads.

#### `validateEngagementWebhookPII(payload, options)`

Convenience wrapper for validating engagement webhook payloads.

#### `sanitizePII(data)`

Removes all PII fields from a payload, returning only clean data.

**Example:**
```typescript
const clean = sanitizePII({
  customer_id: 'cust_123',
  amount: 5000,
  email: 'user@example.com',
  phone: '+55 11 98765-4321'
});
// Returns: { customer_id: 'cust_123', amount: 5000 }
```

#### `isCleanPayload(data)`

Quick boolean check for PII presence.

**Example:**
```typescript
if (isCleanPayload(payload)) {
  // Safe to process
}
```

## Integration with Webhooks

### Payment Webhook

**File:** `src/index.ts`

The payment webhook endpoint validates all incoming payloads before processing:

```typescript
app.post('/webhooks/payment', validateWebhookSignature, async (c) => {
  const payload = await c.req.json<PaymentWebhookPayload>();
  
  // Validate PII compliance
  const piiValidation = validatePaymentWebhookPII(payload, {
    stripSensitiveFields: false, // Reject entire payload if PII detected
    checkValuePatterns: true,
    logWarnings: true,
  });
  
  if (!piiValidation.isValid) {
    return c.json({
      error: 'Bad Request',
      message: 'Payload contains sensitive personal information',
      details: 'Only customer_id and transaction metadata are allowed',
      violations: piiValidation.violations.map(v => ({
        field: v.field,
        reason: v.reason,
      })),
    }, 400);
  }
  
  // Process clean payload...
});
```

### Engagement Webhook

Similar validation is applied to engagement webhooks to ensure no PII is stored in engagement event records.

## Validation Behavior

### Rejection Mode (Default)

When `stripSensitiveFields: false` (default):
- Entire payload is rejected if any PII detected
- Returns HTTP 400 with detailed violation information
- Logs warning with violation details
- No data is stored

### Stripping Mode

When `stripSensitiveFields: true`:
- PII fields are removed from payload
- Clean fields are retained
- Processing continues with sanitized data
- Logs warning about stripped fields

## Logging

When PII is detected, the system logs structured warnings:

```json
{
  "timestamp": "2024-01-27T12:00:00Z",
  "violationCount": 2,
  "violations": [
    {
      "field": "email",
      "reason": "Field name indicates sensitive personal information"
    },
    {
      "field": "phone",
      "reason": "Field name indicates sensitive personal information"
    }
  ],
  "action": "rejected"
}
```

Values are redacted in logs to prevent PII leakage:
- Field names: Logged as-is
- Field values: Redacted as `[REDACTED]` or truncated with `...[REDACTED]`

## Testing

### Unit Tests

**File:** `tests/pii-validation.test.ts`

Comprehensive test suite covering:
- Clean payload acceptance
- Sensitive field detection (email, phone, name, address, CPF, etc.)
- Multiple PII field detection
- Pattern matching in values (email, phone, CPF patterns)
- Allowed field acceptance (pix_code, boleto_url)
- Field stripping functionality
- Edge cases (empty payloads, null values, case-insensitive matching)
- Brazilian Portuguese field names
- Helper function behavior

### Manual Testing

**File:** `tests/manual-test-pii-validation.ts`

Interactive test script that validates all functionality:

```bash
npx tsx tests/manual-test-pii-validation.ts
```

Expected output: All tests show ✅ PASS

## Compliance

### LGPD Requirements

The implementation satisfies LGPD Article 6 requirements:

1. **Purpose Limitation**: Only transaction metadata stored, no personal data
2. **Data Minimization**: Strict whitelist of allowed fields
3. **Transparency**: Clear violation messages explain what was rejected
4. **Security**: PII detection prevents accidental storage
5. **Accountability**: Comprehensive logging of all PII detection events

### Allowed Data

Per Requirement 7.3, the system stores ONLY:
- **customer_id**: Non-PII identifier (not linked to personal data in this system)
- **Transaction metadata**: amounts, dates, statuses, payment methods
- **Engagement metadata**: message delivery/read statuses
- **Analytics metadata**: cohort groupings, recovery metrics

### Prohibited Data

The system REJECTS any payload containing:
- Names (full, first, last)
- Email addresses
- Phone numbers
- Physical addresses
- Identity documents (CPF, CNPJ, RG, passport)
- Financial account details (beyond transaction codes)
- Demographic information (age, gender, birth date)
- Location data (IP addresses, coordinates)

## Error Handling

### Validation Errors

When PII is detected, the webhook returns:

**Status:** 400 Bad Request

**Body:**
```json
{
  "error": "Bad Request",
  "message": "Payload contains sensitive personal information that cannot be stored",
  "details": "Only customer_id and transaction metadata are allowed per LGPD compliance",
  "violations": [
    {
      "field": "email",
      "reason": "Field name indicates sensitive personal information"
    }
  ]
}
```

### Logging Errors

All PII detection events are logged with:
- Timestamp
- Event/message ID (for traceability)
- Customer ID (for support)
- Violation count and details
- Action taken (rejected/stripped)

## Performance Considerations

### Validation Speed

- Field name checks: O(n × m) where n = payload fields, m = sensitive field list
- Pattern matching: O(n × p) where p = number of patterns
- Typical validation time: < 1ms for standard payloads

### Optimization

- Whitelist check happens first (early exit for allowed fields)
- Pattern matching can be disabled for performance
- Case-insensitive matching uses lowercase conversion (cached)

## Future Enhancements

Potential improvements for future iterations:

1. **Configurable Sensitivity Levels**: Allow different strictness levels
2. **Custom Field Lists**: Per-tenant allowed/blocked field configuration
3. **ML-Based Detection**: Use machine learning to detect PII in unstructured text
4. **Audit Trail**: Store PII detection events in separate audit log
5. **Data Masking**: Partial masking instead of full rejection (e.g., last 4 digits)
6. **Compliance Reports**: Generate LGPD compliance reports from validation logs

## References

- **LGPD (Lei Geral de Proteção de Dados)**: Brazilian Data Protection Law
- **Requirement 7.3**: System SHALL NOT store sensitive personal information beyond customer_id and transaction metadata
- **Design Document**: Section on Data Privacy Compliance
- **Property 23**: Data Privacy Compliance property-based test

## Support

For questions or issues related to PII validation:

1. Check validation logs for specific violation details
2. Review allowed fields list in `pii-validation.ts`
3. Run manual test script to verify behavior
4. Consult LGPD compliance documentation

## Changelog

### Version 1.0 (Task 17.1)
- Initial implementation of PII validation
- Support for English and Portuguese field names
- Pattern matching for common PII formats
- Integration with payment and engagement webhooks
- Comprehensive test coverage
- Documentation and manual testing tools
