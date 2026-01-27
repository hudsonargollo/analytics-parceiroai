/**
 * Manual Test Script for PII Validation
 * 
 * This script manually tests the PII validation functionality
 * to ensure it correctly detects and rejects sensitive personal information.
 * 
 * Run with: npx tsx tests/manual-test-pii-validation.ts
 */

import {
  validateNoPII,
  validatePaymentWebhookPII,
  validateEngagementWebhookPII,
  sanitizePII,
  isCleanPayload,
} from '../src/lib/pii-validation';

console.log('=== PII Validation Manual Tests ===\n');

// Test 1: Clean payment payload (should pass)
console.log('Test 1: Clean payment payload');
const cleanPayload = {
  event_id: 'evt_123',
  customer_id: 'cust_456',
  invoice_id: 'inv_789',
  amount: 5000,
  payment_method: 'pix',
  status: 'pending',
  due_date: '2024-01-20',
  timestamp: '2024-01-17T10:00:00Z',
};

const result1 = validatePaymentWebhookPII(cleanPayload);
console.log('Result:', result1.isValid ? '✅ PASS' : '❌ FAIL');
console.log('Violations:', result1.violations.length);
console.log('');

// Test 2: Payload with email field (should fail)
console.log('Test 2: Payload with email field');
const payloadWithEmail = {
  customer_id: 'cust_456',
  amount: 5000,
  email: 'user@example.com',
};

const result2 = validateNoPII(payloadWithEmail);
console.log('Result:', !result2.isValid ? '✅ PASS (correctly rejected)' : '❌ FAIL');
console.log('Violations:', result2.violations);
console.log('');

// Test 3: Payload with phone field (should fail)
console.log('Test 3: Payload with phone field');
const payloadWithPhone = {
  customer_id: 'cust_456',
  amount: 5000,
  phone: '+55 11 98765-4321',
};

const result3 = validateNoPII(payloadWithPhone);
console.log('Result:', !result3.isValid ? '✅ PASS (correctly rejected)' : '❌ FAIL');
console.log('Violations:', result3.violations);
console.log('');

// Test 4: Payload with name field (should fail)
console.log('Test 4: Payload with name field');
const payloadWithName = {
  customer_id: 'cust_456',
  amount: 5000,
  name: 'John Doe',
};

const result4 = validateNoPII(payloadWithName);
console.log('Result:', !result4.isValid ? '✅ PASS (correctly rejected)' : '❌ FAIL');
console.log('Violations:', result4.violations);
console.log('');

// Test 5: Payload with CPF field (should fail)
console.log('Test 5: Payload with CPF field');
const payloadWithCPF = {
  customer_id: 'cust_456',
  amount: 5000,
  cpf: '123.456.789-00',
};

const result5 = validateNoPII(payloadWithCPF);
console.log('Result:', !result5.isValid ? '✅ PASS (correctly rejected)' : '❌ FAIL');
console.log('Violations:', result5.violations);
console.log('');

// Test 6: Payload with multiple PII fields (should fail)
console.log('Test 6: Payload with multiple PII fields');
const payloadWithMultiplePII = {
  customer_id: 'cust_456',
  amount: 5000,
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+55 11 98765-4321',
  address: '123 Main St',
};

const result6 = validateNoPII(payloadWithMultiplePII);
console.log('Result:', !result6.isValid ? '✅ PASS (correctly rejected)' : '❌ FAIL');
console.log('Violations found:', result6.violations.length);
console.log('Expected: 4 or more violations');
console.log('');

// Test 7: Email pattern in field value (should fail)
console.log('Test 7: Email pattern in field value');
const payloadWithEmailValue = {
  customer_id: 'cust_456',
  amount: 5000,
  notes: 'Contact user@example.com for details',
};

const result7 = validateNoPII(payloadWithEmailValue, {
  checkValuePatterns: true,
});
console.log('Result:', !result7.isValid ? '✅ PASS (correctly detected pattern)' : '❌ FAIL');
console.log('Violations:', result7.violations);
console.log('');

// Test 8: Phone pattern in field value (should fail)
console.log('Test 8: Phone pattern in field value');
const payloadWithPhoneValue = {
  customer_id: 'cust_456',
  amount: 5000,
  notes: 'Call (11) 98765-4321',
};

const result8 = validateNoPII(payloadWithPhoneValue, {
  checkValuePatterns: true,
});
console.log('Result:', !result8.isValid ? '✅ PASS (correctly detected pattern)' : '❌ FAIL');
console.log('Violations:', result8.violations);
console.log('');

// Test 9: CPF pattern in field value (should fail)
console.log('Test 9: CPF pattern in field value');
const payloadWithCPFValue = {
  customer_id: 'cust_456',
  amount: 5000,
  notes: 'CPF: 123.456.789-00',
};

const result9 = validateNoPII(payloadWithCPFValue, {
  checkValuePatterns: true,
});
console.log('Result:', !result9.isValid ? '✅ PASS (correctly detected pattern)' : '❌ FAIL');
console.log('Violations:', result9.violations);
console.log('');

// Test 10: Allowed transaction metadata fields (should pass)
console.log('Test 10: Allowed transaction metadata fields');
const payloadWithAllowedFields = {
  customer_id: 'cust_456',
  amount: 5000,
  pix_code: '00020126580014br.gov.bcb.pix...',
  boleto_url: 'https://example.com/boleto/123',
  payment_method: 'pix',
  status: 'pending',
};

const result10 = validateNoPII(payloadWithAllowedFields);
console.log('Result:', result10.isValid ? '✅ PASS' : '❌ FAIL');
console.log('Violations:', result10.violations.length);
console.log('');

// Test 11: Strip sensitive fields
console.log('Test 11: Strip sensitive fields');
const payloadToSanitize = {
  customer_id: 'cust_456',
  amount: 5000,
  email: 'user@example.com',
  phone: '+55 11 98765-4321',
  payment_method: 'pix',
};

const sanitized = sanitizePII(payloadToSanitize);
console.log('Original fields:', Object.keys(payloadToSanitize));
console.log('Sanitized fields:', Object.keys(sanitized));
console.log('Result:', 
  sanitized.customer_id === 'cust_456' && 
  sanitized.amount === 5000 && 
  !sanitized.email && 
  !sanitized.phone ? '✅ PASS' : '❌ FAIL'
);
console.log('');

// Test 12: isCleanPayload helper
console.log('Test 12: isCleanPayload helper');
const cleanCheck = isCleanPayload(cleanPayload);
const dirtyCheck = isCleanPayload(payloadWithEmail);
console.log('Clean payload check:', cleanCheck ? '✅ PASS' : '❌ FAIL');
console.log('Dirty payload check:', !dirtyCheck ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 13: Clean engagement webhook
console.log('Test 13: Clean engagement webhook');
const cleanEngagement = {
  message_id: 'msg_123',
  customer_id: 'cust_456',
  status: 'delivered',
  timestamp: '2024-01-17T10:05:00Z',
};

const result13 = validateEngagementWebhookPII(cleanEngagement);
console.log('Result:', result13.isValid ? '✅ PASS' : '❌ FAIL');
console.log('Violations:', result13.violations.length);
console.log('');

// Test 14: Engagement webhook with PII
console.log('Test 14: Engagement webhook with PII');
const dirtyEngagement = {
  message_id: 'msg_123',
  customer_id: 'cust_456',
  status: 'delivered',
  phone_number: '+55 11 98765-4321',
};

const result14 = validateEngagementWebhookPII(dirtyEngagement);
console.log('Result:', !result14.isValid ? '✅ PASS (correctly rejected)' : '❌ FAIL');
console.log('Violations:', result14.violations);
console.log('');

// Test 15: Brazilian Portuguese field names
console.log('Test 15: Brazilian Portuguese field names');
const payloadWithPortugueseFields = {
  customer_id: 'cust_456',
  amount: 5000,
  nome: 'João Silva',
  telefone: '(11) 98765-4321',
  endereco: 'Rua Principal, 123',
};

const result15 = validateNoPII(payloadWithPortugueseFields);
console.log('Result:', !result15.isValid ? '✅ PASS (correctly rejected)' : '❌ FAIL');
console.log('Violations found:', result15.violations.length);
console.log('Expected: 3 violations (nome, telefone, endereco)');
console.log('');

// Test 16: Case-insensitive field matching
console.log('Test 16: Case-insensitive field matching');
const payloadWithUpperCase = {
  customer_id: 'cust_456',
  amount: 5000,
  EMAIL: 'user@example.com',
  PHONE: '+55 11 98765-4321',
};

const result16 = validateNoPII(payloadWithUpperCase);
console.log('Result:', !result16.isValid ? '✅ PASS (correctly rejected)' : '❌ FAIL');
console.log('Violations:', result16.violations.map(v => v.field));
console.log('');

// Summary
console.log('=== Test Summary ===');
console.log('All tests completed. Review results above.');
console.log('✅ = Test passed');
console.log('❌ = Test failed');
console.log('');
console.log('PII validation is working correctly if all tests show ✅');
