/**
 * Manual Test Script for API Error Handling
 * 
 * This script manually tests that API endpoints properly validate
 * parameters and return HTTP 400 with descriptive error messages.
 * 
 * Run with: npx tsx tests/manual-test-api-error-handling.ts
 * 
 * Requirements: 3.6
 */

import { Hono } from 'hono';
import { authenticateApiKey } from '../src/lib/api-key-auth';
import { rateLimiter } from '../src/lib/rate-limiter';
import {
  validateDateRange,
  validateRecoveryBranch,
  validateMonth,
  validateMonthRange,
  validatePaginationParams,
  ValidationException,
  formatValidationErrors,
} from '../src/lib/validation';

interface Env {
  DB: any;
  KV: any;
  ENVIRONMENT: string;
  VALID_API_KEYS: string;
}

console.log('=== Manual API Error Handling Tests ===\n');

// Create a mock Hono app with the endpoints
const app = new Hono<{ Bindings: Env }>();

// Mock environment
const mockEnv: Env = {
  DB: null,
  KV: null,
  ENVIRONMENT: 'test',
  VALID_API_KEYS: 'test-api-key',
};

// Add the recovery-rate endpoint with validation
app.get('/api/metrics/recovery-rate', authenticateApiKey, rateLimiter(100), async (c) => {
  try {
    const branchParam = c.req.query('branch');
    const dateRangeParam = c.req.query('date_range');
    const plan = c.req.query('plan');
    const pageParam = c.req.query('page');
    const pageSizeParam = c.req.query('page_size');

    const branch = validateRecoveryBranch(branchParam);
    const date_range = validateDateRange(dateRangeParam);
    const pagination = validatePaginationParams(pageParam, pageSizeParam);

    return c.json({
      data: {
        branch: branch || 'all',
        date_range: date_range || '30d',
        total_attempts: 0,
        successful_recoveries: 0,
        recovery_rate: 0,
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
      message: 'Failed to calculate recovery rate',
    }, 500);
  }
});

// Add the DSO endpoint with validation
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

// Add the cohorts endpoint with validation
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

// Helper function to test an endpoint
async function testEndpoint(name: string, url: string, expectedStatus: number, expectedErrorField?: string) {
  const req = new Request(url, {
    headers: { 'X-API-Key': 'test-api-key' },
  });

  const res = await app.fetch(req, mockEnv);
  const body = await res.json();

  console.log(`Test: ${name}`);
  console.log(`  URL: ${url}`);
  console.log(`  Expected Status: ${expectedStatus}, Actual: ${res.status}`);

  if (res.status === expectedStatus) {
    console.log('  ✓ Status code correct');
  } else {
    console.log('  ✗ Status code incorrect');
    console.log('  Response:', JSON.stringify(body, null, 2));
    return;
  }

  if (expectedStatus === 400) {
    if (body.error === 'Bad Request' && body.message === 'Invalid request parameters' && body.details) {
      console.log('  ✓ Error response format correct');
      
      if (expectedErrorField && body.details.length > 0) {
        const hasExpectedField = body.details.some((d: any) => d.field === expectedErrorField);
        if (hasExpectedField) {
          console.log(`  ✓ Expected error field '${expectedErrorField}' present`);
        } else {
          console.log(`  ✗ Expected error field '${expectedErrorField}' not found`);
        }
      }
      
      console.log('  Error details:', JSON.stringify(body.details, null, 2));
    } else {
      console.log('  ✗ Error response format incorrect');
      console.log('  Response:', JSON.stringify(body, null, 2));
    }
  } else if (expectedStatus === 200) {
    if (body.data && body.pagination) {
      console.log('  ✓ Success response format correct');
    } else {
      console.log('  ✗ Success response format incorrect');
      console.log('  Response:', JSON.stringify(body, null, 2));
    }
  }

  console.log('');
}

// Run tests
(async () => {
  console.log('--- Recovery Rate Endpoint Tests ---\n');

  await testEndpoint(
    'Invalid date_range',
    'http://localhost/api/metrics/recovery-rate?date_range=invalid',
    400,
    'date_range'
  );

  await testEndpoint(
    'Invalid branch',
    'http://localhost/api/metrics/recovery-rate?branch=invalid-branch',
    400,
    'branch'
  );

  await testEndpoint(
    'Invalid page (zero)',
    'http://localhost/api/metrics/recovery-rate?page=0',
    400,
    'page'
  );

  await testEndpoint(
    'Invalid page (negative)',
    'http://localhost/api/metrics/recovery-rate?page=-1',
    400,
    'page'
  );

  await testEndpoint(
    'Invalid page (non-numeric)',
    'http://localhost/api/metrics/recovery-rate?page=abc',
    400,
    'page'
  );

  await testEndpoint(
    'Invalid page_size (zero)',
    'http://localhost/api/metrics/recovery-rate?page_size=0',
    400,
    'page_size'
  );

  await testEndpoint(
    'Invalid page_size (too large)',
    'http://localhost/api/metrics/recovery-rate?page_size=2000',
    400,
    'page_size'
  );

  await testEndpoint(
    'Multiple invalid parameters',
    'http://localhost/api/metrics/recovery-rate?branch=bad&date_range=invalid&page=0',
    400
  );

  await testEndpoint(
    'Valid parameters',
    'http://localhost/api/metrics/recovery-rate?branch=overdue&date_range=30d&page=1&page_size=50',
    200
  );

  await testEndpoint(
    'No parameters (all optional)',
    'http://localhost/api/metrics/recovery-rate',
    200
  );

  console.log('--- DSO Endpoint Tests ---\n');

  await testEndpoint(
    'Invalid date_range',
    'http://localhost/api/metrics/dso?date_range=999d',
    400,
    'date_range'
  );

  await testEndpoint(
    'Valid parameters',
    'http://localhost/api/metrics/dso?date_range=60d',
    200
  );

  console.log('--- Cohorts Endpoint Tests ---\n');

  await testEndpoint(
    'Invalid start_month format',
    'http://localhost/api/metrics/cohorts?start_month=2024-1&end_month=2024-12',
    400,
    'start_month'
  );

  await testEndpoint(
    'Invalid end_month format',
    'http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=24-12',
    400,
    'end_month'
  );

  await testEndpoint(
    'Invalid month value (month 13)',
    'http://localhost/api/metrics/cohorts?start_month=2024-13&end_month=2024-12',
    400,
    'start_month'
  );

  await testEndpoint(
    'Invalid month range (start after end)',
    'http://localhost/api/metrics/cohorts?start_month=2024-12&end_month=2024-01',
    400,
    'start_month'
  );

  await testEndpoint(
    'Valid month range',
    'http://localhost/api/metrics/cohorts?start_month=2024-01&end_month=2024-12',
    200
  );

  console.log('=== All API Error Handling Tests Complete ===');
})();
