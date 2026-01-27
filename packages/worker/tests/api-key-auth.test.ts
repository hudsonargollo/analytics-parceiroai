/**
 * Unit tests for API key authentication middleware
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authenticateApiKey } from '../src/lib/api-key-auth';

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

describe('API Key Authentication Middleware', () => {
  let app: Hono<{ Bindings: TestEnv }>;
  
  beforeEach(() => {
    // Create a fresh Hono app for each test
    app = new Hono<{ Bindings: TestEnv }>();
    
    // Add a test endpoint that uses the authentication middleware
    app.get('/api/test', authenticateApiKey, (c) => {
      return c.json({ message: 'authenticated' });
    });
  });
  
  it('should accept requests with valid API key', async () => {
    const validKey = 'test-api-key-123';
    
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': validKey,
      },
    });
    
    const env: TestEnv = {
      VALID_API_KEYS: validKey,
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: 'authenticated' });
  });
  
  it('should accept requests with valid API key from comma-separated list', async () => {
    const validKey = 'test-api-key-2';
    
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': validKey,
      },
    });
    
    const env: TestEnv = {
      VALID_API_KEYS: 'test-api-key-1, test-api-key-2, test-api-key-3',
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: 'authenticated' });
  });
  
  it('should reject requests with missing API key', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      // No X-API-Key header
    });
    
    const env: TestEnv = {
      VALID_API_KEYS: 'test-api-key-123',
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Missing API key. Please provide X-API-Key header.',
    });
  });
  
  it('should reject requests with invalid API key', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': 'invalid-key',
      },
    });
    
    const env: TestEnv = {
      VALID_API_KEYS: 'test-api-key-123',
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  });
  
  it('should reject requests with empty API key', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': '',
      },
    });
    
    const env: TestEnv = {
      VALID_API_KEYS: 'test-api-key-123',
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Missing API key. Please provide X-API-Key header.',
    });
  });
  
  it('should handle whitespace in VALID_API_KEYS list', async () => {
    const validKey = 'test-api-key-2';
    
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': validKey,
      },
    });
    
    const env: TestEnv = {
      // Keys with extra whitespace
      VALID_API_KEYS: '  test-api-key-1  ,  test-api-key-2  ,  test-api-key-3  ',
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: 'authenticated' });
  });
  
  it('should work with single API key (no commas)', async () => {
    const validKey = 'single-api-key';
    
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': validKey,
      },
    });
    
    const env: TestEnv = {
      VALID_API_KEYS: validKey,
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: 'authenticated' });
  });
  
  it('should be case-sensitive for API keys', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'X-API-Key': 'Test-API-Key-123', // Different case
      },
    });
    
    const env: TestEnv = {
      VALID_API_KEYS: 'test-api-key-123',
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  });
});
