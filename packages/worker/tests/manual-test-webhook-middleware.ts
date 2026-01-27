/**
 * Manual Test for Webhook Middleware
 * 
 * This file demonstrates how to use the webhook validation middleware
 * with a Hono application. Run this file directly to test the middleware.
 * 
 * Usage:
 *   npx tsx tests/manual-test-webhook-middleware.ts
 */

import { Hono } from 'hono';
import { validateWebhookSignature } from '../src/lib/webhook-middleware';
import { computeHmacSignature } from '../src/lib/hmac-validation';
import type { Env } from '../src/index';

// Create a test Hono app
const app = new Hono<{ Bindings: Env }>();

// Add webhook endpoint with signature validation
app.post('/webhooks/payment', validateWebhookSignature, async (c) => {
  const body = await c.req.json();
  console.log('✅ Webhook validated and processed:', body);
  return c.json({ status: 'accepted', event_id: body.event_id }, 202);
});

// Test function
async function testMiddleware() {
  const testSecret = 'my-webhook-secret-key';
  
  console.log('🧪 Testing Webhook Middleware\n');
  
  // Test 1: Valid signature
  console.log('Test 1: Valid signature');
  const validPayload = JSON.stringify({
    event_id: 'evt_123',
    customer_id: 'cust_456',
    amount: 5000,
    status: 'confirmed'
  });
  const validSignature = await computeHmacSignature(validPayload, testSecret);
  
  const validRequest = new Request('http://localhost/webhooks/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': validSignature,
    },
    body: validPayload,
  });
  
  const env: Env = {
    WEBHOOK_SECRET: testSecret,
  } as Env;
  
  const validResponse = await app.fetch(validRequest, env);
  console.log(`Status: ${validResponse.status}`);
  console.log(`Response:`, await validResponse.json());
  console.log('');
  
  // Test 2: Missing signature
  console.log('Test 2: Missing signature');
  const missingSignatureRequest = new Request('http://localhost/webhooks/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: validPayload,
  });
  
  const missingSignatureResponse = await app.fetch(missingSignatureRequest, env);
  console.log(`Status: ${missingSignatureResponse.status}`);
  console.log(`Response:`, await missingSignatureResponse.json());
  console.log('');
  
  // Test 3: Invalid signature
  console.log('Test 3: Invalid signature');
  const invalidSignatureRequest = new Request('http://localhost/webhooks/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': 'invalid-signature-abc123',
    },
    body: validPayload,
  });
  
  const invalidSignatureResponse = await app.fetch(invalidSignatureRequest, env);
  console.log(`Status: ${invalidSignatureResponse.status}`);
  console.log(`Response:`, await invalidSignatureResponse.json());
  console.log('');
  
  // Test 4: Tampered payload
  console.log('Test 4: Tampered payload (signature for different data)');
  const originalPayload = JSON.stringify({ amount: 1000 });
  const signatureForOriginal = await computeHmacSignature(originalPayload, testSecret);
  const tamperedPayload = JSON.stringify({ amount: 9999 }); // Changed amount
  
  const tamperedRequest = new Request('http://localhost/webhooks/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signatureForOriginal,
    },
    body: tamperedPayload,
  });
  
  const tamperedResponse = await app.fetch(tamperedRequest, env);
  console.log(`Status: ${tamperedResponse.status}`);
  console.log(`Response:`, await tamperedResponse.json());
  console.log('');
  
  console.log('✅ All tests completed!');
}

// Run tests
testMiddleware().catch(console.error);
