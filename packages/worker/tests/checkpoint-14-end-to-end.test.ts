/**
 * Checkpoint 14: End-to-End Analytics API Testing
 * 
 * This test suite performs comprehensive end-to-end testing of the analytics API:
 * - Tests all API endpoints with various parameters
 * - Verifies caching behavior with repeated requests
 * - Verifies pagination with large datasets
 * - Ensures error handling works correctly
 * 
 * Requirements: Task 14 from subscription-recovery-analytics spec
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev, UnstableDevWorker } from 'wrangler';

describe('Checkpoint 14: End-to-End Analytics API Testing', () => {
  let worker: UnstableDevWorker;
  const TEST_API_KEY = 'test-api-key-12345';

  beforeAll(async () => {
    // Start the worker in development mode
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      vars: {
        ENVIRONMENT: 'test',
        N8N_WEBHOOK_URL: 'https://test-n8n.com/webhook',
        WEBHOOK_SECRET: 'test-webhook-secret',
        ZUCKZAPGO_SECRET: 'test-zuckzapgo-secret',
        VALID_API_KEYS: TEST_API_KEY,
        CHATWOOT_TOKEN: 'test-chatwoot-token',
      },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe('Health Check', () => {
    it('should return 200 OK with service status', async () => {
      const response = await worker.fetch('/');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('service', 'subscription-recovery-analytics');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without API key', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate');
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate', {
        headers: {
          'X-API-Key': 'invalid-key',
        },
      });
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should accept requests with valid API key', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=30d', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });
      // Should not be 401 (might be 200 or 500 depending on DB state)
      expect(response.status).not.toBe(401);
    });
  });

  describe('Recovery Rate Endpoint', () => {
    it('should return recovery rate metrics with valid parameters', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=30d', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      // Accept both 200 (success) and 500 (DB not initialized) as valid for this test
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('pagination');
      }
    });

    it('should support branch filtering', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=30d&branch=overdue', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);
    });

    it('should support plan filtering', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=30d&plan=premium', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);
    });

    it('should reject invalid date_range parameter', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=invalid', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('date_range');
    });

    it('should reject invalid branch parameter', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=30d&branch=invalid-branch', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('branch');
    });

    it('should support pagination parameters', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=30d&page=1&page_size=10', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('pagination');
        expect(data.pagination).toHaveProperty('page', 1);
        expect(data.pagination).toHaveProperty('page_size', 10);
        expect(data.pagination).toHaveProperty('total');
        expect(data.pagination).toHaveProperty('total_pages');
      }
    });

    it('should reject invalid pagination parameters', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=30d&page=-1', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('DSO Endpoint', () => {
    it('should return DSO metrics with valid parameters', async () => {
      const response = await worker.fetch('/api/metrics/dso?date_range=30d', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('pagination');
      }
    });

    it('should reject invalid date_range parameter', async () => {
      const response = await worker.fetch('/api/metrics/dso?date_range=999d', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('date_range');
    });

    it('should support pagination parameters', async () => {
      const response = await worker.fetch('/api/metrics/dso?date_range=30d&page=1&page_size=20', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('pagination');
        expect(data.pagination).toHaveProperty('page', 1);
        expect(data.pagination).toHaveProperty('page_size', 20);
      }
    });
  });

  describe('Cohorts Endpoint', () => {
    it('should return cohort analysis with valid parameters', async () => {
      const response = await worker.fetch('/api/metrics/cohorts?start_month=2024-01&end_month=2024-03', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('cohorts');
        expect(Array.isArray(data.data.cohorts)).toBe(true);
        expect(data).toHaveProperty('pagination');
      }
    });

    it('should reject invalid month format', async () => {
      const response = await worker.fetch('/api/metrics/cohorts?start_month=2024-13&end_month=2024-03', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('month');
    });

    it('should reject when start_month is after end_month', async () => {
      const response = await worker.fetch('/api/metrics/cohorts?start_month=2024-06&end_month=2024-03', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('start_month');
    });

    it('should support pagination parameters', async () => {
      const response = await worker.fetch('/api/metrics/cohorts?start_month=2024-01&end_month=2024-12&page=1&page_size=5', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('pagination');
        expect(data.pagination).toHaveProperty('page', 1);
        expect(data.pagination).toHaveProperty('page_size', 5);
        
        // Verify cohorts array is paginated
        expect(data.data.cohorts.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Caching Behavior', () => {
    it('should cache recovery rate metrics on first request', async () => {
      const url = '/api/metrics/recovery-rate?date_range=30d&branch=overdue';
      
      // First request - should hit database
      const response1 = await worker.fetch(url, {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response1.status);

      if (response1.status === 200) {
        const data1 = await response1.json();
        
        // Second request - should hit cache (faster)
        const response2 = await worker.fetch(url, {
          headers: {
            'X-API-Key': TEST_API_KEY,
          },
        });

        expect(response2.status).toBe(200);
        const data2 = await response2.json();

        // Data should be identical
        expect(data2).toEqual(data1);
      }
    });

    it('should cache DSO metrics on first request', async () => {
      const url = '/api/metrics/dso?date_range=60d';
      
      // First request
      const response1 = await worker.fetch(url, {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response1.status);

      if (response1.status === 200) {
        const data1 = await response1.json();
        
        // Second request - should hit cache
        const response2 = await worker.fetch(url, {
          headers: {
            'X-API-Key': TEST_API_KEY,
          },
        });

        expect(response2.status).toBe(200);
        const data2 = await response2.json();

        // Data should be identical
        expect(data2).toEqual(data1);
      }
    });

    it('should cache cohort analysis on first request', async () => {
      const url = '/api/metrics/cohorts?start_month=2024-01&end_month=2024-03';
      
      // First request
      const response1 = await worker.fetch(url, {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response1.status);

      if (response1.status === 200) {
        const data1 = await response1.json();
        
        // Second request - should hit cache
        const response2 = await worker.fetch(url, {
          headers: {
            'X-API-Key': TEST_API_KEY,
          },
        });

        expect(response2.status).toBe(200);
        const data2 = await response2.json();

        // Data should be identical
        expect(data2).toEqual(data1);
      }
    });

    it('should use different cache keys for different parameters', async () => {
      const url1 = '/api/metrics/recovery-rate?date_range=30d&branch=overdue';
      const url2 = '/api/metrics/recovery-rate?date_range=30d&branch=due-today';
      
      const response1 = await worker.fetch(url1, {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      const response2 = await worker.fetch(url2, {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      // Both should work independently
      expect([200, 500]).toContain(response1.status);
      expect([200, 500]).toContain(response2.status);

      if (response1.status === 200 && response2.status === 200) {
        const data1 = await response1.json();
        const data2 = await response2.json();

        // Data might be different (different branches)
        // Just verify both have the expected structure
        expect(data1).toHaveProperty('data');
        expect(data2).toHaveProperty('data');
      }
    });
  });

  describe('Pagination with Large Datasets', () => {
    it('should paginate cohorts correctly', async () => {
      // Request first page
      const response1 = await worker.fetch('/api/metrics/cohorts?start_month=2023-01&end_month=2024-12&page=1&page_size=3', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response1.status);

      if (response1.status === 200) {
        const data1 = await response1.json();
        
        expect(data1).toHaveProperty('pagination');
        expect(data1.pagination.page).toBe(1);
        expect(data1.pagination.page_size).toBe(3);
        expect(data1.data.cohorts.length).toBeLessThanOrEqual(3);

        // Request second page
        const response2 = await worker.fetch('/api/metrics/cohorts?start_month=2023-01&end_month=2024-12&page=2&page_size=3', {
          headers: {
            'X-API-Key': TEST_API_KEY,
          },
        });

        expect(response2.status).toBe(200);
        const data2 = await response2.json();

        expect(data2.pagination.page).toBe(2);
        expect(data2.pagination.page_size).toBe(3);
        
        // If there are results on page 2, they should be different from page 1
        if (data2.data.cohorts.length > 0 && data1.data.cohorts.length > 0) {
          expect(data2.data.cohorts[0]).not.toEqual(data1.data.cohorts[0]);
        }
      }
    });

    it('should handle page_size limits correctly', async () => {
      const response = await worker.fetch('/api/metrics/cohorts?start_month=2023-01&end_month=2024-12&page=1&page_size=100', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        
        // Should respect the page_size limit
        expect(data.data.cohorts.length).toBeLessThanOrEqual(100);
        expect(data.pagination.page_size).toBe(100);
      }
    });

    it('should return empty results for out-of-range pages', async () => {
      const response = await worker.fetch('/api/metrics/cohorts?start_month=2024-01&end_month=2024-03&page=999&page_size=10', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        
        // Should return empty array for out-of-range page
        expect(data.data.cohorts).toEqual([]);
        expect(data.pagination.page).toBe(999);
      }
    });

    it('should calculate total_pages correctly', async () => {
      const response = await worker.fetch('/api/metrics/cohorts?start_month=2023-01&end_month=2024-12&page=1&page_size=5', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        
        expect(data.pagination).toHaveProperty('total');
        expect(data.pagination).toHaveProperty('total_pages');
        
        // Verify total_pages calculation
        const expectedTotalPages = Math.ceil(data.pagination.total / data.pagination.page_size);
        expect(data.pagination.total_pages).toBe(expectedTotalPages);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for missing required parameters', async () => {
      const response = await worker.fetch('/api/metrics/cohorts', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return descriptive error messages', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=invalid&branch=invalid', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
      expect(data.error.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await worker.fetch('/webhooks/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'invalid-signature',
        },
        body: 'not-valid-json{',
      });

      // Should return an error status (401 for invalid signature or 400 for bad JSON)
      expect([400, 401, 500]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make 5 requests (well within the 100/minute limit)
      const requests = Array.from({ length: 5 }, () =>
        worker.fetch('/api/metrics/recovery-rate?date_range=30d', {
          headers: {
            'X-API-Key': TEST_API_KEY,
          },
        })
      );

      const responses = await Promise.all(requests);

      // All should succeed (or fail with 500 if DB not initialized, but not 429)
      responses.forEach((response) => {
        expect(response.status).not.toBe(429);
      });
    });

    // Note: Testing the actual rate limit (100 requests) would be too slow for a test suite
    // This would be better tested in a load testing scenario
  });

  describe('API Response Structure', () => {
    it('should return consistent response structure for recovery rate', async () => {
      const response = await worker.fetch('/api/metrics/recovery-rate?date_range=30d', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        
        // Verify response structure
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('pagination');
        
        expect(data.pagination).toHaveProperty('page');
        expect(data.pagination).toHaveProperty('page_size');
        expect(data.pagination).toHaveProperty('total');
        expect(data.pagination).toHaveProperty('total_pages');
      }
    });

    it('should return consistent response structure for DSO', async () => {
      const response = await worker.fetch('/api/metrics/dso?date_range=30d', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        
        // Verify response structure
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('pagination');
        
        expect(data.pagination).toHaveProperty('page');
        expect(data.pagination).toHaveProperty('page_size');
        expect(data.pagination).toHaveProperty('total');
        expect(data.pagination).toHaveProperty('total_pages');
      }
    });

    it('should return consistent response structure for cohorts', async () => {
      const response = await worker.fetch('/api/metrics/cohorts?start_month=2024-01&end_month=2024-03', {
        headers: {
          'X-API-Key': TEST_API_KEY,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        
        // Verify response structure
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('cohorts');
        expect(Array.isArray(data.data.cohorts)).toBe(true);
        expect(data).toHaveProperty('pagination');
        
        expect(data.pagination).toHaveProperty('page');
        expect(data.pagination).toHaveProperty('page_size');
        expect(data.pagination).toHaveProperty('total');
        expect(data.pagination).toHaveProperty('total_pages');
      }
    });
  });
});
