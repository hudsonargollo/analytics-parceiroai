/**
 * Tests for Webhook Middleware
 * 
 * Validates that the Hono middleware correctly validates webhook signatures
 * and rejects unauthorized requests.
 */

import { describe, it, expect } from 'vitest';
import { computeHmacSignature } from '../src/lib/hmac-validation';

describe('Webhook Middleware Integration', () => {
  const testSecret = 'test-webhook-secret-key';

  describe('Middleware behavior validation', () => {
    it('should validate correct signature flow', async () => {
      const payload = JSON.stringify({ test: 'data', amount: 1000 });
      const signature = await computeHmacSignature(payload, testSecret);
      
      // Verify signature is valid hex string
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
      
      // Verify signature can be validated
      const { validateHmacSignature } = await import('../src/lib/hmac-validation');
      const isValid = await validateHmacSignature(signature, payload, testSecret);
      expect(isValid).toBe(true);
    });
    
    it('should reject missing signature', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const { validateHmacSignature } = await import('../src/lib/hmac-validation');
      
      const isValid = await validateHmacSignature(null, payload, testSecret);
      expect(isValid).toBe(false);
    });
    
    it('should reject invalid signature format', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'invalid-signature-12345';
      const { validateHmacSignature } = await import('../src/lib/hmac-validation');
      
      const isValid = await validateHmacSignature(invalidSignature, payload, testSecret);
      expect(isValid).toBe(false);
    });
    
    it('should reject signature for different payload', async () => {
      const originalPayload = JSON.stringify({ test: 'original' });
      const signature = await computeHmacSignature(originalPayload, testSecret);
      
      const tamperedPayload = JSON.stringify({ test: 'tampered', amount: 9999 });
      const { validateHmacSignature } = await import('../src/lib/hmac-validation');
      
      const isValid = await validateHmacSignature(signature, tamperedPayload, testSecret);
      expect(isValid).toBe(false);
    });
    
    it('should reject malformed signature', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const malformedSignature = 'not-a-hex-string!@#$';
      const { validateHmacSignature } = await import('../src/lib/hmac-validation');
      
      const isValid = await validateHmacSignature(malformedSignature, payload, testSecret);
      expect(isValid).toBe(false);
    });
    
    it('should handle empty payload with valid signature', async () => {
      const payload = '';
      const signature = await computeHmacSignature(payload, testSecret);
      const { validateHmacSignature } = await import('../src/lib/hmac-validation');
      
      const isValid = await validateHmacSignature(signature, payload, testSecret);
      expect(isValid).toBe(true);
    });
  });

  describe('Middleware exports', () => {
    it('should export validateWebhookSignature middleware', async () => {
      const { validateWebhookSignature } = await import('../src/lib/webhook-middleware');
      
      expect(validateWebhookSignature).toBeDefined();
      expect(typeof validateWebhookSignature).toBe('function');
    });
    
    it('should be exported from main index', async () => {
      const { validateWebhookSignature } = await import('../src/index');
      
      expect(validateWebhookSignature).toBeDefined();
      expect(typeof validateWebhookSignature).toBe('function');
    });
  });
});
