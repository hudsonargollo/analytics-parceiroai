import { describe, it, expect } from 'vitest';
import { computeHmacSignature, validateHmacSignature } from '../src/lib/hmac-validation';

describe('HMAC Signature Validation', () => {
  const testSecret = 'test-secret-key-12345';
  const testPayload = '{"event":"payment","amount":1000}';

  describe('computeHmacSignature', () => {
    it('should compute a valid HMAC-SHA256 signature', async () => {
      const signature = await computeHmacSignature(testPayload, testSecret);
      
      // Signature should be a 64-character hex string (SHA-256 produces 32 bytes = 64 hex chars)
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce consistent signatures for the same input', async () => {
      const signature1 = await computeHmacSignature(testPayload, testSecret);
      const signature2 = await computeHmacSignature(testPayload, testSecret);
      
      expect(signature1).toBe(signature2);
    });

    it('should produce different signatures for different payloads', async () => {
      const payload1 = '{"event":"payment","amount":1000}';
      const payload2 = '{"event":"payment","amount":2000}';
      
      const signature1 = await computeHmacSignature(payload1, testSecret);
      const signature2 = await computeHmacSignature(payload2, testSecret);
      
      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signatures for different secrets', async () => {
      const secret1 = 'secret-key-1';
      const secret2 = 'secret-key-2';
      
      const signature1 = await computeHmacSignature(testPayload, secret1);
      const signature2 = await computeHmacSignature(testPayload, secret2);
      
      expect(signature1).not.toBe(signature2);
    });

    it('should handle empty payload', async () => {
      const signature = await computeHmacSignature('', testSecret);
      
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle special characters in payload', async () => {
      const specialPayload = '{"text":"Hello 世界 🌍 \n\t\r"}';
      const signature = await computeHmacSignature(specialPayload, testSecret);
      
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('validateHmacSignature', () => {
    it('should validate a correct signature', async () => {
      const signature = await computeHmacSignature(testPayload, testSecret);
      const isValid = await validateHmacSignature(signature, testPayload, testSecret);
      
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect signature', async () => {
      const wrongSignature = 'a'.repeat(64); // Valid hex format but wrong value
      const isValid = await validateHmacSignature(wrongSignature, testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should reject a signature with wrong secret', async () => {
      const signature = await computeHmacSignature(testPayload, 'wrong-secret');
      const isValid = await validateHmacSignature(signature, testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should reject a signature for different payload', async () => {
      const signature = await computeHmacSignature('{"different":"payload"}', testSecret);
      const isValid = await validateHmacSignature(signature, testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should handle missing signature (null)', async () => {
      const isValid = await validateHmacSignature(null, testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should handle missing signature (undefined)', async () => {
      const isValid = await validateHmacSignature(undefined, testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should handle empty string signature', async () => {
      const isValid = await validateHmacSignature('', testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should reject malformed signature (not hex)', async () => {
      const malformedSignature = 'not-a-hex-string-xyz';
      const isValid = await validateHmacSignature(malformedSignature, testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should reject malformed signature (contains spaces)', async () => {
      const signature = await computeHmacSignature(testPayload, testSecret);
      const malformedSignature = signature.slice(0, 32) + ' ' + signature.slice(32);
      const isValid = await validateHmacSignature(malformedSignature, testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong length', async () => {
      const shortSignature = 'a'.repeat(32); // Too short
      const isValid = await validateHmacSignature(shortSignature, testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should be case-insensitive for hex signatures', async () => {
      const signature = await computeHmacSignature(testPayload, testSecret);
      const uppercaseSignature = signature.toUpperCase();
      const isValid = await validateHmacSignature(uppercaseSignature, testPayload, testSecret);
      
      expect(isValid).toBe(true);
    });

    it('should handle signature with mixed case', async () => {
      const signature = await computeHmacSignature(testPayload, testSecret);
      const mixedCaseSignature = signature
        .split('')
        .map((char, i) => (i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
        .join('');
      const isValid = await validateHmacSignature(mixedCaseSignature, testPayload, testSecret);
      
      expect(isValid).toBe(true);
    });

    it('should reject signature that differs by one character', async () => {
      const signature = await computeHmacSignature(testPayload, testSecret);
      // Change one character in the middle
      const tamperedSignature = 
        signature.slice(0, 32) + 
        (signature[32] === 'a' ? 'b' : 'a') + 
        signature.slice(33);
      const isValid = await validateHmacSignature(tamperedSignature, testPayload, testSecret);
      
      expect(isValid).toBe(false);
    });

    it('should handle very long payloads', async () => {
      const longPayload = JSON.stringify({ data: 'x'.repeat(10000) });
      const signature = await computeHmacSignature(longPayload, testSecret);
      const isValid = await validateHmacSignature(signature, longPayload, testSecret);
      
      expect(isValid).toBe(true);
    });

    it('should handle payloads with unicode characters', async () => {
      const unicodePayload = '{"message":"Hello 世界 🌍 مرحبا"}';
      const signature = await computeHmacSignature(unicodePayload, testSecret);
      const isValid = await validateHmacSignature(signature, unicodePayload, testSecret);
      
      expect(isValid).toBe(true);
    });

    it('should handle payloads with newlines and special characters', async () => {
      const specialPayload = '{"text":"Line 1\\nLine 2\\tTabbed\\r\\nWindows"}';
      const signature = await computeHmacSignature(specialPayload, testSecret);
      const isValid = await validateHmacSignature(signature, specialPayload, testSecret);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty secret', async () => {
      const signature = await computeHmacSignature(testPayload, '');
      const isValid = await validateHmacSignature(signature, testPayload, '');
      
      expect(isValid).toBe(true);
    });

    it('should handle very long secret', async () => {
      const longSecret = 'x'.repeat(1000);
      const signature = await computeHmacSignature(testPayload, longSecret);
      const isValid = await validateHmacSignature(signature, testPayload, longSecret);
      
      expect(isValid).toBe(true);
    });

    it('should handle secret with special characters', async () => {
      const specialSecret = 'secret!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const signature = await computeHmacSignature(testPayload, specialSecret);
      const isValid = await validateHmacSignature(signature, testPayload, specialSecret);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Security Properties', () => {
    it('should use constant-time comparison (timing attack resistance)', async () => {
      // This test verifies that validation doesn't short-circuit on mismatch
      // While we can't directly test timing, we can verify behavior is consistent
      const signature = await computeHmacSignature(testPayload, testSecret);
      
      // Create signatures that differ at different positions
      const earlyDiff = '0' + signature.slice(1);
      const lateDiff = signature.slice(0, -1) + '0';
      
      const result1 = await validateHmacSignature(earlyDiff, testPayload, testSecret);
      const result2 = await validateHmacSignature(lateDiff, testPayload, testSecret);
      
      // Both should be false regardless of where the difference is
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should not leak information through exceptions', async () => {
      // Validation should return false, not throw, for any invalid input
      const invalidInputs = [
        null,
        undefined,
        '',
        'not-hex',
        '123',
        'g'.repeat(64), // Invalid hex character
      ];

      for (const input of invalidInputs) {
        const result = await validateHmacSignature(input, testPayload, testSecret);
        expect(result).toBe(false);
      }
    });
  });
});
