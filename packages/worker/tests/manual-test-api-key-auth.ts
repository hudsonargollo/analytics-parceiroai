/**
 * Manual test for API key authentication middleware
 * 
 * Run with: npx tsx tests/manual-test-api-key-auth.ts
 */

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

// Test cases
const tests = [
  {
    name: 'Valid API key',
    apiKey: 'test-api-key-123',
    validKeys: 'test-api-key-123',
    expectedStatus: 200,
  },
  {
    name: 'Valid API key from comma-separated list',
    apiKey: 'test-api-key-2',
    validKeys: 'test-api-key-1, test-api-key-2, test-api-key-3',
    expectedStatus: 200,
  },
  {
    name: 'Missing API key',
    apiKey: undefined,
    validKeys: 'test-api-key-123',
    expectedStatus: 401,
  },
  {
    name: 'Invalid API key',
    apiKey: 'invalid-key',
    validKeys: 'test-api-key-123',
    expectedStatus: 401,
  },
  {
    name: 'Empty API key',
    apiKey: '',
    validKeys: 'test-api-key-123',
    expectedStatus: 401,
  },
  {
    name: 'Whitespace handling in VALID_API_KEYS',
    apiKey: 'test-api-key-2',
    validKeys: '  test-api-key-1  ,  test-api-key-2  ,  test-api-key-3  ',
    expectedStatus: 200,
  },
  {
    name: 'Case-sensitive API keys',
    apiKey: 'Test-API-Key-123',
    validKeys: 'test-api-key-123',
    expectedStatus: 401,
  },
];

async function runTests() {
  console.log('🧪 Running API Key Authentication Middleware Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      // Create a fresh Hono app for each test
      const app = new Hono<{ Bindings: TestEnv }>();
      
      // Add a test endpoint that uses the authentication middleware
      app.get('/api/test', authenticateApiKey, (c) => {
        return c.json({ message: 'authenticated' });
      });
      
      // Create request
      const headers: Record<string, string> = {};
      if (test.apiKey !== undefined) {
        headers['X-API-Key'] = test.apiKey;
      }
      
      const req = new Request('http://localhost/api/test', {
        method: 'GET',
        headers,
      });
      
      // Create environment
      const env: TestEnv = {
        VALID_API_KEYS: test.validKeys,
      } as TestEnv;
      
      // Execute request
      const res = await app.fetch(req, env);
      
      // Check result
      if (res.status === test.expectedStatus) {
        console.log(`✅ ${test.name}`);
        console.log(`   Expected: ${test.expectedStatus}, Got: ${res.status}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Expected: ${test.expectedStatus}, Got: ${res.status}`);
        const body = await res.json();
        console.log(`   Response:`, body);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error:`, error instanceof Error ? error.message : error);
      failed++;
    }
    
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
