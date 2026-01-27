/**
 * Integration Tests for API Error Handling
 * 
 * Tests that API endpoints properly validate parameters and return
 * HTTP 400 with descriptive error messages for invalid inputs.
 * 
 * Requirements: 3.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authenticateApiKey } from '../src/lib/api-key-auth';
import { rateLimiter } from '../src/lib/rate-limiter';
import { calculateRecoveryRate } from '../src/lib/recovery-rate';
import { calculateDSO } from '../src/lib/dso';
import { calculateCohortAnalysis } from '../src/lib/cohort-analysis';
import { getCachedMetrics, setCachedMetrics, generateCacheKey } from '../src/lib/cache';
import { parsePaginationParams, calculatePaginationMetadata, paginateArray } from '../src/lib/pagination';
import {
  validateDateRange,
  validateRecoveryBranch,
  validateMonth,
  validateMonthRange,
  validatePaginationParams,
  ValidationException,
  formatValidationErrors,
} from '../src/lib/validation';
import { RecoveryRateResponse, DSOResponse, CohortAnalysisResponse, PaginatedResponse } from '../src/types';

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  VALID_API_KEYS: string;
}

describe('API Error Handling - Recovery Rate Endpoint', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;

  beforeEach(async (ctx) => {
    app = new Hono<{ Bindings: Env }>();
    env = ctx.env as Env;

    // Set up valid API keys
    env.VALID_API_KEYS = 'test-api-key';

    // Add the recovery-rate endpoint with validation
    app.get('/api/metrics/recovery-rate', authenticateApiKey, rateLimiter(100), async (c) => {
      try {
        // Parse query parameters
        const branchParam = c.req.query('branch');
        const dateRangeParam = c.req.query('date_range');
        const plan = c.req.query('plan');
        const pageParam = c.req.query('page');
        const pageSizeParam = c.req.query('page_size');

        // Validate parameters
        const branch = validateRecoveryBranch(branchParam);
        const date_range = validateDateRange(dateRangeParam);
        const pagination = validatePaginationParams(pageParam, pageSizeParam);

        // For testing, return a simple response
        return c.json({
          data: {
            branch: branch || 'all',
            date_range: date_range || '30d',
            total_attempts: 0,
            successful_recoveries: 0,
            recovery_rate: 0,
            total_amount_attempted: 0,
            total_amount_recovered: 0,
            breakdown_by_method: {
              pix: { attempts: 0, recoveries: 0, rate: 0 },
              boleto: { attempts: 0, recoveries: 0, rate: 0 },
              credit_card: { attempts: 0, recoveries: 0, rate: 0 },
            },
          },
          pagination: {
            page: pagination.page,
            page_size: pagination.pageSize,
            total_items: 0,
            total_pages: 0,
          },
        });
      } catch (error) {
        // Handle validation errors
        if (error instanceof ValidationException) {
          return c.json(formatValidationErrors(error.errors), 400);
        }

        return c.json({
          error: 'Internal Server Error',
          message: 'Failed to calculate recovery rate',
        }, 500);
      }
    });
  });

  it('should return 400 for invalid date_range parameter', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate?date_range=invalid', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.message).toBe('Invalid request parameters');
    expect(body.details).toBeDefined();
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details[0].field).toBe('date_range');
    expect(body.details[0].expected).toContain('7d');
    expect(body.details[0].expected).toContain('30d');
  });

  it('should return 400 for invalid branch parameter', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate?branch=invalid-branch', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.details[0].field).toBe('branch');
    expect(body.details[0].expected).toContain('3-day-notice');
    expect(body.details[0].expected).toContain('due-today');
    expect(body.details[0].expected).toContain('overdue');
  });

  it('should return 400 for invalid page parameter', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate?page=0', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.details[0].field).toBe('page');
    expect(body.details[0].message).toContain('between 1 and');
  });

  it('should return 400 for invalid page_size parameter', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate?page_size=0', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.details[0].field).toBe('page_size');
  });

  it('should return 400 for non-numeric page parameter', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate?page=abc', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.details[0].field).toBe('page');
    expect(body.details[0].message).toContain('valid integer');
  });

  it('should return 400 for multiple invalid parameters', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate?branch=invalid&date_range=bad&page=0', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.details.length).toBeGreaterThan(1);
  });

  it('should return 200 for valid parameters', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate?branch=overdue&date_range=30d&page=1&page_size=50', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.pagination).toBeDefined();
  });

  it('should return 200 when optional parameters are omitted', async () => {
    const req = new Request('http://localhost/api/metrics/recovery-rate', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
  });
});

describe('API Error Handling - DSO Endpoint', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;

  beforeEach(async (ctx) => {
    app = new Hono<{ Bindings: Env }>();
    env = ctx.env as Env;

    env.VALID_API_KEYS = 'test-api-key';

    app.get('/api/metrics/dso', authenticateApiKey, rateLimiter(100), async (c) => {
      try {
        const dateRangeParam = c.req.query('date_range');
        const pageParam = c.req.query('page');
        const pageSizeParam = c.req.query('page_size');

        const date_range = validateDateRange(dateRangeParam);
        const pagination = validatePaginationParams(pageParam, pageSizeParam);

        return c.json({
          data: {
            date_range: date_range || '30d',
            average_dso: 0,
            median_dso: 0,
            by_branch: {
              '3-day-notice': 0,
              'due-today': 0,
              'overdue': 0,
            },
          },
          pagination: {
            page: pagination.page,
            page_size: pagination.pageSize,
            total_items: 0,
            total_pages: 0,
          },
        });
      } catch (error) {
        if (error instanceof ValidationException) {
          return c.json(formatValidationErrors(error.errors), 400);
        }

        return c.json({
          error: 'Internal Server Error',
          message: 'Failed to calculate DSO',
        }, 500);
      }
    });
  });

  it('should return 400 for invalid date_range parameter', async () => {
    const req = new Request('http://localhost/api/metrics/dso?date_range=999d', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.details[0].field).toBe('date_range');
  });

  it('should return 200 for valid parameters', async () => {
    const req = new Request('http://localhost/api/metrics/dso?date_range=60d', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
  });
});

describe('API Error Handling - Cohorts Endpoint', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;

  beforeEach(async (ctx) => {
    app = new Hono<{ Bindings: Env }>();
    env = ctx.env as Env;

    env.VALID_API_KEYS = 'test-api-key';

    app.get('/api/metrics/cohorts', authenticateApiKey, rateLimiter(100), async (c) => {
      try {
        const startMonthParam = c.req.query('start_month');
        const endMonthParam = c.req.query('end_month');
        const pageParam = c.req.query('page');
        const pageSizeParam = c.req.query('page_size');

        const start_month = validateMonth(startMonthParam, 'start_month');
        const end_month = validateMonth(endMonthParam, 'end_month');
        validateMonthRange(start_month, end_month);
        const pagination = validatePaginationParams(pageParam, pageSizeParam);

        return c.json({
          data: {
            cohorts: [],
          },
          pagination: {
            page: pagination.page,
            page_size: pagination.pageSize,
            total_items: 0,
            total_pages: 0,
          },
        });
      } catch (error) {
        if (error instanceof ValidationException) {
          return c.json(formatValidationErrors(error.errors), 400);
        }

        return c.json({
          error: 'Internal Server Error',
          message: 'Failed to calculate cohort analysis',
        }, 500);
      }
    });
  });

  it('should return 400 for invalid start_month format', async () => {
    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-1&end_month=2024-12', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.details[0].field).toBe('start_month');
    expect(body.details[0].expected).toContain('YYYY-MM');
  });

  it('should return 400 for invalid end_month format', async () => {
    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=24-12', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.details[0].field).toBe('end_month');
  });

  it('should return 400 when start_month is after end_month', async () => {
    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-12&end_month=2024-01', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.details[0].message).toContain('start_month');
    expect(body.details[0].message).toContain('end_month');
  });

  it('should return 400 for invalid month value', async () => {
    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-13&end_month=2024-12', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.details[0].field).toBe('start_month');
  });

  it('should return 200 for valid month range', async () => {
    const req = new Request('http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-12', {
      headers: { 'X-API-Key': 'test-api-key' },
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(200);
  });
});
