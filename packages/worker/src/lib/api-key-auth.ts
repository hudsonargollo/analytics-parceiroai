/**
 * API Key Authentication Middleware Module
 * 
 * Provides Hono middleware for API key authentication.
 * Validates API keys from X-API-Key header and rejects unauthorized requests.
 */

import { Context, Next } from 'hono';
import type { Env } from '../index';

/**
 * Hono middleware that validates API key authentication.
 * 
 * Extracts the API key from the X-API-Key header,
 * validates it against the VALID_API_KEYS secret,
 * and rejects invalid or missing keys.
 * 
 * @param c - Hono context
 * @param next - Next middleware function
 * @returns Response with 401 if invalid, or calls next() if valid
 * 
 * @example
 * ```typescript
 * app.get('/api/metrics/recovery-rate', authenticateApiKey, async (c) => {
 *   // Handle authenticated request
 * });
 * ```
 */
export async function authenticateApiKey(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  // Extract API key from header
  const apiKey = c.req.header('X-API-Key');
  
  // Check if API key is present
  if (!apiKey) {
    // Log authentication failure
    console.error('API authentication failed: Missing API key', {
      timestamp: new Date().toISOString(),
      path: c.req.path,
      method: c.req.method,
      reason: 'missing_api_key',
    });
    
    // Return 401 Unauthorized
    return c.json(
      { 
        error: 'Unauthorized',
        message: 'Missing API key. Please provide X-API-Key header.'
      },
      401
    );
  }
  
  // Get valid API keys from environment (comma-separated list)
  const validKeys = c.env.VALID_API_KEYS.split(',').map(key => key.trim());
  
  // Validate the API key
  if (!validKeys.includes(apiKey)) {
    // Log authentication failure
    console.error('API authentication failed: Invalid API key', {
      timestamp: new Date().toISOString(),
      path: c.req.path,
      method: c.req.method,
      reason: 'invalid_api_key',
      apiKeyPrefix: apiKey.substring(0, 8) + '...', // Log only prefix for security
    });
    
    // Return 401 Unauthorized
    return c.json(
      { 
        error: 'Unauthorized',
        message: 'Invalid API key'
      },
      401
    );
  }
  
  // API key is valid, proceed to next middleware/handler
  await next();
}
