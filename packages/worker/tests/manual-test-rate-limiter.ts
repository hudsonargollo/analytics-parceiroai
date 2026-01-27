/**
 * Manual test for rate limiting middleware
 * 
 * Run with: npx tsx tests/manual-test-rate-limiter.ts
 */

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
}

// Test cases
async function runTests() {
  console.log('🧪 Running Rate Limiting Middleware Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Allow requests within rate limit
  try {
    console.log('Test 1: Allow requests within rate limit');
    const mockKV = new MockKVNamespace();
    const app = new Hono<{ Bindings: TestEnv }>();
    app.get('/api/test', rateLimiter(100), (c) => {
      return c.json({ message: 'success' });
    });
    
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { 'X-API-Key': 'test-key-1' },
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    if (res.status === 200) {
      console.log('✅ Request allowed within rate limit');
      passed++;
    } else {
      console.log(`❌ Expected 200, got ${res.status}`);
      failed++;
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    failed++;
    console.log('');
  }
  
  // Test 2: Track request count in KV
  try {
    console.log('Test 2: Track request count in KV');
    const mockKV = new MockKVNamespace();
    const app = new Hono<{ Bindings: TestEnv }>();
    app.get('/api/test', rateLimiter(100), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Make 3 requests
    for (let i = 0; i < 3; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: { 'X-API-Key': 'test-key-2' },
      });
      await app.fetch(req, env);
    }
    
    // Check KV count
    const currentMinute = Math.floor(Date.now() / 60000);
    const rateLimitKey = `rate_limit:test-key-2:${currentMinute}`;
    const count = await mockKV.get(rateLimitKey);
    
    if (count === '3') {
      console.log('✅ Request count tracked correctly in KV');
      passed++;
    } else {
      console.log(`❌ Expected count '3', got '${count}'`);
      failed++;
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    failed++;
    console.log('');
  }
  
  // Test 3: Return 429 after exceeding rate limit
  try {
    console.log('Test 3: Return 429 after exceeding rate limit');
    const mockKV = new MockKVNamespace();
    const app = new Hono<{ Bindings: TestEnv }>();
    const limit = 5;
    app.get('/api/test', rateLimiter(limit), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Make requests up to the limit
    for (let i = 0; i < limit; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: { 'X-API-Key': 'test-key-3' },
      });
      await app.fetch(req, env);
    }
    
    // The next request should be rate limited
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { 'X-API-Key': 'test-key-3' },
    });
    const res = await app.fetch(req, env);
    
    if (res.status === 429) {
      const body = await res.json() as any;
      if (body.error === 'Rate limit exceeded' && body.retry_after) {
        console.log('✅ Rate limit enforced with 429 response');
        console.log(`   Retry-After: ${body.retry_after} seconds`);
        passed++;
      } else {
        console.log(`❌ 429 response missing expected fields`);
        console.log(`   Body:`, body);
        failed++;
      }
    } else {
      console.log(`❌ Expected 429, got ${res.status}`);
      failed++;
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    failed++;
    console.log('');
  }
  
  // Test 4: Include Retry-After header
  try {
    console.log('Test 4: Include Retry-After header in 429 response');
    const mockKV = new MockKVNamespace();
    const app = new Hono<{ Bindings: TestEnv }>();
    const limit = 3;
    app.get('/api/test', rateLimiter(limit), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Exceed the limit
    for (let i = 0; i < limit; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: { 'X-API-Key': 'test-key-4' },
      });
      await app.fetch(req, env);
    }
    
    // Make rate-limited request
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { 'X-API-Key': 'test-key-4' },
    });
    const res = await app.fetch(req, env);
    
    const retryAfterHeader = res.headers.get('Retry-After');
    if (retryAfterHeader) {
      const retryAfter = parseInt(retryAfterHeader, 10);
      if (retryAfter > 0 && retryAfter <= 60) {
        console.log('✅ Retry-After header present and valid');
        console.log(`   Value: ${retryAfter} seconds`);
        passed++;
      } else {
        console.log(`❌ Retry-After value out of range: ${retryAfter}`);
        failed++;
      }
    } else {
      console.log(`❌ Retry-After header missing`);
      failed++;
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    failed++;
    console.log('');
  }
  
  // Test 5: Track rate limits separately per API key
  try {
    console.log('Test 5: Track rate limits separately per API key');
    const mockKV = new MockKVNamespace();
    const app = new Hono<{ Bindings: TestEnv }>();
    const limit = 3;
    app.get('/api/test', rateLimiter(limit), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Exhaust limit for first API key
    for (let i = 0; i < limit; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: { 'X-API-Key': 'test-key-5a' },
      });
      await app.fetch(req, env);
    }
    
    // First API key should be rate limited
    const req1 = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { 'X-API-Key': 'test-key-5a' },
    });
    const res1 = await app.fetch(req1, env);
    
    // Second API key should still work
    const req2 = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { 'X-API-Key': 'test-key-5b' },
    });
    const res2 = await app.fetch(req2, env);
    
    if (res1.status === 429 && res2.status === 200) {
      console.log('✅ Rate limits tracked separately per API key');
      passed++;
    } else {
      console.log(`❌ Expected 429 and 200, got ${res1.status} and ${res2.status}`);
      failed++;
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    failed++;
    console.log('');
  }
  
  // Test 6: Allow requests without API key to pass through
  try {
    console.log('Test 6: Allow requests without API key to pass through');
    const mockKV = new MockKVNamespace();
    const app = new Hono<{ Bindings: TestEnv }>();
    app.get('/api/test', rateLimiter(100), (c) => {
      return c.json({ message: 'success' });
    });
    
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      // No X-API-Key header
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    const res = await app.fetch(req, env);
    
    if (res.status === 200) {
      console.log('✅ Requests without API key pass through');
      passed++;
    } else {
      console.log(`❌ Expected 200, got ${res.status}`);
      failed++;
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    failed++;
    console.log('');
  }
  
  // Test 7: Use default limit of 100 requests per minute
  try {
    console.log('Test 7: Use default limit of 100 requests per minute');
    const mockKV = new MockKVNamespace();
    const app = new Hono<{ Bindings: TestEnv }>();
    app.get('/api/test', rateLimiter(), (c) => {
      return c.json({ message: 'success' });
    });
    
    const env: TestEnv = {
      KV: mockKV as unknown as KVNamespace,
    } as TestEnv;
    
    // Make 100 requests (should all succeed)
    let allSucceeded = true;
    for (let i = 0; i < 100; i++) {
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: { 'X-API-Key': 'test-key-7' },
      });
      const res = await app.fetch(req, env);
      if (res.status !== 200) {
        allSucceeded = false;
        break;
      }
    }
    
    // 101st request should be rate limited
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { 'X-API-Key': 'test-key-7' },
    });
    const res = await app.fetch(req, env);
    
    if (allSucceeded && res.status === 429) {
      console.log('✅ Default limit of 100 requests per minute enforced');
      passed++;
    } else {
      console.log(`❌ Default limit not working correctly`);
      console.log(`   All 100 succeeded: ${allSucceeded}, 101st status: ${res.status}`);
      failed++;
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    failed++;
    console.log('');
  }
  
  console.log('─'.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
