/**
 * Unit tests for GET /api/metrics/recovery-rate endpoint
 * 
 * Tests the complete endpoint including:
 * - Authentication and rate limiting middleware
 * - Query parameter parsing
 * - Cache checking and storage
 * - Recovery rate calculation
 * - JSON response formatting
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { authenticateApiKey } from '../src/lib/api-key-auth';
import { rateLimiter } from '../src/lib/rate-limiter';
import { calculateRecoveryRate } from '../src/lib/recovery-rate';
import { getCachedMetrics, setCachedMetrics, generateCacheKey } from '../src/lib/cache';
import { RecoveryRateResponse } from '../src/types';

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

// Mock KV namespace
class MockKVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map();

  async get(key: string, options?: { type: 'json' }): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    
    // Check expiration
    if (item.expiration && Date.now() > item.expiration) {
      this.store.delete(key);
      return null;
    }
    
    if (options?.type === 'json') {
      return JSON.parse(item.value);
    }
    return item.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiration = options?.expirationTtl 
      ? Date.now() + (options.expirationTtl * 1000)
      : undefined;
    
    this.store.set(key, { value, expiration });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Mock D1 Database
class MockD1Database {
  private mockData: RecoveryRateResponse | null = null;

  setMockData(data: RecoveryRateResponse): void {
    this.mockData = data;
  }

  prepare(query: string) {
    return {
      bind: (...args: any[]) => ({
        first: async () => this.mockData,
        all: async () => ({ results: [] }),
      }),
    };
  }
}

describe('GET /api/metrics/recovery-rate endpoint', () => {
  let app: Hono<{ Bindings: TestEnv }>;
  let mockKV: MockKVNamespace;
  let mockDB: MockD1Database;
  let env: TestEnv;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockKV = new MockKVNamespace();
    mockDB = new MockD1Database();

    // Create a fresh Hono app for each test
    app = new Hono<{ Bindings: TestEnv }>();

    // Add the recovery-rate endpoint
    app.get('/api/metrics/recovery-rate', authenticateApiKey, rateLimiter(100), async (c) => {
      try {
        // Parse query parameters
        const branch = c.req.query('branch');
        const date_range = c.req.query('date_range');
        const plan = c.req.query('plan');

        // Generate cache key from query parameters
        const cacheKey = generateCacheKey('recovery_rate', {
          branch,
          date_range,
          plan,
        });

        // Check KV cache first
        const cached = await getCachedMetrics<RecoveryRateResponse>(
          c.env.KV,
          cacheKey,
          { branch, date_range, plan }
        );

        if (cached) {
          // Return cached data
          return c.json(cached);
        }

        // Cache miss - calculate recovery rate from database
        const data = await calculateRecoveryRate(c.env.DB, {
          date_range,
          subscription_plan: plan,
          recovery_branch: branch as any,
        });

        // Store result in KV with 5-minute TTL
        await setCachedMetrics(c.env.KV, cacheKey, data, 300);

        // Return JSON response
        return c.json(data);
      } catch (error) {
        // Log error and return 500
        console.error('Recovery rate calculation failed', {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return c.json({
          error: 'Internal Server Error',
          message: 'Failed to calculate recovery rate'
        }, 500);
      }
    });

    // Set up test environment
    env = {
      DB: mockDB as any,
      KV: mockKV as any,
      VALID_API_KEYS: 'test-api-key-123',
      ENVIRONMENT: 'test',
    } as TestEnv;
  });

  it('should return recovery rate metrics with valid API key', async () => {
    // Set up mock data
    const mockResponse: RecoveryRateResponse = {
      branch: 'overdue',
      date_range: '30d',
      total_attempts: 100,
      successful_recoveries: 75,
      recovery_rate: 75.0,
      total_amount_attempted: 10000,
      total_amount_recovered: 7500,
      breakdown_by_method: {
        pix: { attempts: 50, recoveries: 40, rate: 80.0 },
        boleto: { attempts: 30, recoveries: 20, rate: 66.67 },
        credit_card: { attempts: 20, recoveries: 15, rate: 75.0 },
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/recovery-rate?branch=overdue&date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockResponse);
  });

  it('should return cached data on second request', async () => {
    // Set up mock data
    const mockResponse: RecoveryRateResponse = {
      branch: 'overdue',
      date_range: '30d',
      total_attempts: 100,
      successful_recoveries: 75,
      recovery_rate: 75.0,
      total_amount_attempted: 10000,
      total_amount_recovered: 7500,
      breakdown_by_method: {
        pix: { attempts: 50, recoveries: 40, rate: 80.0 },
        boleto: { attempts: 30, recoveries: 20, rate: 66.67 },
        credit_card: { attempts: 20, recoveries: 15, rate: 75.0 },
      },
    };

    mockDB.setMockData(mockResponse);

    // First request - should hit database
    const req1 = new Request('http://localhost/api/metrics/recovery-rate?branch=overdue&date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res1 = await app.fetch(req1, env);
    expect(res1.status).toBe(200);

    // Change mock data to verify cache is used
    mockDB.setMockData({
      ...mockResponse,
      total_attempts: 999, // Different value
    });

    // Second request - should use cache
    const req2 = new Request('http://localhost/api/metrics/recovery-rate?branch=overdue&date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res2 = await app.fetch(req2, env);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    
    // Should still have original value from cache
    expect(body2.total_attempts).toBe(100);
  });

  it('should bypass cache for current day queries', async () => {
    // Set up mock data
    const mockResponse: RecoveryRateResponse = {
      branch: 'all',
      date_range: 'today',
      total_attempts: 10,
      successful_recoveries: 5,
      recovery_rate: 50.0,
      total_amount_attempted: 1000,
      total_amount_recovered: 500,
      breakdown_by_method: {
        pix: { attempts: 5, recoveries: 3, rate: 60.0 },
        boleto: { attempts: 3, recoveries: 1, rate: 33.33 },
        credit_card: { attempts: 2, recoveries: 1, rate: 50.0 },
      },
    };

    mockDB.setMockData(mockResponse);

    // First request with "today"
    const req1 = new Request('http://localhost/api/metrics/recovery-rate?date_range=today', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res1 = await app.fetch(req1, env);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.total_attempts).toBe(10);

    // Change mock data
    mockDB.setMockData({
      ...mockResponse,
      total_attempts: 20, // Updated value
    });

    // Second request - should NOT use cache (bypass for "today")
    const req2 = new Request('http://localhost/api/metrics/recovery-rate?date_range=today', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res2 = await app.fetch(req2, env);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    
    // Should have new value (cache bypassed)
    expect(body2.total_attempts).toBe(20);
  });

  it('should reject requests without API key', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate?date_range=30d', {
      method: 'GET',
      // No X-API-Key header
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should reject requests with invalid API key', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate?date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'invalid-key',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should support filtering by branch parameter', async () => {
    const mockResponse: RecoveryRateResponse = {
      branch: 'due-today',
      date_range: '30d',
      total_attempts: 50,
      successful_recoveries: 40,
      recovery_rate: 80.0,
      total_amount_attempted: 5000,
      total_amount_recovered: 4000,
      breakdown_by_method: {
        pix: { attempts: 25, recoveries: 20, rate: 80.0 },
        boleto: { attempts: 15, recoveries: 12, rate: 80.0 },
        credit_card: { attempts: 10, recoveries: 8, rate: 80.0 },
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/recovery-rate?branch=due-today&date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch).toBe('due-today');
  });

  it('should support filtering by plan parameter', async () => {
    const mockResponse: RecoveryRateResponse = {
      branch: 'all',
      date_range: '30d',
      total_attempts: 30,
      successful_recoveries: 25,
      recovery_rate: 83.33,
      total_amount_attempted: 3000,
      total_amount_recovered: 2500,
      breakdown_by_method: {
        pix: { attempts: 15, recoveries: 13, rate: 86.67 },
        boleto: { attempts: 10, recoveries: 8, rate: 80.0 },
        credit_card: { attempts: 5, recoveries: 4, rate: 80.0 },
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/recovery-rate?plan=premium&date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockResponse);
  });

  it('should support multiple query parameters', async () => {
    const mockResponse: RecoveryRateResponse = {
      branch: 'overdue',
      date_range: '60d',
      total_attempts: 80,
      successful_recoveries: 60,
      recovery_rate: 75.0,
      total_amount_attempted: 8000,
      total_amount_recovered: 6000,
      breakdown_by_method: {
        pix: { attempts: 40, recoveries: 32, rate: 80.0 },
        boleto: { attempts: 25, recoveries: 18, rate: 72.0 },
        credit_card: { attempts: 15, recoveries: 10, rate: 66.67 },
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/recovery-rate?branch=overdue&date_range=60d&plan=basic', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockResponse);
  });

  it('should work without query parameters (defaults)', async () => {
    const mockResponse: RecoveryRateResponse = {
      branch: 'all',
      date_range: '30d',
      total_attempts: 200,
      successful_recoveries: 150,
      recovery_rate: 75.0,
      total_amount_attempted: 20000,
      total_amount_recovered: 15000,
      breakdown_by_method: {
        pix: { attempts: 100, recoveries: 80, rate: 80.0 },
        boleto: { attempts: 60, recoveries: 42, rate: 70.0 },
        credit_card: { attempts: 40, recoveries: 28, rate: 70.0 },
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/recovery-rate', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockResponse);
  });
});
