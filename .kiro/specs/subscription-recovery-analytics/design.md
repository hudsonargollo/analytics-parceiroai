# Design Document: Subscription Recovery Analytics

## Overview

The Subscription Recovery Analytics system is a serverless analytics platform built on Cloudflare's edge infrastructure. It processes payment and engagement events from n8n workflows, stores them in a globally distributed database, and exposes real-time analytics through a REST API and React dashboard. The system integrates with Asaas payment gateway, ZuckZapGo WhatsApp service, and Chatwoot support platform to provide comprehensive subscription recovery insights.

### Technology Stack

**Backend:**
- Cloudflare Workers with Hono.js framework for API routing
- Cloudflare D1 (SQLite) for relational data storage
- Cloudflare KV for caching aggregated metrics
- Cloudflare Secrets Manager for credential storage

**Frontend:**
- React 18 with TypeScript
- Tailwind CSS for styling
- shadcn/ui component library
- Framer Motion for animations
- Cloudflare Pages for hosting

**CI/CD:**
- GitHub Actions for automated testing and deployment
- Wrangler CLI for Cloudflare deployments

**External Integrations:**
- n8n workflow automation platform
- Asaas payment gateway (Brazilian market)
- ZuckZapGo WhatsApp API
- Chatwoot customer support platform

### Design Principles

1. **Edge-First Architecture**: Leverage Cloudflare's global network for low-latency responses
2. **Event-Driven Processing**: Asynchronous webhook handling with retry mechanisms
3. **Cache-Aside Pattern**: Use KV for frequently accessed aggregated data
4. **Separation of Concerns**: Clear boundaries between event ingestion, storage, and presentation
5. **Security by Default**: All credentials in Secrets Manager, HMAC validation on webhooks

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         External Systems                         │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   n8n        │   Asaas      │  ZuckZapGo   │    Chatwoot        │
│  Workflows   │   Payment    │   WhatsApp   │    Support         │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                │
       │ Webhooks     │ Events       │ Status Updates │ API Calls
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers (Hono.js)                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Webhook    │  │   Analytics  │  │   Chatwoot   │          │
│  │   Ingestion  │  │   API        │  │   Sidebar    │          │
│  │   Handler    │  │   Endpoints  │  │   API        │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │         Middleware Layer                          │          │
│  │  - Authentication & Rate Limiting                 │          │
│  │  - HMAC Signature Validation                      │          │
│  │  - Error Handling & Logging                       │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────┬───────────────────────────┬───────────────────────┘
              │                           │
              ▼                           ▼
    ┌──────────────────┐        ┌──────────────────┐
    │  Cloudflare D1   │        │  Cloudflare KV   │
    │  (SQLite)        │        │  (Cache)         │
    │                  │        │                  │
    │  - recovery_logs │        │  - metrics_cache │
    │  - payment_events│        │  - cohort_cache  │
    │  - engagement_   │        │  TTL: 5 minutes  │
    │    events        │        │                  │
    └──────────────────┘        └──────────────────┘
              │
              │ Query Results
              ▼
    ┌──────────────────────────────────────┐
    │     React Dashboard (Cloudflare      │
    │            Pages)                     │
    ├──────────────────────────────────────┤
    │  - Recovery Rate Charts              │
    │  - Cohort Analysis Tables            │
    │  - DSO Metrics                       │
    │  - Branch Comparison Views           │
    └──────────────────────────────────────┘
```

### Request Flow

**Payment Event Ingestion:**
1. n8n workflow processes Asaas payment event
2. n8n sends HTTP POST to `/webhooks/payment` with HMAC signature
3. Worker validates signature and extracts event data
4. Worker classifies recovery branch based on due date
5. Worker writes to D1 `payment_events` table
6. Worker invalidates relevant KV cache entries
7. Worker returns HTTP 202 Accepted

**Engagement Event Ingestion:**
1. ZuckZapGo sends WhatsApp status update to `/webhooks/engagement`
2. Worker validates webhook signature
3. Worker looks up corresponding recovery log by message_id
4. Worker updates engagement fields in D1
5. Worker returns HTTP 202 Accepted

**Analytics Query:**
1. Dashboard requests `/api/metrics/recovery-rate?branch=overdue&date_range=30d`
2. Worker checks KV cache for matching key
3. If cache miss or expired, Worker queries D1 with optimized SQL
4. Worker stores result in KV with 5-minute TTL
5. Worker returns JSON response to dashboard

**Chatwoot Sidebar:**
1. Agent opens customer conversation in Chatwoot
2. Chatwoot iframe loads sidebar app from Cloudflare Pages
3. Sidebar app calls `/api/chatwoot/customer/:id/billing`
4. Worker queries D1 for customer's outstanding invoices
5. Worker returns billing history with payment options
6. Sidebar renders "Copy Pix" and "Resend Boleto" buttons

## Components and Interfaces

### 1. Webhook Ingestion Handler

**Responsibilities:**
- Receive and validate webhook requests from n8n and ZuckZapGo
- Extract and normalize event data
- Classify recovery branches
- Write events to D1 database
- Handle duplicate detection

**Hono.js Routes:**

```typescript
// Payment webhook endpoint
app.post('/webhooks/payment', 
  validateHmacSignature,
  async (c) => {
    const event = await c.req.json<PaymentWebhookPayload>()
    const recoveryBranch = classifyRecoveryBranch(event.due_date)
    const result = await insertPaymentEvent(c.env.DB, event, recoveryBranch)
    return c.json({ event_id: result.id }, 202)
  }
)

// Engagement webhook endpoint
app.post('/webhooks/engagement',
  validateZuckZapGoSignature,
  async (c) => {
    const event = await c.req.json<EngagementWebhookPayload>()
    await updateEngagementStatus(c.env.DB, event)
    return c.json({ status: 'accepted' }, 202)
  }
)
```

**Interface: PaymentWebhookPayload**
```typescript
interface PaymentWebhookPayload {
  event_id: string           // Unique identifier from Asaas
  customer_id: string         // Customer identifier
  invoice_id: string          // Invoice reference
  amount: number              // Payment amount in BRL cents
  payment_method: 'pix' | 'boleto' | 'credit_card'
  status: 'pending' | 'confirmed' | 'failed'
  due_date: string            // ISO 8601 date
  timestamp: string           // ISO 8601 timestamp
  branch?: string             // Optional explicit branch classification
}
```

**Interface: EngagementWebhookPayload**
```typescript
interface EngagementWebhookPayload {
  message_id: string          // WhatsApp message identifier
  customer_id: string         // Customer identifier
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string           // ISO 8601 timestamp
}
```

### 2. Analytics API

**Responsibilities:**
- Expose REST endpoints for dashboard queries
- Implement caching strategy with KV
- Calculate recovery metrics and DSO
- Support filtering and pagination

**Hono.js Routes:**

```typescript
// Recovery rate metrics
app.get('/api/metrics/recovery-rate',
  authenticateApiKey,
  rateLimiter(100),
  async (c) => {
    const { branch, date_range, plan } = c.req.query()
    const cacheKey = `recovery_rate:${branch}:${date_range}:${plan}`
    
    let data = await c.env.KV.get(cacheKey, { type: 'json' })
    if (!data) {
      data = await calculateRecoveryRate(c.env.DB, { branch, date_range, plan })
      await c.env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 })
    }
    
    return c.json(data)
  }
)

// DSO metrics
app.get('/api/metrics/dso',
  authenticateApiKey,
  rateLimiter(100),
  async (c) => {
    const { date_range } = c.req.query()
    const cacheKey = `dso:${date_range}`
    
    let data = await c.env.KV.get(cacheKey, { type: 'json' })
    if (!data) {
      data = await calculateDSO(c.env.DB, date_range)
      await c.env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 })
    }
    
    return c.json(data)
  }
)

// Cohort analysis
app.get('/api/metrics/cohorts',
  authenticateApiKey,
  rateLimiter(100),
  async (c) => {
    const { start_month, end_month } = c.req.query()
    const cacheKey = `cohorts:${start_month}:${end_month}`
    
    let data = await c.env.KV.get(cacheKey, { type: 'json' })
    if (!data) {
      data = await calculateCohortAnalysis(c.env.DB, start_month, end_month)
      await c.env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 })
    }
    
    return c.json(data)
  }
)
```

**Interface: RecoveryRateResponse**
```typescript
interface RecoveryRateResponse {
  branch: string
  date_range: string
  total_attempts: number
  successful_recoveries: number
  recovery_rate: number        // Percentage (0-100)
  total_amount_attempted: number
  total_amount_recovered: number
  breakdown_by_method: {
    pix: { attempts: number, recoveries: number, rate: number }
    boleto: { attempts: number, recoveries: number, rate: number }
    credit_card: { attempts: number, recoveries: number, rate: number }
  }
}
```

**Interface: DSOResponse**
```typescript
interface DSOResponse {
  date_range: string
  average_dso: number          // Days
  median_dso: number           // Days
  by_branch: {
    '3-day-notice': number
    'due-today': number
    'overdue': number
  }
}
```

**Interface: CohortAnalysisResponse**
```typescript
interface CohortAnalysisResponse {
  cohorts: Array<{
    cohort_month: string       // YYYY-MM format
    total_customers: number
    billing_cycles: Array<{
      cycle_number: number
      attempted: number
      recovered: number
      recovery_rate: number
    }>
    is_statistically_significant: boolean
  }>
}
```

### 3. Chatwoot Sidebar API

**Responsibilities:**
- Provide customer billing context to support agents
- Expose payment action endpoints (Pix copy, Boleto resend)
- Trigger n8n workflows for payment operations

**Hono.js Routes:**

```typescript
// Get customer billing history
app.get('/api/chatwoot/customer/:customer_id/billing',
  authenticateChatwootToken,
  async (c) => {
    const customerId = c.req.param('customer_id')
    const billingData = await getCustomerBillingHistory(c.env.DB, customerId)
    return c.json(billingData)
  }
)

// Trigger Boleto resend via n8n
app.post('/api/chatwoot/customer/:customer_id/resend-boleto',
  authenticateChatwootToken,
  async (c) => {
    const customerId = c.req.param('customer_id')
    const { invoice_id } = await c.req.json()
    
    // Trigger n8n workflow
    await fetch(c.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resend_boleto',
        customer_id: customerId,
        invoice_id: invoice_id
      })
    })
    
    return c.json({ status: 'triggered' })
  }
)
```

**Interface: CustomerBillingResponse**
```typescript
interface CustomerBillingResponse {
  customer_id: string
  outstanding_invoices: Array<{
    invoice_id: string
    amount: number
    due_date: string
    status: 'pending' | 'overdue' | 'paid'
    payment_method: string
    pix_code?: string          // Present if Pix payment available
    boleto_url?: string        // Present if Boleto available
    days_overdue?: number      // Present if overdue
  }>
  total_outstanding: number
  last_payment_date?: string
  payment_history_summary: {
    total_paid: number
    on_time_payments: number
    late_payments: number
  }
}
```

### 4. Middleware Components

**HMAC Signature Validation:**
```typescript
async function validateHmacSignature(c: Context, next: Next) {
  const signature = c.req.header('X-Webhook-Signature')
  const body = await c.req.text()
  const secret = c.env.WEBHOOK_SECRET
  
  const expectedSignature = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret + body)
  )
  
  if (signature !== bufferToHex(expectedSignature)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }
  
  await next()
}
```

**Rate Limiter:**
```typescript
function rateLimiter(requestsPerMinute: number) {
  return async (c: Context, next: Next) => {
    const apiKey = c.req.header('X-API-Key')
    const rateLimitKey = `rate_limit:${apiKey}:${Math.floor(Date.now() / 60000)}`
    
    const currentCount = await c.env.KV.get(rateLimitKey)
    if (currentCount && parseInt(currentCount) >= requestsPerMinute) {
      return c.json({ error: 'Rate limit exceeded' }, 429)
    }
    
    await c.env.KV.put(rateLimitKey, String((parseInt(currentCount || '0') + 1)), {
      expirationTtl: 60
    })
    
    await next()
  }
}
```

**API Key Authentication:**
```typescript
async function authenticateApiKey(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key')
  const validKeys = c.env.VALID_API_KEYS.split(',')
  
  if (!apiKey || !validKeys.includes(apiKey)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  await next()
}
```

## Data Models

### D1 Database Schema

**Table: payment_events**
```sql
CREATE TABLE payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  amount INTEGER NOT NULL,              -- Amount in cents
  payment_method TEXT NOT NULL,         -- 'pix', 'boleto', 'credit_card'
  status TEXT NOT NULL,                 -- 'pending', 'confirmed', 'failed'
  recovery_branch TEXT NOT NULL,        -- '3-day-notice', 'due-today', 'overdue'
  due_date TEXT NOT NULL,               -- ISO 8601 date
  created_at TEXT NOT NULL,             -- ISO 8601 timestamp
  updated_at TEXT NOT NULL              -- ISO 8601 timestamp
);

CREATE INDEX idx_payment_customer ON payment_events(customer_id);
CREATE INDEX idx_payment_created ON payment_events(created_at);
CREATE INDEX idx_payment_branch ON payment_events(recovery_branch);
CREATE INDEX idx_payment_status ON payment_events(status);
CREATE INDEX idx_payment_invoice ON payment_events(invoice_id);
```

**Table: engagement_events**
```sql
CREATE TABLE engagement_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_id TEXT,                      -- Nullable, linked when available
  status TEXT NOT NULL,                 -- 'sent', 'delivered', 'read', 'failed'
  recovery_branch TEXT,                 -- Linked from payment event
  created_at TEXT NOT NULL,             -- ISO 8601 timestamp
  updated_at TEXT NOT NULL              -- ISO 8601 timestamp
);

CREATE INDEX idx_engagement_customer ON engagement_events(customer_id);
CREATE INDEX idx_engagement_message ON engagement_events(message_id);
CREATE INDEX idx_engagement_invoice ON engagement_events(invoice_id);
CREATE INDEX idx_engagement_created ON engagement_events(created_at);
```

**Table: recovery_logs**
```sql
CREATE TABLE recovery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  payment_event_id INTEGER,             -- Foreign key to payment_events
  engagement_event_id INTEGER,          -- Foreign key to engagement_events
  recovery_branch TEXT NOT NULL,
  message_sent_at TEXT,                 -- ISO 8601 timestamp
  message_delivered_at TEXT,            -- ISO 8601 timestamp
  message_read_at TEXT,                 -- ISO 8601 timestamp
  payment_received_at TEXT,             -- ISO 8601 timestamp
  amount INTEGER,                       -- Amount in cents
  payment_method TEXT,
  recovery_time_hours INTEGER,          -- Hours from message sent to payment
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (payment_event_id) REFERENCES payment_events(id),
  FOREIGN KEY (engagement_event_id) REFERENCES engagement_events(id)
);

CREATE INDEX idx_recovery_customer ON recovery_logs(customer_id);
CREATE INDEX idx_recovery_invoice ON recovery_logs(invoice_id);
CREATE INDEX idx_recovery_branch ON recovery_logs(recovery_branch);
CREATE INDEX idx_recovery_created ON recovery_logs(created_at);
```

**Table: customer_cohorts**
```sql
CREATE TABLE customer_cohorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT UNIQUE NOT NULL,
  cohort_month TEXT NOT NULL,           -- YYYY-MM format
  subscription_start_date TEXT NOT NULL, -- ISO 8601 date
  subscription_plan TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_cohort_month ON customer_cohorts(cohort_month);
CREATE INDEX idx_cohort_customer ON customer_cohorts(customer_id);
```

### KV Cache Keys

**Cache Key Patterns:**
```
recovery_rate:{branch}:{date_range}:{plan}
dso:{date_range}
cohorts:{start_month}:{end_month}
rate_limit:{api_key}:{minute_timestamp}
customer_billing:{customer_id}
```

**Cache TTL Strategy:**
- Aggregated metrics: 300 seconds (5 minutes)
- Rate limit counters: 60 seconds
- Customer billing data: 60 seconds (frequently updated)
- Current day queries: No cache (bypass KV, query D1 directly)

### Recovery Branch Classification Logic

```typescript
function classifyRecoveryBranch(dueDate: string, currentDate: string = new Date().toISOString()): string {
  const due = new Date(dueDate)
  const now = new Date(currentDate)
  const daysDiff = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysDiff === 3) {
    return '3-day-notice'
  } else if (daysDiff === 0) {
    return 'due-today'
  } else if (daysDiff < 0) {
    return 'overdue'
  } else {
    // Default to 3-day-notice for other cases
    return '3-day-notice'
  }
}
```

### Database Query Patterns

**Calculate Recovery Rate:**
```sql
SELECT 
  recovery_branch,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as successful_recoveries,
  CAST(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as recovery_rate,
  SUM(amount) as total_amount_attempted,
  SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END) as total_amount_recovered
FROM payment_events
WHERE created_at >= ? AND created_at <= ?
  AND (? IS NULL OR recovery_branch = ?)
  AND (? IS NULL OR payment_method = ?)
GROUP BY recovery_branch;
```

**Calculate DSO:**
```sql
SELECT 
  AVG(JULIANDAY(payment_received_at) - JULIANDAY(message_sent_at)) as average_dso,
  recovery_branch
FROM recovery_logs
WHERE payment_received_at IS NOT NULL
  AND created_at >= ? AND created_at <= ?
GROUP BY recovery_branch;
```

**Cohort Analysis:**
```sql
SELECT 
  cc.cohort_month,
  COUNT(DISTINCT cc.customer_id) as total_customers,
  COUNT(DISTINCT CASE WHEN pe.status = 'confirmed' THEN pe.customer_id END) as recovered_customers,
  CAST(COUNT(DISTINCT CASE WHEN pe.status = 'confirmed' THEN pe.customer_id END) AS FLOAT) / 
    COUNT(DISTINCT cc.customer_id) * 100 as recovery_rate
FROM customer_cohorts cc
LEFT JOIN payment_events pe ON cc.customer_id = pe.customer_id
WHERE cc.cohort_month >= ? AND cc.cohort_month <= ?
GROUP BY cc.cohort_month
HAVING COUNT(DISTINCT cc.customer_id) >= 10;
```

## Error Handling

### Webhook Processing Errors

**Strategy: Acknowledge First, Process Later**
1. Immediately return HTTP 202 Accepted upon receiving webhook
2. Process event asynchronously within Worker execution context
3. If processing fails, log to dead-letter queue (KV namespace)
4. Implement exponential backoff retry (3 attempts: 1s, 2s, 4s)

**Dead Letter Queue Implementation:**
```typescript
async function processWithRetry(fn: () => Promise<void>, maxRetries: number = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fn()
      return
    } catch (error) {
      if (attempt === maxRetries - 1) {
        // Final attempt failed, send to DLQ
        await env.KV.put(
          `dlq:${Date.now()}:${crypto.randomUUID()}`,
          JSON.stringify({ error: error.message, attempt, timestamp: new Date().toISOString() }),
          { expirationTtl: 86400 * 7 } // Keep for 7 days
        )
        throw error
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }
}
```

### Database Errors

**Connection Failures:**
- D1 is managed by Cloudflare, connection pooling handled automatically
- If D1 query fails, return HTTP 503 Service Unavailable
- Log error with context for debugging

**Constraint Violations:**
- Duplicate event_id: Return HTTP 409 Conflict with message "Event already processed"
- Foreign key violations: Log warning and continue (orphaned engagement events)

**Query Timeouts:**
- Set query timeout to 10 seconds
- If timeout occurs, return HTTP 504 Gateway Timeout
- Consider query optimization or adding indexes

### API Errors

**Authentication Failures:**
- Invalid API key: HTTP 401 Unauthorized
- Missing signature: HTTP 401 Unauthorized
- Invalid HMAC: HTTP 401 Unauthorized
- Log all authentication failures for security monitoring

**Rate Limiting:**
- Exceeded limit: HTTP 429 Too Many Requests
- Include `Retry-After` header with seconds until reset
- Response body: `{ "error": "Rate limit exceeded", "retry_after": 45 }`

**Validation Errors:**
- Invalid query parameters: HTTP 400 Bad Request
- Missing required fields: HTTP 400 Bad Request
- Response includes detailed error messages: `{ "error": "Invalid date_range format", "expected": "30d, 60d, 90d" }`

**Cache Errors:**
- KV read failure: Fall back to D1 query, log warning
- KV write failure: Continue serving response, log error (cache is optional)

### Frontend Error Handling

**API Request Failures:**
- Network errors: Show toast notification "Unable to connect. Please check your connection."
- 5xx errors: Show toast "Service temporarily unavailable. Retrying..."
- Implement exponential backoff retry for transient failures
- After 3 failed retries, show persistent error banner

**Data Loading States:**
- Show skeleton loaders during initial data fetch
- Show spinner for refresh operations
- Disable interactive elements during mutations

**Chatwoot Sidebar Errors:**
- Customer not found: Display message "No billing information available"
- API timeout: Show "Loading billing data..." with retry button
- Action failures (Boleto resend): Show error toast with specific message

## Testing Strategy

### Unit Testing

**Backend (Vitest):**
- Test individual functions in isolation
- Mock D1 and KV bindings using Miniflare
- Test recovery branch classification logic
- Test HMAC signature validation
- Test rate limiting logic
- Test cache key generation

**Frontend (Vitest + React Testing Library):**
- Test component rendering with mock data
- Test user interactions (button clicks, form submissions)
- Test error state rendering
- Test loading state rendering

### Property-Based Testing

Property-based tests will validate universal correctness properties across randomly generated inputs. Each test will run a minimum of 100 iterations to ensure comprehensive coverage.

**Testing Library:** fast-check (TypeScript property-based testing library)

**Test Configuration:**
```typescript
import fc from 'fast-check'

// Example property test structure
fc.assert(
  fc.property(
    fc.record({
      customer_id: fc.string(),
      amount: fc.integer({ min: 100, max: 1000000 }),
      // ... other generators
    }),
    (event) => {
      // Property assertion
    }
  ),
  { numRuns: 100 }
)
```

### Integration Testing

**API Endpoint Tests:**
- Test complete request/response cycles
- Use test D1 database with seed data
- Test webhook signature validation end-to-end
- Test cache invalidation on writes
- Test pagination behavior

**Database Tests:**
- Test schema migrations
- Test index effectiveness with EXPLAIN QUERY PLAN
- Test foreign key constraints
- Test concurrent writes (simulate race conditions)

### End-to-End Testing

**Playwright Tests:**
- Test dashboard loading and chart rendering
- Test filter interactions and data updates
- Test Chatwoot sidebar loading in iframe context
- Test responsive design on mobile viewports

**Webhook Flow Tests:**
- Send test webhooks to staging environment
- Verify data appears in dashboard
- Verify cache invalidation
- Verify engagement event linking

### Performance Testing

**Load Testing (k6):**
- Simulate 1000 concurrent webhook requests
- Measure p95 and p99 latency
- Verify rate limiting behavior under load
- Test cache hit rates

**Database Performance:**
- Benchmark common queries with 1M+ rows
- Verify index usage with EXPLAIN QUERY PLAN
- Test query performance degradation over time


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Webhook Acceptance

*For any* valid payment webhook payload from n8n with proper HMAC signature, the system should accept the webhook and return HTTP 202 status code.

**Validates: Requirements 1.1**

### Property 2: Payment Event Field Extraction

*For any* payment webhook payload containing customer_id, amount, payment_method, status, and timestamp fields, the system should correctly extract all five fields and store them in the database.

**Validates: Requirements 1.2**

### Property 3: Recovery Branch Classification

*For any* invoice with a due date, the system should classify it as "3-day-notice" when due in 3 days, "due-today" when due today, and "overdue" when past due date.

**Validates: Requirements 1.3, 10.1, 10.2, 10.3**

### Property 4: Event Persistence Round Trip

*For any* payment event with a unique event_id, storing it in the database then querying by event_id should return an equivalent event with all fields preserved.

**Validates: Requirements 1.4**

### Property 5: Duplicate Event Rejection (Idempotency)

*For any* payment event, attempting to insert it twice with the same event_id should succeed on the first attempt and fail with a conflict error on the second attempt.

**Validates: Requirements 1.5**

### Property 6: Engagement Status Updates

*For any* engagement event (delivered or read status) with a valid message_id, the system should update the corresponding recovery log with the engagement timestamp while preserving all existing payment data.

**Validates: Requirements 2.1, 2.2, 2.4**

### Property 7: Engagement Event Field Extraction

*For any* engagement webhook payload containing message_id, customer_id, status, and timestamp fields, the system should correctly extract all four fields.

**Validates: Requirements 2.3**

### Property 8: Orphaned Engagement Event Handling

*For any* engagement event with a message_id that has no matching recovery log, the system should store the event in the engagement_events table with a null invoice_id.

**Validates: Requirements 2.5**

### Property 9: Recovery Rate Calculation Accuracy

*For any* set of payment events with known outcomes (confirmed vs pending/failed), the calculated recovery rate should equal the percentage of confirmed payments divided by total attempts.

**Validates: Requirements 3.3**

### Property 10: DSO Calculation Accuracy

*For any* set of recovery logs with known date differences between invoice creation and payment, the calculated average DSO should equal the mean of all date differences in days.

**Validates: Requirements 3.4**

### Property 11: Query Filter Application

*For any* combination of valid filter parameters (date_range, subscription_plan, recovery_branch), the API should return only records matching all specified filters.

**Validates: Requirements 3.2**

### Property 12: Pagination Consistency

*For any* query result exceeding 100 records, fetching all pages and concatenating them should produce the same set of records as a non-paginated query (if it were allowed).

**Validates: Requirements 3.5**

### Property 13: Invalid Parameter Error Responses

*For any* API request with invalid parameters (malformed dates, invalid branch names, negative page numbers), the system should return HTTP 400 with a descriptive error message.

**Validates: Requirements 3.6**

### Property 14: Cohort Grouping by Month

*For any* set of customers with subscription start dates, grouping them by cohort should place all customers starting in the same month into the same cohort.

**Validates: Requirements 4.1**

### Property 15: Cohort Metric Completeness

*For any* cohort analysis response, each cohort should include total_customers, recovered_customers, and recovery_rate fields.

**Validates: Requirements 4.3**

### Property 16: Statistical Significance Flagging

*For any* cohort with fewer than 10 customers, the is_statistically_significant field should be false; for cohorts with 10 or more customers, it should be true.

**Validates: Requirements 4.4**

### Property 17: Billing History Completeness

*For any* customer with outstanding invoices, the billing history response should include all required fields: invoice_id, amount, due_date, status, and payment_method for each invoice.

**Validates: Requirements 5.2**

### Property 18: Conditional Payment Action Buttons

*For any* invoice, the response should include a pix_code field if and only if the payment method is Pix, and should include a boleto_url field if and only if the payment method is Boleto.

**Validates: Requirements 5.3, 5.4**

### Property 19: Boleto Resend Trigger

*For any* valid customer_id and invoice_id, triggering the resend Boleto action should result in an HTTP POST to the n8n webhook URL with the correct action, customer_id, and invoice_id in the payload.

**Validates: Requirements 5.5**

### Property 20: Cache Hit for Repeated Queries

*For any* aggregated metrics query, executing it twice within 5 minutes should result in the second request being served from KV cache (verifiable by faster response time and no database query).

**Validates: Requirements 6.2, 6.3**

### Property 21: Current Day Cache Bypass

*For any* metrics query with date_range set to "today" or "current", the system should always query D1 directly and never serve from KV cache.

**Validates: Requirements 6.4**

### Property 22: HMAC Signature Validation

*For any* webhook request, the system should accept it if and only if the HMAC signature in the X-Webhook-Signature header matches the computed signature using the shared secret.

**Validates: Requirements 7.2**

### Property 23: Data Privacy Compliance

*For any* record stored in the database, it should contain only customer_id and transaction metadata, with no sensitive personal information fields (name, email, phone, address).

**Validates: Requirements 7.3**

### Property 24: Authentication Failure Response

*For any* API request without a valid API key or with an invalid API key, the system should return HTTP 401 Unauthorized.

**Validates: Requirements 7.4**

### Property 25: Rate Limiting Enforcement

*For any* API key, after making 100 requests within a 60-second window, the 101st request should return HTTP 429 Too Many Requests.

**Validates: Requirements 7.5**

### Property 26: Immediate Webhook Acknowledgment

*For any* webhook request, the system should return HTTP 202 Accepted within 100ms, before completing the full processing of the event.

**Validates: Requirements 8.1**

### Property 27: Retry with Exponential Backoff

*For any* database write operation that fails, the system should retry up to 3 times with delays of approximately 1s, 2s, and 4s between attempts.

**Validates: Requirements 8.2**

### Property 28: Dead Letter Queue on Persistent Failure

*For any* event that fails processing after all 3 retry attempts, the system should write the event to the dead-letter queue in KV with a TTL of 7 days.

**Validates: Requirements 8.3**

### Property 29: Historical Data Query Support

*For any* date range query spanning up to 24 months in the past, the system should successfully return results without errors.

**Validates: Requirements 8.4**

### Property 30: Explicit Branch Parameter Override

*For any* payment event with an explicit branch parameter, the system should use the provided branch value instead of calculating it from the due date.

**Validates: Requirements 10.4**

### Property 31: Branch Inference from Dates

*For any* payment event without an explicit branch parameter, the system should infer the branch by comparing the due_date to the current timestamp using the classification logic.

**Validates: Requirements 10.5**

## Deployment Architecture

### Cloudflare Workers Configuration

**wrangler.toml:**
```toml
name = "subscription-recovery-analytics"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
name = "subscription-recovery-analytics-prod"
vars = { ENVIRONMENT = "production" }

[env.staging]
name = "subscription-recovery-analytics-staging"
vars = { ENVIRONMENT = "staging" }

[env.development]
name = "subscription-recovery-analytics-dev"
vars = { ENVIRONMENT = "development" }

[[d1_databases]]
binding = "DB"
database_name = "recovery_analytics"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

[vars]
N8N_WEBHOOK_URL = "https://your-n8n-instance.com/webhook/boleto-resend"
```

**Secrets (managed via Wrangler CLI):**
```bash
wrangler secret put WEBHOOK_SECRET
wrangler secret put ZUCKZAPGO_SECRET
wrangler secret put VALID_API_KEYS
wrangler secret put CHATWOOT_TOKEN
```

### React Frontend Configuration

**Project Structure:**
```
frontend/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── RecoveryRateChart.tsx
│   │   ├── CohortAnalysisTable.tsx
│   │   ├── DSOMetrics.tsx
│   │   └── chatwoot/
│   │       └── BillingSidebar.tsx
│   ├── hooks/
│   │   ├── useRecoveryMetrics.ts
│   │   ├── useCohortAnalysis.ts
│   │   └── useCustomerBilling.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

**Key Dependencies:**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-query": "^5.0.0",
    "recharts": "^2.10.0",
    "framer-motion": "^11.0.0",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-toast": "^1.1.5",
    "date-fns": "^3.0.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.1.0"
  }
}
```

### GitHub Actions CI/CD Pipeline

**.github/workflows/deploy.yml:**
```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, staging, development]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run property-based tests
        run: npm run test:property
      
      - name: Run integration tests
        run: npm run test:integration

  deploy-worker:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: ${{ github.ref == 'refs/heads/main' && 'production' || github.ref == 'refs/heads/staging' && 'staging' || 'development' }}
      
      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Build frontend
        working-directory: ./frontend
        run: npm run build
        env:
          VITE_API_URL: ${{ github.ref == 'refs/heads/main' && 'https://api.recovery-analytics.com' || 'https://staging-api.recovery-analytics.com' }}
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: subscription-recovery-dashboard
          directory: ./frontend/dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

### Database Migrations

**migrations/0001_initial_schema.sql:**
```sql
-- Create payment_events table
CREATE TABLE payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL,
  recovery_branch TEXT NOT NULL,
  due_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_payment_customer ON payment_events(customer_id);
CREATE INDEX idx_payment_created ON payment_events(created_at);
CREATE INDEX idx_payment_branch ON payment_events(recovery_branch);
CREATE INDEX idx_payment_status ON payment_events(status);
CREATE INDEX idx_payment_invoice ON payment_events(invoice_id);

-- Create engagement_events table
CREATE TABLE engagement_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_id TEXT,
  status TEXT NOT NULL,
  recovery_branch TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_engagement_customer ON engagement_events(customer_id);
CREATE INDEX idx_engagement_message ON engagement_events(message_id);
CREATE INDEX idx_engagement_invoice ON engagement_events(invoice_id);
CREATE INDEX idx_engagement_created ON engagement_events(created_at);

-- Create recovery_logs table
CREATE TABLE recovery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  payment_event_id INTEGER,
  engagement_event_id INTEGER,
  recovery_branch TEXT NOT NULL,
  message_sent_at TEXT,
  message_delivered_at TEXT,
  message_read_at TEXT,
  payment_received_at TEXT,
  amount INTEGER,
  payment_method TEXT,
  recovery_time_hours INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (payment_event_id) REFERENCES payment_events(id),
  FOREIGN KEY (engagement_event_id) REFERENCES engagement_events(id)
);

CREATE INDEX idx_recovery_customer ON recovery_logs(customer_id);
CREATE INDEX idx_recovery_invoice ON recovery_logs(invoice_id);
CREATE INDEX idx_recovery_branch ON recovery_logs(recovery_branch);
CREATE INDEX idx_recovery_created ON recovery_logs(created_at);

-- Create customer_cohorts table
CREATE TABLE customer_cohorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT UNIQUE NOT NULL,
  cohort_month TEXT NOT NULL,
  subscription_start_date TEXT NOT NULL,
  subscription_plan TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_cohort_month ON customer_cohorts(cohort_month);
CREATE INDEX idx_cohort_customer ON customer_cohorts(customer_id);
```

**Migration execution:**
```bash
# Apply migrations to development
wrangler d1 execute recovery_analytics --file=./migrations/0001_initial_schema.sql --env=development

# Apply migrations to staging
wrangler d1 execute recovery_analytics --file=./migrations/0001_initial_schema.sql --env=staging

# Apply migrations to production
wrangler d1 execute recovery_analytics --file=./migrations/0001_initial_schema.sql --env=production
```

## Security Considerations

### Authentication & Authorization

**API Key Management:**
- Generate unique API keys for each consumer (dashboard, Chatwoot sidebar)
- Store keys in Cloudflare Secrets Manager
- Rotate keys quarterly
- Log all authentication failures for security monitoring

**Webhook Signature Validation:**
- Use HMAC-SHA256 for webhook signatures
- Include timestamp in signature to prevent replay attacks
- Reject webhooks with signatures older than 5 minutes
- Use constant-time comparison to prevent timing attacks

### Data Protection

**Encryption:**
- All data in transit encrypted via HTTPS (enforced by Cloudflare)
- D1 data encrypted at rest by default
- KV data encrypted at rest by default

**Data Minimization:**
- Store only customer_id, not PII (names, emails, phone numbers)
- Transaction metadata only (amounts, dates, statuses)
- No credit card information stored (handled by Asaas)

**Access Control:**
- Separate API keys for different environments
- Rate limiting per API key to prevent abuse
- IP allowlisting for webhook endpoints (optional)

### Compliance

**LGPD (Brazilian Data Protection Law):**
- Customer data stored only for analytics purposes
- Data retention policy: 24 months maximum
- Right to deletion: Implement customer data deletion endpoint
- Data processing agreement with Asaas and ZuckZapGo

**Audit Logging:**
- Log all authentication failures
- Log all data access requests
- Log all data modifications
- Retain logs for 12 months

## Monitoring and Observability

### Metrics to Track

**Application Metrics:**
- Webhook ingestion rate (events/minute)
- API request latency (p50, p95, p99)
- Cache hit rate (percentage)
- Database query duration
- Error rate by endpoint

**Business Metrics:**
- Overall recovery rate by branch
- Average DSO
- Engagement rate (read/delivered ratio)
- Payment method distribution

### Logging Strategy

**Structured Logging:**
```typescript
interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context: {
    request_id: string
    customer_id?: string
    endpoint?: string
    duration_ms?: number
    error?: string
  }
}
```

**Log Destinations:**
- Cloudflare Workers Logs (real-time)
- External log aggregation (Datadog, Logflare, or similar)
- Dead-letter queue events logged separately

### Alerting

**Critical Alerts:**
- Error rate > 5% for 5 minutes
- API latency p95 > 1000ms for 5 minutes
- Database connection failures
- Dead-letter queue size > 100 events

**Warning Alerts:**
- Cache hit rate < 70%
- Webhook processing time > 500ms
- Rate limit hits > 10/minute

## Performance Optimization

### Database Optimization

**Index Strategy:**
- Composite indexes for common query patterns
- Covering indexes for frequently accessed columns
- Regular ANALYZE to update query planner statistics

**Query Optimization:**
- Use prepared statements to reduce parsing overhead
- Limit result sets with pagination
- Use aggregate functions in SQL rather than application code
- Avoid N+1 queries with JOINs

### Caching Strategy

**Cache Invalidation:**
- Invalidate on write operations
- Use cache tags for bulk invalidation
- Implement stale-while-revalidate pattern for better UX

**Cache Warming:**
- Pre-populate cache for common queries on deployment
- Background job to refresh popular metrics every 4 minutes

### Frontend Optimization

**Code Splitting:**
- Lazy load dashboard components
- Separate bundle for Chatwoot sidebar
- Dynamic imports for chart libraries

**Data Fetching:**
- Use React Query for automatic caching and refetching
- Implement optimistic updates for mutations
- Prefetch data on hover for better perceived performance

**Asset Optimization:**
- Compress images with WebP format
- Minify and bundle JavaScript/CSS
- Use Cloudflare CDN for static assets

## Future Enhancements

### Phase 2 Features

1. **Predictive Analytics:**
   - ML model to predict recovery likelihood
   - Optimal communication timing recommendations
   - Customer churn risk scoring

2. **Advanced Segmentation:**
   - Custom cohort definitions
   - Multi-dimensional analysis (plan + branch + method)
   - A/B testing framework for recovery strategies

3. **Real-time Notifications:**
   - WebSocket support for live dashboard updates
   - Push notifications for critical recovery events
   - Slack/Discord integration for team alerts

4. **Enhanced Chatwoot Integration:**
   - Inline payment processing
   - Automated response suggestions
   - Customer sentiment analysis

### Scalability Considerations

**Current Limits:**
- D1: 100,000 rows/day write limit (sufficient for ~4,000 events/hour)
- KV: 1,000 writes/second (sufficient for current load)
- Workers: 100,000 requests/day on free tier

**Scaling Strategy:**
- Upgrade to Workers Paid plan for unlimited requests
- Implement write batching for high-volume periods
- Consider D1 read replicas for analytics queries
- Horizontal scaling via multiple Worker instances (automatic)

## Conclusion

This design provides a comprehensive, edge-first architecture for subscription recovery analytics using Cloudflare's serverless platform. The system leverages Hono.js for efficient API routing, D1 for relational data storage, and KV for high-performance caching. Property-based testing ensures correctness across all critical paths, while the CI/CD pipeline enables rapid, safe deployments. The architecture is designed for low latency, high availability, and seamless integration with existing n8n workflows and Brazilian payment systems.
