/**
 * Unit tests for GET /api/metrics/dso endpoint
 * 
 * Tests the complete endpoint including:
 * - Authentication and rate limiting middleware
 * - Query parameter parsing
 * - Cache checking and storage
 * - DSO calculation
 * - JSON response formatting
 * 
 * Requirements: 3.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authenticateApiKey } from '../src/lib/api-key-auth';
import { rateLimiter } from '../src/lib/rate-limiter';
import { calculateDSO } from '../src/lib/dso';
import { getCachedMetrics, setCachedMetrics, generateCacheKey } from '../src/lib/cache';
import { DSOResponse } from '../src/types';

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
  private mockData: DSOResponse | null = null;

  setMockData(data: DSOResponse): void {
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

describe('GET /api/metrics/dso endpoint', () => {
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

    // Add the DSO endpoint
    app.get('/api/metrics/dso', authenticateApiKey, rateLimiter(100), async (c) => {
      try {
        // Parse query parameters
        const date_range = c.req.query('date_range');

        // Generate cache key from query parameters
        const cacheKey = generateCacheKey('dso', {
          date_range,
        });

        // Check KV cache first
        const cached = await getCachedMetrics<DSOResponse>(
          c.env.KV,
          cacheKey,
          { date_range }
        );

        if (cached) {
          // Return cached data
          return c.json(cached);
        }

        // Cache miss - calculate DSO from database
        const data = await calculateDSO(c.env.DB, {
          date_range,
        });

        // Store result in KV with 5-minute TTL
        await setCachedMetrics(c.env.KV, cacheKey, data, 300);

        // Return JSON response
        return c.json(data);
      } catch (error) {
        // Log error and return 500
        console.error('DSO calculation failed', {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return c.json({
          error: 'Internal Server Error',
          message: 'Failed to calculate DSO'
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

  it('should return DSO metrics with valid API key', async () => {
    // Set up mock data
    const mockResponse: DSOResponse = {
      date_range: '30d',
      average_dso: 5.5,
      median_dso: 4.0,
      by_branch: {
        '3-day-notice': 3.2,
        'due-today': 5.1,
        'overdue': 8.7,
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/dso?date_range=30d', {
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
    const mockResponse: DSOResponse = {
      date_range: '30d',
      average_dso: 5.5,
      median_dso: 4.0,
      by_branch: {
        '3-day-notice': 3.2,
        'due-today': 5.1,
        'overdue': 8.7,
      },
    };

    mockDB.setMockData(mockResponse);

    // First request - should hit database
    const req1 = new Request('http://localhost/api/metrics/dso?date_range=30d', {
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
      average_dso: 99.9, // Different value
    });

    // Second request - should use cache
    const req2 = new Request('http://localhost/api/metrics/dso?date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res2 = await app.fetch(req2, env);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    
    // Should still have original value from cache
    expect(body2.average_dso).toBe(5.5);
  });

  it('should bypass cache for current day queries', async () => {
    // Set up mock data
    const mockResponse: DSOResponse = {
      date_range: 'today',
      average_dso: 2.5,
      median_dso: 2.0,
      by_branch: {
        '3-day-notice': 1.5,
        'due-today': 2.5,
        'overdue': 3.5,
      },
    };

    mockDB.setMockData(mockResponse);

    // First request with "today"
    const req1 = new Request('http://localhost/api/metrics/dso?date_range=today', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res1 = await app.fetch(req1, env);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.average_dso).toBe(2.5);

    // Change mock data
    mockDB.setMockData({
      ...mockResponse,
      average_dso: 3.5, // Updated value
    });

    // Second request - should NOT use cache (bypass for "today")
    const req2 = new Request('http://localhost/api/metrics/dso?date_range=today', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res2 = await app.fetch(req2, env);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    
    // Should have new value (cache bypassed)
    expect(body2.average_dso).toBe(3.5);
  });

  it('should reject requests without API key', async () => {
    const req = new Request('http://localhost/api/metrics/dso?date_range=30d', {
      method: 'GET',
      // No X-API-Key header
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should reject requests with invalid API key', async () => {
    const req = new Request('http://localhost/api/metrics/dso?date_range=30d', {
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

  it('should support different date range parameters', async () => {
    const mockResponse: DSOResponse = {
      date_range: '60d',
      average_dso: 6.2,
      median_dso: 5.5,
      by_branch: {
        '3-day-notice': 4.1,
        'due-today': 6.0,
        'overdue': 9.5,
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/dso?date_range=60d', {
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
    const mockResponse: DSOResponse = {
      date_range: '30d',
      average_dso: 5.0,
      median_dso: 4.5,
      by_branch: {
        '3-day-notice': 3.0,
        'due-today': 5.0,
        'overdue': 8.0,
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/dso', {
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

  it('should return DSO metrics grouped by branch', async () => {
    const mockResponse: DSOResponse = {
      date_range: '30d',
      average_dso: 5.5,
      median_dso: 4.0,
      by_branch: {
        '3-day-notice': 3.2,
        'due-today': 5.1,
        'overdue': 8.7,
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/dso?date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    
    // Verify all branches are present
    expect(body.by_branch).toHaveProperty('3-day-notice');
    expect(body.by_branch).toHaveProperty('due-today');
    expect(body.by_branch).toHaveProperty('overdue');
    
    // Verify values
    expect(body.by_branch['3-day-notice']).toBe(3.2);
    expect(body.by_branch['due-today']).toBe(5.1);
    expect(body.by_branch['overdue']).toBe(8.7);
  });

  it('should include both average and median DSO', async () => {
    const mockResponse: DSOResponse = {
      date_range: '30d',
      average_dso: 5.5,
      median_dso: 4.0,
      by_branch: {
        '3-day-notice': 3.2,
        'due-today': 5.1,
        'overdue': 8.7,
      },
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/dso?date_range=30d', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    
    // Verify both metrics are present
    expect(body).toHaveProperty('average_dso');
    expect(body).toHaveProperty('median_dso');
    expect(body.average_dso).toBe(5.5);
    expect(body.median_dso).toBe(4.0);
  });
});
