import { Hono } from 'hono';
import { classifyRecoveryBranch } from './lib/recovery-branch';
import { validateWebhookSignature } from './lib/webhook-middleware';
import { authenticateApiKey } from './lib/api-key-auth';
import { authenticateChatwootToken } from './lib/chatwoot-auth';
import { rateLimiter } from './lib/rate-limiter';
import { insertPaymentEvent } from './lib/payment-event';
import { updateEngagementStatus } from './lib/engagement-event';
import { calculateRecoveryRate } from './lib/recovery-rate';
import { calculateDSO } from './lib/dso';
import { calculateCohortAnalysis } from './lib/cohort-analysis';
import { getCustomerBillingHistory } from './lib/customer-billing';
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
import { validatePaymentWebhookPII, validateEngagementWebhookPII } from './lib/pii-validation';
import { PaymentWebhookPayload, EngagementWebhookPayload, RecoveryRateResponse, DSOResponse, CohortAnalysisResponse, PaginatedResponse } from './types';

// Export business logic functions
export { classifyRecoveryBranch };
export { validateWebhookSignature };
export { authenticateApiKey };
export { authenticateChatwootToken };
export { rateLimiter };
export { insertPaymentEvent };
export { updateEngagementStatus };
export { calculateRecoveryRate };
export { calculateDSO };
export { calculateCohortAnalysis };
export { getCustomerBillingHistory };
export { getCachedMetrics, setCachedMetrics, generateCacheKey };
export { parsePaginationParams, calculatePaginationMetadata, paginateArray };
export { validatePaymentWebhookPII, validateEngagementWebhookPII };

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

// Create Hono app with environment type and execution context
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
// Requirements: 7.3, 8.1 - Validate PII compliance, return HTTP 202 within 100ms, process asynchronously
app.post('/webhooks/payment', validateWebhookSignature, async (c) => {
  // Parse the payment webhook payload from request body
  const payload = await c.req.json<PaymentWebhookPayload>();
  
  // Validate that payload does not contain PII (Requirement 7.3)
  const piiValidation = validatePaymentWebhookPII(payload, {
    stripSensitiveFields: false, // Reject entire payload if PII detected
    checkValuePatterns: true,
    logWarnings: true,
  });
  
  // If PII detected, reject the webhook
  if (!piiValidation.isValid) {
    console.error('Payment webhook rejected due to PII violations', {
      timestamp: new Date().toISOString(),
      event_id: payload.event_id,
      customer_id: payload.customer_id,
      violationCount: piiValidation.violations.length,
      violations: piiValidation.violations.map(v => ({
        field: v.field,
        reason: v.reason,
      })),
    });
    
    return c.json({
      error: 'Bad Request',
      message: 'Payload contains sensitive personal information that cannot be stored',
      details: 'Only customer_id and transaction metadata are allowed per LGPD compliance',
      violations: piiValidation.violations.map(v => ({
        field: v.field,
        reason: v.reason,
      })),
    }, 400);
  }
  
  // Extract event_id for immediate response
  const { event_id } = payload;
  
  // Process event asynchronously (fire and forget)
  // The promise is not awaited, so the response returns immediately
  // Cloudflare Workers will keep the execution context alive to complete this
  (async () => {
    try {
      await insertPaymentEvent(c.env.DB, payload);
      
      console.log('Payment event processed successfully', {
        timestamp: new Date().toISOString(),
        event_id: payload.event_id,
        customer_id: payload.customer_id
      });
    } catch (error) {
      // Log errors but don't fail the response (already sent)
      console.error('Payment event processing failed', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        customer_id: payload.customer_id,
        event_id: payload.event_id
      });
      
      // Note: Duplicate event_id errors are logged but not returned to sender
      // since the response has already been sent. The retry wrapper in task 16.1
      // will handle transient failures and DLQ will capture persistent failures.
    }
  })();
  
  // Return HTTP 202 immediately (acknowledge receipt within 100ms)
  // This prevents timeout issues and ensures reliable webhook delivery
  return c.json({ 
    status: 'accepted',
    event_id: event_id 
  }, 202);
});

// Engagement webhook endpoint
// Requirements: 7.3, 8.1 - Validate PII compliance, return HTTP 202 within 100ms, process asynchronously
app.post('/webhooks/engagement', validateWebhookSignature, async (c) => {
  // Parse the engagement webhook payload from request body
  const payload = await c.req.json<EngagementWebhookPayload>();
  
  // Validate that payload does not contain PII (Requirement 7.3)
  const piiValidation = validateEngagementWebhookPII(payload, {
    stripSensitiveFields: false, // Reject entire payload if PII detected
    checkValuePatterns: true,
    logWarnings: true,
  });
  
  // If PII detected, reject the webhook
  if (!piiValidation.isValid) {
    console.error('Engagement webhook rejected due to PII violations', {
      timestamp: new Date().toISOString(),
      message_id: payload.message_id,
      customer_id: payload.customer_id,
      violationCount: piiValidation.violations.length,
      violations: piiValidation.violations.map(v => ({
        field: v.field,
        reason: v.reason,
      })),
    });
    
    return c.json({
      error: 'Bad Request',
      message: 'Payload contains sensitive personal information that cannot be stored',
      details: 'Only customer_id and transaction metadata are allowed per LGPD compliance',
      violations: piiValidation.violations.map(v => ({
        field: v.field,
        reason: v.reason,
      })),
    }, 400);
  }
  
  // Extract message_id for immediate response
  const { message_id } = payload;
  
  // Process event asynchronously (fire and forget)
  // The promise is not awaited, so the response returns immediately
  // Cloudflare Workers will keep the execution context alive to complete this
  (async () => {
    try {
      await updateEngagementStatus(c.env.DB, payload);
      
      console.log('Engagement event processed successfully', {
        timestamp: new Date().toISOString(),
        message_id: payload.message_id,
        customer_id: payload.customer_id
      });
    } catch (error) {
      // Log errors but don't fail the response (already sent)
      console.error('Engagement event processing failed', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        customer_id: payload.customer_id,
        message_id: payload.message_id
      });
      
      // Note: The retry wrapper in task 16.1 will handle transient failures
      // and DLQ will capture persistent failures.
    }
  })();
  
  // Return HTTP 202 immediately (acknowledge receipt within 100ms)
  // This prevents timeout issues and ensures reliable webhook delivery
  return c.json({ 
    status: 'accepted',
    message_id: message_id
  }, 202);
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

// Chatwoot Sidebar API: Customer Billing History
// Requirements: 5.1, 5.2, 5.3, 5.4
app.get('/api/chatwoot/customer/:customer_id/billing', authenticateChatwootToken, async (c) => {
  try {
    // Extract customer_id from URL parameter
    const customerId = c.req.param('customer_id');
    
    if (!customerId) {
      return c.json({
        error: 'Bad Request',
        message: 'Missing customer_id parameter'
      }, 400);
    }
    
    // Query D1 for customer's billing history
    const billingData = await getCustomerBillingHistory(c.env.DB, customerId);
    
    // Return JSON response
    return c.json(billingData);
  } catch (error) {
    // Log error and return 500
    console.error('Customer billing query failed', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      customer_id: c.req.param('customer_id'),
    });
    
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve customer billing information'
    }, 500);
  }
});

// Chatwoot Sidebar API: Resend Boleto
// Requirements: 5.5
app.post('/api/chatwoot/customer/:customer_id/resend-boleto', authenticateChatwootToken, async (c) => {
  try {
    // Extract customer_id from URL parameter
    const customerId = c.req.param('customer_id');
    
    if (!customerId) {
      return c.json({
        error: 'Bad Request',
        message: 'Missing customer_id parameter'
      }, 400);
    }
    
    // Parse request body
    const body = await c.req.json();
    const { invoice_id } = body;
    
    if (!invoice_id) {
      return c.json({
        error: 'Bad Request',
        message: 'Missing invoice_id in request body'
      }, 400);
    }
    
    // Trigger n8n webhook with action, customer_id, and invoice_id
    const n8nWebhookUrl = c.env.N8N_WEBHOOK_URL;
    
    const n8nPayload = {
      action: 'resend_boleto',
      customer_id: customerId,
      invoice_id: invoice_id,
      timestamp: new Date().toISOString(),
    };
    
    // Make request to n8n webhook
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nPayload),
    });
    
    // Check if n8n webhook call was successful
    if (!n8nResponse.ok) {
      console.error('n8n webhook call failed', {
        timestamp: new Date().toISOString(),
        status: n8nResponse.status,
        statusText: n8nResponse.statusText,
        customer_id: customerId,
        invoice_id: invoice_id,
      });
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Failed to trigger Boleto resend workflow'
      }, 500);
    }
    
    // Log successful trigger
    console.log('Boleto resend triggered successfully', {
      timestamp: new Date().toISOString(),
      customer_id: customerId,
      invoice_id: invoice_id,
    });
    
    // Return success status
    return c.json({
      status: 'triggered',
      message: 'Boleto resend workflow triggered successfully',
      customer_id: customerId,
      invoice_id: invoice_id,
    });
  } catch (error) {
    // Log error and return 500
    console.error('Boleto resend request failed', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      customer_id: c.req.param('customer_id'),
    });
    
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to process Boleto resend request'
    }, 500);
  }
});

// Export the Hono app as the default Worker handler
export default app;
