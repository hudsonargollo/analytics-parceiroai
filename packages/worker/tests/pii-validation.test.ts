/**
 * PII Validation Tests
 * 
 * Tests for the PII validation module that prevents storage of
 * Personally Identifiable Information per LGPD compliance.
 * 
 * Requirements: 7.3
 */

import { describe, it, expect } from 'vitest';
import {
  validateNoPII,
  validatePaymentWebhookPII,
  validateEngagementWebhookPII,
  sanitizePII,
  isCleanPayload,
} from '../src/lib/pii-validation';

describe('PII Validation', () => {
  describe('validateNoPII', () => {
    it('should accept clean payment payload with only allowed fields', () => {
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
      
      const result = validateNoPII(cleanPayload);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
    
    it('should reject payload with email field', () => {
      const payloadWithEmail = {
        customer_id: 'cust_456',
        amount: 5000,
        email: 'user@example.com',
      };
      
      const result = validateNoPII(payloadWithEmail);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].field).toBe('email');
      expect(result.violations[0].reason).toContain('sensitive personal information');
    });
    
    it('should reject payload with phone field', () => {
      const payloadWithPhone = {
        customer_id: 'cust_456',
        amount: 5000,
        phone: '+55 11 98765-4321',
      };
      
      const result = validateNoPII(payloadWithPhone);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].field).toBe('phone');
    });
    
    it('should reject payload with name field', () => {
      const payloadWithName = {
        customer_id: 'cust_456',
        amount: 5000,
        name: 'John Doe',
      };
      
      const result = validateNoPII(payloadWithName);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].field).toBe('name');
    });
    
    it('should reject payload with address field', () => {
      const payloadWithAddress = {
        customer_id: 'cust_456',
        amount: 5000,
        address: '123 Main St, São Paulo',
      };
      
      const result = validateNoPII(payloadWithAddress);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].field).toBe('address');
    });
    
    it('should reject payload with CPF field', () => {
      const payloadWithCPF = {
        customer_id: 'cust_456',
        amount: 5000,
        cpf: '123.456.789-00',
      };
      
      const result = validateNoPII(payloadWithCPF);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].field).toBe('cpf');
    });
    
    it('should reject payload with multiple PII fields', () => {
      const payloadWithMultiplePII = {
        customer_id: 'cust_456',
        amount: 5000,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+55 11 98765-4321',
        address: '123 Main St',
      };
      
      const result = validateNoPII(payloadWithMultiplePII);
      
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(4);
    });
    
    it('should detect email pattern in field value', () => {
      const payloadWithEmailValue = {
        customer_id: 'cust_456',
        amount: 5000,
        notes: 'Contact user@example.com for details',
      };
      
      const result = validateNoPII(payloadWithEmailValue, {
        checkValuePatterns: true,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].reason).toContain('PII pattern');
    });
    
    it('should detect phone pattern in field value', () => {
      const payloadWithPhoneValue = {
        customer_id: 'cust_456',
        amount: 5000,
        notes: 'Call (11) 98765-4321',
      };
      
      const result = validateNoPII(payloadWithPhoneValue, {
        checkValuePatterns: true,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].reason).toContain('PII pattern');
    });
    
    it('should detect CPF pattern in field value', () => {
      const payloadWithCPFValue = {
        customer_id: 'cust_456',
        amount: 5000,
        notes: 'CPF: 123.456.789-00',
      };
      
      const result = validateNoPII(payloadWithCPFValue, {
        checkValuePatterns: true,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
    });
    
    it('should skip value pattern check when disabled', () => {
      const payloadWithEmailValue = {
        customer_id: 'cust_456',
        amount: 5000,
        notes: 'Contact user@example.com for details',
      };
      
      const result = validateNoPII(payloadWithEmailValue, {
        checkValuePatterns: false,
      });
      
      // Should pass because we're not checking value patterns
      // and 'notes' is not in the sensitive field names list
      expect(result.isValid).toBe(true);
    });
    
    it('should allow pix_code field (transaction metadata)', () => {
      const payloadWithPixCode = {
        customer_id: 'cust_456',
        amount: 5000,
        pix_code: '00020126580014br.gov.bcb.pix...',
      };
      
      const result = validateNoPII(payloadWithPixCode);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
    
    it('should allow boleto_url field (transaction metadata)', () => {
      const payloadWithBoletoUrl = {
        customer_id: 'cust_456',
        amount: 5000,
        boleto_url: 'https://example.com/boleto/123',
      };
      
      const result = validateNoPII(payloadWithBoletoUrl);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
  
  describe('validateNoPII with stripSensitiveFields option', () => {
    it('should strip sensitive fields and return sanitized data', () => {
      const payloadWithPII = {
        customer_id: 'cust_456',
        amount: 5000,
        email: 'user@example.com',
        phone: '+55 11 98765-4321',
      };
      
      const result = validateNoPII(payloadWithPII, {
        stripSensitiveFields: true,
      });
      
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
      expect(result.sanitizedData).toBeDefined();
      expect(result.sanitizedData?.customer_id).toBe('cust_456');
      expect(result.sanitizedData?.amount).toBe(5000);
      expect(result.sanitizedData?.email).toBeUndefined();
      expect(result.sanitizedData?.phone).toBeUndefined();
    });
    
    it('should return all fields in sanitized data when no PII detected', () => {
      const cleanPayload = {
        customer_id: 'cust_456',
        amount: 5000,
        payment_method: 'pix',
      };
      
      const result = validateNoPII(cleanPayload, {
        stripSensitiveFields: true,
      });
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.sanitizedData).toEqual(cleanPayload);
    });
  });
  
  describe('validatePaymentWebhookPII', () => {
    it('should validate payment webhook payload', () => {
      const paymentPayload = {
        event_id: 'evt_123',
        customer_id: 'cust_456',
        invoice_id: 'inv_789',
        amount: 5000,
        payment_method: 'pix',
        status: 'pending',
        due_date: '2024-01-20',
        timestamp: '2024-01-17T10:00:00Z',
      };
      
      const result = validatePaymentWebhookPII(paymentPayload);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
    
    it('should reject payment webhook with PII', () => {
      const paymentPayloadWithPII = {
        event_id: 'evt_123',
        customer_id: 'cust_456',
        amount: 5000,
        customer_email: 'user@example.com',
      };
      
      const result = validatePaymentWebhookPII(paymentPayloadWithPII);
      
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
  
  describe('validateEngagementWebhookPII', () => {
    it('should validate engagement webhook payload', () => {
      const engagementPayload = {
        message_id: 'msg_123',
        customer_id: 'cust_456',
        status: 'delivered',
        timestamp: '2024-01-17T10:05:00Z',
      };
      
      const result = validateEngagementWebhookPII(engagementPayload);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
    
    it('should reject engagement webhook with PII', () => {
      const engagementPayloadWithPII = {
        message_id: 'msg_123',
        customer_id: 'cust_456',
        status: 'delivered',
        phone_number: '+55 11 98765-4321',
      };
      
      const result = validateEngagementWebhookPII(engagementPayloadWithPII);
      
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
  
  describe('sanitizePII', () => {
    it('should remove all PII fields from payload', () => {
      const payloadWithPII = {
        customer_id: 'cust_456',
        amount: 5000,
        email: 'user@example.com',
        phone: '+55 11 98765-4321',
        name: 'John Doe',
      };
      
      const sanitized = sanitizePII(payloadWithPII);
      
      expect(sanitized.customer_id).toBe('cust_456');
      expect(sanitized.amount).toBe(5000);
      expect(sanitized.email).toBeUndefined();
      expect(sanitized.phone).toBeUndefined();
      expect(sanitized.name).toBeUndefined();
    });
    
    it('should return clean payload unchanged', () => {
      const cleanPayload = {
        customer_id: 'cust_456',
        amount: 5000,
        payment_method: 'pix',
      };
      
      const sanitized = sanitizePII(cleanPayload);
      
      expect(sanitized).toEqual(cleanPayload);
    });
  });
  
  describe('isCleanPayload', () => {
    it('should return true for clean payload', () => {
      const cleanPayload = {
        customer_id: 'cust_456',
        amount: 5000,
        payment_method: 'pix',
      };
      
      expect(isCleanPayload(cleanPayload)).toBe(true);
    });
    
    it('should return false for payload with PII', () => {
      const payloadWithPII = {
        customer_id: 'cust_456',
        amount: 5000,
        email: 'user@example.com',
      };
      
      expect(isCleanPayload(payloadWithPII)).toBe(false);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty payload', () => {
      const result = validateNoPII({});
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
    
    it('should handle payload with null values', () => {
      const payloadWithNull = {
        customer_id: 'cust_456',
        amount: 5000,
        notes: null,
      };
      
      const result = validateNoPII(payloadWithNull);
      
      expect(result.isValid).toBe(true);
    });
    
    it('should handle payload with undefined values', () => {
      const payloadWithUndefined = {
        customer_id: 'cust_456',
        amount: 5000,
        notes: undefined,
      };
      
      const result = validateNoPII(payloadWithUndefined);
      
      expect(result.isValid).toBe(true);
    });
    
    it('should handle payload with numeric values', () => {
      const payloadWithNumbers = {
        customer_id: 'cust_456',
        amount: 5000,
        quantity: 3,
        discount: 0.1,
      };
      
      const result = validateNoPII(payloadWithNumbers);
      
      expect(result.isValid).toBe(true);
    });
    
    it('should handle payload with boolean values', () => {
      const payloadWithBooleans = {
        customer_id: 'cust_456',
        amount: 5000,
        is_recurring: true,
        auto_renew: false,
      };
      
      const result = validateNoPII(payloadWithBooleans);
      
      expect(result.isValid).toBe(true);
    });
    
    it('should handle case-insensitive field name matching', () => {
      const payloadWithUpperCase = {
        customer_id: 'cust_456',
        amount: 5000,
        EMAIL: 'user@example.com',
      };
      
      const result = validateNoPII(payloadWithUpperCase);
      
      expect(result.isValid).toBe(false);
      expect(result.violations[0].field).toBe('EMAIL');
    });
    
    it('should detect partial field name matches', () => {
      const payloadWithPartialMatch = {
        customer_id: 'cust_456',
        amount: 5000,
        customer_email: 'user@example.com',
      };
      
      const result = validateNoPII(payloadWithPartialMatch);
      
      expect(result.isValid).toBe(false);
      expect(result.violations[0].field).toBe('customer_email');
    });
    
    it('should redact sensitive values in violation logs', () => {
      const payloadWithPII = {
        customer_id: 'cust_456',
        email: 'user@example.com',
      };
      
      const result = validateNoPII(payloadWithPII);
      
      expect(result.violations[0].value).toBe('[REDACTED]');
    });
    
    it('should handle Brazilian Portuguese field names', () => {
      const payloadWithPortugueseFields = {
        customer_id: 'cust_456',
        amount: 5000,
        nome: 'João Silva',
        telefone: '(11) 98765-4321',
        endereco: 'Rua Principal, 123',
      };
      
      const result = validateNoPII(payloadWithPortugueseFields);
      
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('Logging behavior', () => {
    it('should not log warnings when logWarnings is false', () => {
      const payloadWithPII = {
        customer_id: 'cust_456',
        email: 'user@example.com',
      };
      
      // This test just ensures the function doesn't throw when logging is disabled
      const result = validateNoPII(payloadWithPII, {
        logWarnings: false,
      });
      
      expect(result.isValid).toBe(false);
    });
    
    it('should log warnings by default when PII detected', () => {
      const payloadWithPII = {
        customer_id: 'cust_456',
        email: 'user@example.com',
      };
      
      // This test just ensures the function doesn't throw when logging is enabled
      const result = validateNoPII(payloadWithPII);
      
      expect(result.isValid).toBe(false);
    });
  });
});
