import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authenticateChatwootToken } from '../src/lib/chatwoot-auth';

interface TestEnv {
  CHATWOOT_TOKEN: string;
}

describe('Chatwoot Authentication Middleware', () => {
  const app = new Hono<{ Bindings: TestEnv }>();
  const VALID_TOKEN = 'test-chatwoot-token-12345';
  
  // Test endpoint with authentication
  app.get('/test', authenticateChatwootToken, (c) => {
    return c.json({ message: 'authenticated' });
  });
  
  it('should accept valid bearer token', async () => {
    const req = new Request('http://localhost/test', {
      headers: {
        'Authorization': `Bearer ${VALID_TOKEN}`,
      },
    });
    
    const res = await app.fetch(req, {
      CHATWOOT_TOKEN: VALID_TOKEN,
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ message: 'authenticated' });
  });
  
  it('should reject request without Authorization header', async () => {
    const req = new Request('http://localhost/test');
    
    const res = await app.fetch(req, {
      CHATWOOT_TOKEN: VALID_TOKEN,
    });
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
    expect(data.message).toBe('Missing Authorization header');
  });
  
  it('should reject request with invalid token', async () => {
    const req = new Request('http://localhost/test', {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });
    
    const res = await app.fetch(req, {
      CHATWOOT_TOKEN: VALID_TOKEN,
    });
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
    expect(data.message).toBe('Invalid Chatwoot token');
  });
  
  it('should reject request with empty bearer token', async () => {
    const req = new Request('http://localhost/test', {
      headers: {
        'Authorization': 'Bearer ',
      },
    });
    
    const res = await app.fetch(req, {
      CHATWOOT_TOKEN: VALID_TOKEN,
    });
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });
  
  it('should handle Authorization header without Bearer prefix', async () => {
    const req = new Request('http://localhost/test', {
      headers: {
        'Authorization': VALID_TOKEN,
      },
    });
    
    const res = await app.fetch(req, {
      CHATWOOT_TOKEN: VALID_TOKEN,
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ message: 'authenticated' });
  });
  
  it('should be case-insensitive for Bearer prefix', async () => {
    const req = new Request('http://localhost/test', {
      headers: {
        'Authorization': `bearer ${VALID_TOKEN}`,
      },
    });
    
    const res = await app.fetch(req, {
      CHATWOOT_TOKEN: VALID_TOKEN,
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ message: 'authenticated' });
  });
});
