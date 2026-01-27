import { Hono } from 'hono';
import { classifyRecoveryBranch } from './lib/recovery-branch';
import { validateWebhookSignature } from './lib/webhook-middleware';
import { authenticateApiKey } from './lib/api-key-auth';
import { rateLimiter } from './lib/rate-limiter';
import { insertPaymentEvent } from './lib/payment-event';
import { updateEngagementStatus } from './lib/engagement-event';
import { calculateRecoveryRate } from './lib/recovery-rate';
import { calculateDSO } from './lib/dso';
import { calculateCohortAnalysis } from './lib/cohort-analysis';
import { getCachedMetrics, setCachedMetrics, generateCacheKey } from './lib/cache';
import { parsePaginationParams, calculatePaginationMetadata, paginateArray } from './lib/pagination';
import { 
  validateDateRange, 
  validateRecoveryBranch, 
  validateMonth, 
  validateMonthRange,
  validatePaginationParams,
  ValidationException,
  formatValidationErrors
} from './lib/validation';
import { PaymentWebhookPayload, EngagementWebhookPayload, RecoveryRateResponse, DSOResponse, CohortAnalysisResponse, PaginatedResponse } from './types';

// Export business logic functions
export { classifyRecoveryBranch };
export { validateWebhookSignature };
export { authenticateApiKey };
export { rateLimiter };
export { insertPaymentEvent };
export { updateEngagementStatus };
export { calculateRecoveryRate };
export { calculateDSO };
export { calculateCohortAnalysis };
export { getCachedMetrics, setCachedMetrics, generateCacheKey };
export { parsePaginationParams, calculatePaginationMetadata, paginateArray };

// Define the environment bindings type
export interface Env {
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

// Create Hono app with environment type
const app = new Hono<{ Bindings: Env }>();

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'subscription-recovery-analytics',
    environment: c.env?.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Payment webhook endpoint
app.post('/webhooks/payment', validateWebhookSignature, async (c) => {
  // Parse the payment webhook payload from request body
  const payload = await c.req.json<PaymentWebhookPayload>();
  
  // Extract all required fields (validation happens implicitly through TypeScript)
  const {
    event_id,
    customer_id,
    amount,
    payment_method,
    status,
    timestamp,
    invoice_id,
    due_date,
    branch
  } = payload;
  
  // Process asynchronously - insert into database
  // Note: In a production system, this would be handled by a queue
  // For now, we'll process inline but still return 202 immediately
  try {
    const result = await insertPaymentEvent(c.env.DB, payload);
    
    // Return HTTP 202 immediately (acknowledge receipt)
    return c.json({ 
      status: 'accepted',
      event_id: result.event_id 
    }, 202);
  } catch (error) {
    // Handle duplicate event_id
    if (error instanceof Error && error.message.includes('Duplicate event_id')) {
      return c.json({
        error: 'Conflict',
        message: error.message
      }, 409);
    }
    
    // Log other errors and return 500
    console.error('Payment event processing failed', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      customer_id: payload.customer_id,
      event_id: payload.event_id
    });
    
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to process payment event'
    }, 500);
  }
});

// Engagement webhook endpoint
app.post('/webhooks/engagement', validateWebhookSignature, async (c) => {
  // Parse the engagement webhook payload from request body
  const payload = await c.req.json<EngagementWebhookPayload>();
  
  // Extract all required fields (validation happens implicitly through TypeScript)
  const {
    message_id,
    customer_id,
    status,
    timestamp
  } = payload;
  
  // Process asynchronously - update engagement status in database
  try {
    const result = await updateEngagementStatus(c.env.DB, payload);
    
    // Return HTTP 202 immediately (acknowledge receipt)
    return c.json({ 
      status: 'accepted',
      message_id: payload.message_id
    }, 202);
  } catch (error) {
    // Log errors and return 500
    console.error('Engagement event processing failed', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      customer_id: payload.customer_id,
      message_id: payload.message_id
    });
    
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to process engagement event'
    }, 500);
  }
});

// Analytics API: Recovery Rate Metrics
// Requirements: 3.1, 3.2, 3.3, 3.6
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
    
    // Generate cache key from query parameters (including pagination)
    const cacheKey = generateCacheKey('recovery_rate', {
      branch,
      date_range,
      plan,
      page: String(pagination.page),
      page_size: String(pagination.pageSize),
    });
    
    // Check KV cache first
    const cached = await getCachedMetrics<PaginatedResponse<RecoveryRateResponse>>(
      c.env.KV,
      cacheKey,
      { branch, date_range, plan, page: String(pagination.page), page_size: String(pagination.pageSize) }
    );
    
    if (cached) {
      // Return cached data
      return c.json(cached);
    }
    
    // Cache miss - calculate recovery rate from database
    const data = await calculateRecoveryRate(c.env.DB, {
      date_range,
      subscription_plan: plan,
      recovery_branch: branch,
    });
    
    // Build paginated response
    // Note: Recovery rate returns a single aggregated result, so pagination metadata
    // will always show 1 total item. This is for API consistency.
    const paginatedResponse: PaginatedResponse<RecoveryRateResponse> = {
      data,
      pagination: calculatePaginationMetadata(1, pagination.page, pagination.pageSize),
    };
    
    // Store result in KV with 5-minute TTL
    await setCachedMetrics(c.env.KV, cacheKey, paginatedResponse, 300);
    
    // Return JSON response
    return c.json(paginatedResponse);
  } catch (error) {
    // Handle validation errors
    if (error instanceof ValidationException) {
      return c.json(formatValidationErrors(error.errors), 400);
    }
    
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

// Analytics API: DSO Metrics
// Requirements: 3.4, 3.6
app.get('/api/metrics/dso', authenticateApiKey, rateLimiter(100), async (c) => {
  try {
    // Parse query parameters
    const dateRangeParam = c.req.query('date_range');
    const pageParam = c.req.query('page');
    const pageSizeParam = c.req.query('page_size');
    
    // Validate parameters
    const date_range = validateDateRange(dateRangeParam);
    const pagination = validatePaginationParams(pageParam, pageSizeParam);
    
    // Generate cache key from query parameters (including pagination)
    const cacheKey = generateCacheKey('dso', {
      date_range,
      page: String(pagination.page),
      page_size: String(pagination.pageSize),
    });
    
    // Check KV cache first
    const cached = await getCachedMetrics<PaginatedResponse<DSOResponse>>(
      c.env.KV,
      cacheKey,
      { date_range, page: String(pagination.page), page_size: String(pagination.pageSize) }
    );
    
    if (cached) {
      // Return cached data
      return c.json(cached);
    }
    
    // Cache miss - calculate DSO from database
    const data = await calculateDSO(c.env.DB, {
      date_range,
    });
    
    // Build paginated response
    // Note: DSO returns a single aggregated result, so pagination metadata
    // will always show 1 total item. This is for API consistency.
    const paginatedResponse: PaginatedResponse<DSOResponse> = {
      data,
      pagination: calculatePaginationMetadata(1, pagination.page, pagination.pageSize),
    };
    
    // Store result in KV with 5-minute TTL
    await setCachedMetrics(c.env.KV, cacheKey, paginatedResponse, 300);
    
    // Return JSON response
    return c.json(paginatedResponse);
  } catch (error) {
    // Handle validation errors
    if (error instanceof ValidationException) {
      return c.json(formatValidationErrors(error.errors), 400);
    }
    
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

// Analytics API: Cohort Analysis
// Requirements: 4.1, 4.2, 4.3, 4.4, 3.6
app.get('/api/metrics/cohorts', authenticateApiKey, rateLimiter(100), async (c) => {
  try {
    // Parse query parameters
    const startMonthParam = c.req.query('start_month');
    const endMonthParam = c.req.query('end_month');
    const pageParam = c.req.query('page');
    const pageSizeParam = c.req.query('page_size');
    
    // Validate parameters
    const start_month = validateMonth(startMonthParam, 'start_month');
    const end_month = validateMonth(endMonthParam, 'end_month');
    validateMonthRange(start_month, end_month);
    const pagination = validatePaginationParams(pageParam, pageSizeParam);
    
    // Generate cache key from query parameters (including pagination)
    const cacheKey = generateCacheKey('cohorts', {
      start_month,
      end_month,
      page: String(pagination.page),
      page_size: String(pagination.pageSize),
    });
    
    // Check KV cache first
    const cached = await getCachedMetrics<PaginatedResponse<CohortAnalysisResponse>>(
      c.env.KV,
      cacheKey,
      { start_month, end_month, page: String(pagination.page), page_size: String(pagination.pageSize) }
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
    
    // Apply pagination to cohorts array
    const totalCohorts = data.cohorts.length;
    const paginatedCohorts = paginateArray(data.cohorts, pagination.page, pagination.pageSize);
    
    // Build paginated response
    const paginatedResponse: PaginatedResponse<CohortAnalysisResponse> = {
      data: {
        cohorts: paginatedCohorts,
      },
      pagination: calculatePaginationMetadata(totalCohorts, pagination.page, pagination.pageSize),
    };
    
    // Store result in KV with 5-minute TTL
    await setCachedMetrics(c.env.KV, cacheKey, paginatedResponse, 300);
    
    // Return JSON response
    return c.json(paginatedResponse);
  } catch (error) {
    // Handle validation errors
    if (error instanceof ValidationException) {
      return c.json(formatValidationErrors(error.errors), 400);
    }
    
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

// Export the Hono app as the default Worker handler
export default app;
