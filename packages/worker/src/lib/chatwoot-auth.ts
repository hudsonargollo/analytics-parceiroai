import { Context, Next } from 'hono';

/**
 * Middleware to authenticate Chatwoot API requests using bearer token
 * 
 * Validates the Authorization header against the CHATWOOT_TOKEN secret.
 * Returns 401 Unauthorized if the token is missing or invalid.
 * 
 * Requirements: 7.2, 7.4
 */
export async function authenticateChatwootToken(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader) {
    return c.json({
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    }, 401);
  }
  
  // Extract bearer token
  const token = authHeader.replace(/^Bearer\s+/i, '');
  
  if (!token) {
    return c.json({
      error: 'Unauthorized',
      message: 'Invalid Authorization header format'
    }, 401);
  }
  
  // Validate against CHATWOOT_TOKEN secret
  const validToken = c.env.CHATWOOT_TOKEN;
  
  if (token !== validToken) {
    // Log authentication failure
    console.warn('Chatwoot authentication failed', {
      timestamp: new Date().toISOString(),
      endpoint: c.req.path,
    });
    
    return c.json({
      error: 'Unauthorized',
      message: 'Invalid Chatwoot token'
    }, 401);
  }
  
  // Token is valid, proceed to next middleware/handler
  await next();
}
