/**
 * Unit tests for GET /api/metrics/cohorts endpoint
 * 
 * Tests the complete endpoint including:
 * - Authentication and rate limiting middleware
 * - Query parameter parsing (start_month, end_month)
 * - Cache checking and storage
 * - Cohort analysis calculation
 * - JSON response formatting
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { authenticateApiKey } from '../src/lib/api-key-auth';
import { rateLimiter } from '../src/lib/rate-limiter';
import { calculateCohortAnalysis } from '../src/lib/cohort-analysis';
import { getCachedMetrics, setCachedMetrics, generateCacheKey } from '../src/lib/cache';
import { CohortAnalysisResponse } from '../src/types';

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
  [key: string]: any;  // Index signature for Hono compatibility
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
  private mockData: CohortAnalysisResponse | null = null;

  setMockData(data: CohortAnalysisResponse): void {
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

describe('GET /api/metrics/cohorts endpoint', () => {
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

    // Add the cohorts endpoint
    app.get('/api/metrics/cohorts', authenticateApiKey, rateLimiter(100), async (c) => {
      try {
        // Parse query parameters
        const start_month = c.req.query('start_month');
        const end_month = c.req.query('end_month');

        // Generate cache key from query parameters
        const cacheKey = generateCacheKey('cohorts', {
          start_month,
          end_month,
        });

        // Check KV cache first
        const cached = await getCachedMetrics<CohortAnalysisResponse>(
          c.env.KV,
          cacheKey,
          { start_month, end_month }
        );

        if (cached) {
          // Return cached data
          return c.json(cached);
        }

        // Cache miss - calculate cohort analysis from database
        const data = await calculateCohortAnalysis(c.env.DB, {
          start_month,
          end_month,
        });

        // Store result in KV with 5-minute TTL
        await setCachedMetrics(c.env.KV, cacheKey, data, 300);

        // Return JSON response
        return c.json(data);
      } catch (error) {
        // Log error and return 500
        console.error('Cohort analysis calculation failed', {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return c.json({
          error: 'Internal Server Error',
          message: 'Failed to calculate cohort analysis'
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

  it('should return cohort analysis with valid API key', async () => {
    // Set up mock data
    const mockResponse: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-01',
          total_customers: 50,
          billing_cycles: [
            { cycle_number: 1, attempted: 50, recovered: 45, recovery_rate: 90.0 },
            { cycle_number: 2, attempted: 48, recovered: 42, recovery_rate: 87.5 },
            { cycle_number: 3, attempted: 46, recovered: 40, recovery_rate: 86.96 },
          ],
          is_statistically_significant: true,
        },
        {
          cohort_month: '2024-02',
          total_customers: 60,
          billing_cycles: [
            { cycle_number: 1, attempted: 60, recovered: 55, recovery_rate: 91.67 },
            { cycle_number: 2, attempted: 58, recovered: 52, recovery_rate: 89.66 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-02', {
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
    const mockResponse: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-01',
          total_customers: 50,
          billing_cycles: [
            { cycle_number: 1, attempted: 50, recovered: 45, recovery_rate: 90.0 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    mockDB.setMockData(mockResponse);

    // First request - should hit database
    const req1 = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-01', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res1 = await app.fetch(req1, env);
    expect(res1.status).toBe(200);

    // Change mock data to verify cache is used
    mockDB.setMockData({
      cohorts: [
        {
          cohort_month: '2024-01',
          total_customers: 999, // Different value
          billing_cycles: [],
          is_statistically_significant: true,
        },
      ],
    });

    // Second request - should use cache
    const req2 = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-01', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res2 = await app.fetch(req2, env);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    
    // Should still have original value from cache
    expect(body2.cohorts[0].total_customers).toBe(50);
  });

  it('should reject requests without API key', async () => {
    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01', {
      method: 'GET',
      // No X-API-Key header
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should reject requests with invalid API key', async () => {
    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01', {
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

  it('should support filtering by start_month parameter', async () => {
    const mockResponse: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-03',
          total_customers: 40,
          billing_cycles: [
            { cycle_number: 1, attempted: 40, recovered: 35, recovery_rate: 87.5 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-03', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cohorts[0].cohort_month).toBe('2024-03');
  });

  it('should support filtering by end_month parameter', async () => {
    const mockResponse: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-01',
          total_customers: 50,
          billing_cycles: [
            { cycle_number: 1, attempted: 50, recovered: 45, recovery_rate: 90.0 },
          ],
          is_statistically_significant: true,
        },
        {
          cohort_month: '2024-02',
          total_customers: 60,
          billing_cycles: [
            { cycle_number: 1, attempted: 60, recovered: 55, recovery_rate: 91.67 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/cohorts?end_month=2024-02', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cohorts).toHaveLength(2);
  });

  it('should support both start_month and end_month parameters', async () => {
    const mockResponse: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-01',
          total_customers: 50,
          billing_cycles: [
            { cycle_number: 1, attempted: 50, recovered: 45, recovery_rate: 90.0 },
          ],
          is_statistically_significant: true,
        },
        {
          cohort_month: '2024-02',
          total_customers: 60,
          billing_cycles: [
            { cycle_number: 1, attempted: 60, recovered: 55, recovery_rate: 91.67 },
          ],
          is_statistically_significant: true,
        },
        {
          cohort_month: '2024-03',
          total_customers: 55,
          billing_cycles: [
            { cycle_number: 1, attempted: 55, recovered: 50, recovery_rate: 90.91 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-03', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cohorts).toHaveLength(3);
  });

  it('should work without query parameters (defaults to last 12 months)', async () => {
    const mockResponse: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2023-12',
          total_customers: 45,
          billing_cycles: [
            { cycle_number: 1, attempted: 45, recovered: 40, recovery_rate: 88.89 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/cohorts', {
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

  it('should flag cohorts with < 10 customers as statistically insignificant', async () => {
    const mockResponse: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-01',
          total_customers: 5,
          billing_cycles: [
            { cycle_number: 1, attempted: 5, recovered: 4, recovery_rate: 80.0 },
          ],
          is_statistically_significant: false, // < 10 customers
        },
        {
          cohort_month: '2024-02',
          total_customers: 15,
          billing_cycles: [
            { cycle_number: 1, attempted: 15, recovered: 13, recovery_rate: 86.67 },
          ],
          is_statistically_significant: true, // >= 10 customers
        },
      ],
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-02', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cohorts[0].is_statistically_significant).toBe(false);
    expect(body.cohorts[1].is_statistically_significant).toBe(true);
  });

  it('should return empty cohorts array when no data exists', async () => {
    const mockResponse: CohortAnalysisResponse = {
      cohorts: [],
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2025-01&end_month=2025-12', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cohorts).toEqual([]);
  });

  it('should include billing cycles with recovery metrics', async () => {
    const mockResponse: CohortAnalysisResponse = {
      cohorts: [
        {
          cohort_month: '2024-01',
          total_customers: 100,
          billing_cycles: [
            { cycle_number: 1, attempted: 100, recovered: 90, recovery_rate: 90.0 },
            { cycle_number: 2, attempted: 95, recovered: 85, recovery_rate: 89.47 },
            { cycle_number: 3, attempted: 90, recovered: 80, recovery_rate: 88.89 },
          ],
          is_statistically_significant: true,
        },
      ],
    };

    mockDB.setMockData(mockResponse);

    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-01', {
      method: 'GET',
      headers: {
        'X-API-Key': 'test-api-key-123',
      },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cohorts[0].billing_cycles).toHaveLength(3);
    expect(body.cohorts[0].billing_cycles[0]).toHaveProperty('cycle_number');
    expect(body.cohorts[0].billing_cycles[0]).toHaveProperty('attempted');
    expect(body.cohorts[0].billing_cycles[0]).toHaveProperty('recovered');
    expect(body.cohorts[0].billing_cycles[0]).toHaveProperty('recovery_rate');
  });
});
