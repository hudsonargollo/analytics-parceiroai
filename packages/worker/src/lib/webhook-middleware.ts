/**
 * Webhook Middleware Module
 * 
 * Provides Hono middleware for webhook signature validation.
 * Validates HMAC signatures and rejects unauthorized requests.
 */

import { Context, Next } from 'hono';
import { validateHmacSignature } from './hmac-validation';
import type { Env } from '../index';

/**
 * Hono middleware that validates webhook HMAC signatures.
 * 
 * Extracts the signature from the X-Webhook-Signature header,
 * validates it against the request body, and rejects invalid requests.
 * 
 * Note: This middleware reads the request body for validation. Hono automatically
 * handles body re-reading in subsequent handlers through its internal caching.
 * 
 * @param c - Hono context
 * @param next - Next middleware function
 * @returns Response with 401 if invalid, or calls next() if valid
 * 
 * @example
 * ```typescript
 * app.post('/webhooks/payment', validateWebhookSignature, async (c) => {
 *   const body = await c.req.json(); // Body can still be read here
 *   // Handle validated webhook
 * });
 * ```
 */
export async function validateWebhookSignature(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  // Extract signature from header
  const signature = c.req.header('X-Webhook-Signature');
  
  // Get the raw request body as text
  // We need to clone the request to read the body without consuming it
  const clonedReq = c.req.raw.clone();
  const body = await clonedReq.text();
  
  // Get the webhook secret from environment
  const secret = c.env.WEBHOOK_SECRET;
  
  // Validate the signature
  const isValid = await validateHmacSignature(signature, body, secret);
  
  if (!isValid) {
    // Log authentication failure
    console.error('Webhook authentication failed', {
      timestamp: new Date().toISOString(),
      path: c.req.path,
      hasSignature: !!signature,
      signatureLength: signature?.length || 0,
    });
    
    // Return 401 Unauthorized
    return c.json(
      { 
        error: 'Unauthorized',
        message: 'Invalid or missing webhook signature'
      },
      401
    );
  }
  
  // Signature is valid, proceed to next middleware/handler
  await next();
}
