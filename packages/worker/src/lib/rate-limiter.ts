/**
 * Rate Limiting Middleware Module
 * 
 * Provides Hono middleware for per-API-key rate limiting.
 * Tracks request count per minute window using KV storage.
 */

import { Context, Next } from 'hono';
import type { Env } from '../index';

/**
 * Creates a Hono middleware that enforces rate limiting per API key.
 * 
 * Tracks the number of requests per API key within a 60-second window.
 * After the limit is exceeded, returns HTTP 429 with a Retry-After header.
 * 
 * @param requestsPerMinute - Maximum number of requests allowed per minute (default: 100)
 * @returns Hono middleware function
 * 
 * @example
 * ```typescript
 * app.get('/api/metrics/recovery-rate', 
 *   authenticateApiKey, 
 *   rateLimiter(100), 
 *   async (c) => {
 *     // Handle rate-limited request
 *   }
 * );
 * ```
 */
export function rateLimiter(requestsPerMinute: number = 100) {
  return async (
    c: Context<{ Bindings: Env }>,
    next: Next
  ): Promise<Response | void> => {
    // Extract API key from header (should be validated by authenticateApiKey middleware first)
    const apiKey = c.req.header('X-API-Key');
    
    // If no API key, let the auth middleware handle it
    if (!apiKey) {
      await next();
      return;
    }
    
    // Calculate the current minute window (Unix timestamp in minutes)
    const currentMinute = Math.floor(Date.now() / 60000);
    
    // Create a unique key for this API key and minute window
    const rateLimitKey = `rate_limit:${apiKey}:${currentMinute}`;
    
    // Get the current request count for this window
    const currentCountStr = await c.env.KV.get(rateLimitKey);
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
    
    // Check if the limit has been exceeded
    if (currentCount >= requestsPerMinute) {
      // Calculate seconds until the next minute window
      const currentSecond = Math.floor(Date.now() / 1000);
      const nextMinute = (currentMinute + 1) * 60;
      const retryAfter = nextMinute - currentSecond;
      
      // Log rate limit exceeded
      console.warn('Rate limit exceeded', {
        timestamp: new Date().toISOString(),
        apiKey: apiKey.substring(0, 8) + '...', // Log only prefix for security
        path: c.req.path,
        currentCount,
        limit: requestsPerMinute,
        retryAfter,
      });
      
      // Return 429 Too Many Requests with Retry-After header
      return c.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Maximum ${requestsPerMinute} requests per minute allowed.`,
          retry_after: retryAfter,
        },
        429,
        {
          'Retry-After': retryAfter.toString(),
        }
      );
    }
    
    // Increment the request count
    const newCount = currentCount + 1;
    
    // Store the updated count with 60-second TTL
    // The TTL ensures the key expires after the minute window
    await c.env.KV.put(rateLimitKey, newCount.toString(), {
      expirationTtl: 60,
    });
    
    // Request is within limits, proceed to next middleware/handler
    await next();
  };
}
