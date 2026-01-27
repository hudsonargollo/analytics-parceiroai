/**
 * Unit tests for rate limiting middleware
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimiter } from '../src/lib/rate-limiter';

// Mock environment type
interface TestEnv {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  N8N_WEBHOOK_URL: string;
  WEBHOOK_SECRET: string;
  ZUCKZAPGO_SECRET: string;
  VALID_API_KEYS: string;
  CHATWOOT_TOKEN: string;
}

// Mock KV namespace for testing
class MockKVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map();
  
  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    // Check if expired
    if (item.expiration && Date.now() > item.expiration) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiration = options?.expirationTtl 
      ? Date.now() + (options.expirationTtl * 1000)
      : undefined;
    
    this.store.set(key, { value, expiration });
  }
  
  // Helper method to clear the store between tests
  clear(): void {
    this.store.clear();
  }
  
  // Helper method to get all keys (for debugging)
  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }
}

describe('Rate Limiting Middleware', () => {
  let app: Hono<{ Bindings: TestEnv }>;
  let mockKV: MockKVNamespace;
  
  beforeEach(() => {
    // Create a fresh Hono app and mock KV for each test
    app = new Hono<{ Bindings: TestEnv }>();
    mockKV = new MockKVNamespace();
    
    // Add a test endpoint that uses the rate limiting middleware
    app.get('/api/test', rateLimiter(100), (c) => {
      return c.json({ message: 'success' });
    });
  });
  
  it('should allow requests within rate limit', async () => {
    const apiKey = 'test-api-key-123';
    
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: 'success' });
  });
  
  it('should track request count in KV', async () => {
    const apiKey = 'test-api-key-123';
    
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Make first request
    await app.fetch(req, env);
    
    // Check that KV has a key for this API key and minute
    const currentMinute = Math.floor(Date.now() / 60000);
    const rateLimitKey = `rate_limit:${apiKey}:${currentMinute}`;
    const count = await mockKV.get(rateLimitKey);
    
    expect(count).toBe('1');
  });
  
  it('should increment request count for multiple requests', async () => {
    const apiKey = 'test-api-key-123';
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
    }
    
    // Check that KV has count of 5
    const currentMinute = Math.floor(Date.now() / 60000);
    const rateLimitKey = `rate_limit:${apiKey}:${currentMinute}`;
    const count = await mockKV.get(rateLimitKey);
    
    expect(count).toBe('5');
  });
  
  it('should return 429 after exceeding rate limit', async () => {
    const apiKey = 'test-api-key-123';
    const limit = 10; // Lower limit for testing
    
    // Create app with lower limit
    const testApp = new Hono<{ Bindings: TestEnv }>();
    testApp.get('/api/test', rateLimiter(limit), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Make requests up to the limit
    for (let i = 0; i < limit; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      
      const res = await testApp.fetch(req, env);
      expect(res.status).toBe(200);
    }
    
    // The next request should be rate limited
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });
    
    const res = await testApp.fetch(req, env);
    
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Rate limit exceeded');
    expect(body).toHaveProperty('retry_after');
    expect(body.retry_after).toBeGreaterThan(0);
    expect(body.retry_after).toBeLessThanOrEqual(60);
  });
  
  it('should include Retry-After header in 429 response', async () => {
    const apiKey = 'test-api-key-123';
    const limit = 5;
    
    // Create app with lower limit
    const testApp = new Hono<{ Bindings: TestEnv }>();
    testApp.get('/api/test', rateLimiter(limit), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Exceed the limit
    for (let i = 0; i < limit; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      await testApp.fetch(req, env);
    }
    
    // Make rate-limited request
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });
    
    const res = await testApp.fetch(req, env);
    
    expect(res.status).toBe(429);
    expect(res.headers.has('Retry-After')).toBe(true);
    
    const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });
  
  it('should track rate limits separately per API key', async () => {
    const apiKey1 = 'test-api-key-1';
    const apiKey2 = 'test-api-key-2';
    const limit = 5;
    
    // Create app with lower limit
    const testApp = new Hono<{ Bindings: TestEnv }>();
    testApp.get('/api/test', rateLimiter(limit), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Make requests with first API key up to limit
    for (let i = 0; i < limit; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey1,
        },
      });
      
      const res = await testApp.fetch(req, env);
      expect(res.status).toBe(200);
    }
    
    // First API key should be rate limited
    const req1 = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey1,
      },
    });
    const res1 = await testApp.fetch(req1, env);
    expect(res1.status).toBe(429);
    
    // Second API key should still work
    const req2 = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey2,
      },
    });
    const res2 = await testApp.fetch(req2, env);
    expect(res2.status).toBe(200);
  });
  
  it('should allow requests without API key to pass through', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      // No X-API-Key header
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    // Should pass through to the handler (which returns 200)
    expect(res.status).toBe(200);
  });
  
  it('should use default limit of 100 requests per minute', async () => {
    const apiKey = 'test-api-key-123';
    
    // Create app without specifying limit (should default to 100)
    const testApp = new Hono<{ Bindings: TestEnv }>();
    testApp.get('/api/test', rateLimiter(), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Make 100 requests (should all succeed)
    for (let i = 0; i < 100; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      
      const res = await testApp.fetch(req, env);
      expect(res.status).toBe(200);
    }
    
    // 101st request should be rate limited
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });
    
    const res = await testApp.fetch(req, env);
    expect(res.status).toBe(429);
  });
  
  it('should set TTL of 60 seconds on rate limit keys', async () => {
    const apiKey = 'test-api-key-123';
    
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Make a request
    await app.fetch(req, env);
    
    // Check that the key has an expiration set
    const currentMinute = Math.floor(Date.now() / 60000);
    const rateLimitKey = `rate_limit:${apiKey}:${currentMinute}`;
    const item = (mockKV as any).store.get(rateLimitKey);
    
    expect(item).toBeDefined();
    expect(item.expiration).toBeDefined();
    
    // Expiration should be approximately 60 seconds from now
    const expectedExpiration = Date.now() + 60000;
    const tolerance = 1000; // 1 second tolerance
    expect(item.expiration).toBeGreaterThan(expectedExpiration - tolerance);
    expect(item.expiration).toBeLessThan(expectedExpiration + tolerance);
  });
  
  it('should include descriptive error message in 429 response', async () => {
    const apiKey = 'test-api-key-123';
    const limit = 3;
    
    // Create app with lower limit
    const testApp = new Hono<{ Bindings: TestEnv }>();
    testApp.get('/api/test', rateLimiter(limit), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Exceed the limit
    for (let i = 0; i < limit; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      await testApp.fetch(req, env);
    }
    
    // Make rate-limited request
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });
    
    const res = await testApp.fetch(req, env);
    const body = await res.json();
    
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.message).toContain('Too many requests');
    expect(body.message).toContain(`${limit} requests per minute`);
  });
});
