# Implementation Plan: Subscription Recovery Analytics

## Overview

This implementation plan breaks down the Subscription Recovery Analytics system into discrete, incremental coding tasks. Each task builds on previous work, with property-based tests integrated throughout to validate correctness early. The plan follows a bottom-up approach: database schema → core business logic → API endpoints → frontend components → integrations.

## Tasks

- [x] 1. Set up project structure and development environment
  - Create monorepo structure with separate packages for worker and frontend
  - Initialize TypeScript configuration for both packages
  - Set up Wrangler configuration with D1 and KV bindings
  - Configure Vitest for unit and property-based testing
  - Install dependencies: Hono, fast-check, React, Tailwind CSS, shadcn/ui
  - Create wrangler.toml with environment configurations
  - _Requirements: 9.5_

- [x] 2. Implement database schema and migrations
  - [x] 2.1 Create D1 migration files for all tables
    - Write SQL for payment_events table with indexes
    - Write SQL for engagement_events table with indexes
    - Write SQL for recovery_logs table with foreign keys
    - Write SQL for customer_cohorts table with indexes
    - _Requirements: 8.5_
  
  - [ ]* 2.2 Verify database schema with example query
    - Test that all tables are created successfully
    - Verify all indexes exist using PRAGMA index_list
    - _Requirements: 8.5_

- [x] 3. Implement recovery branch classification logic
  - [x] 3.1 Create classifyRecoveryBranch function
    - Implement date comparison logic for 3-day notice, due today, and overdue
    - Handle edge cases (timezone considerations, exact day boundaries)
    - _Requirements: 1.3, 10.1, 10.2, 10.3, 10.5_
  
  - [ ]* 3.2 Write property test for branch classification
    - **Property 3: Recovery Branch Classification**
    - **Validates: Requirements 1.3, 10.1, 10.2, 10.3**
    - Generate random due dates and verify correct branch assignment
    - Test all three branches with various date offsets
  
  - [x] 3.3 Add explicit branch parameter override
    - Modify function to accept optional explicit branch parameter
    - Return explicit branch if provided, otherwise calculate
    - _Requirements: 10.4_
  
  - [ ]* 3.4 Write property test for explicit branch override
    - **Property 30: Explicit Branch Parameter Override**
    - **Validates: Requirements 10.4**
    - Generate random events with explicit branches and verify they're used

- [x] 4. Implement webhook signature validation middleware
  - [x] 4.1 Create HMAC signature validation function
    - Implement SHA-256 HMAC computation
    - Compare signatures using constant-time comparison
    - Handle missing or malformed signatures
    - _Requirements: 7.2_
  
  - [x] 4.2 Create Hono middleware for webhook validation
    - Extract signature from X-Webhook-Signature header
    - Validate signature and reject invalid requests with 401
    - Log authentication failures
    - _Requirements: 7.2, 7.4_
  
  - [ ]* 4.3 Write property test for HMAC validation
    - **Property 22: HMAC Signature Validation**
    - **Validates: Requirements 7.2**
    - Generate random payloads with valid and invalid signatures
    - Verify only valid signatures are accepted

- [x] 5. Implement payment event ingestion
  - [x] 5.1 Create payment webhook endpoint
    - Define POST /webhooks/payment route with Hono
    - Parse PaymentWebhookPayload from request body
    - Extract all required fields (customer_id, amount, payment_method, status, timestamp)
    - Return HTTP 202 immediately
    - _Requirements: 1.1, 1.2, 8.1_
  
  - [x] 5.2 Implement payment event database insertion
    - Create insertPaymentEvent function
    - Generate unique event_id if not provided
    - Classify recovery branch using classifyRecoveryBranch
    - Insert into payment_events table with timestamps
    - Handle duplicate event_id with UNIQUE constraint
    - _Requirements: 1.3, 1.4, 1.5_
  
  - [ ]* 5.3 Write property test for field extraction
    - **Property 2: Payment Event Field Extraction**
    - **Validates: Requirements 1.2**
    - Generate random payment payloads and verify all fields are extracted
  
  - [ ]* 5.4 Write property test for event persistence
    - **Property 4: Event Persistence Round Trip**
    - **Validates: Requirements 1.4**
    - Generate random events, store them, query back, verify equivalence
  
  - [ ]* 5.5 Write property test for duplicate rejection
    - **Property 5: Duplicate Event Rejection (Idempotency)**
    - **Validates: Requirements 1.5**
    - Generate random event, insert twice, verify second fails with conflict

- [x] 6. Implement engagement event ingestion
  - [x] 6.1 Create engagement webhook endpoint
    - Define POST /webhooks/engagement route with Hono
    - Parse EngagementWebhookPayload from request body
    - Extract message_id, customer_id, status, timestamp
    - Return HTTP 202 immediately
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 6.2 Implement engagement event database update
    - Create updateEngagementStatus function
    - Look up recovery_log by message_id
    - Update engagement timestamps (delivered_at, read_at) based on status
    - Preserve existing payment event data
    - Handle orphaned events (no matching recovery_log)
    - _Requirements: 2.4, 2.5_
  
  - [ ]* 6.3 Write property test for engagement field extraction
    - **Property 7: Engagement Event Field Extraction**
    - **Validates: Requirements 2.3**
    - Generate random engagement payloads and verify field extraction
  
  - [ ]* 6.4 Write property test for engagement updates
    - **Property 6: Engagement Status Updates**
    - **Validates: Requirements 2.1, 2.2, 2.4**
    - Generate random engagement events, verify recovery log updates preserve payment data
  
  - [ ]* 6.5 Write property test for orphaned events
    - **Property 8: Orphaned Engagement Event Handling**
    - **Validates: Requirements 2.5**
    - Generate engagement events with no matching recovery log, verify storage

- [x] 7. Checkpoint - Ensure webhook ingestion works end-to-end
  - Test payment webhook with curl or Postman
  - Test engagement webhook with curl or Postman
  - Verify data appears in D1 database
  - Ensure all tests pass, ask the user if questions arise

- [x] 8. Implement authentication and rate limiting middleware
  - [x] 8.1 Create API key authentication middleware
    - Extract X-API-Key header from requests
    - Validate against VALID_API_KEYS secret
    - Return 401 for invalid or missing keys
    - Log authentication failures
    - _Requirements: 7.4_
  
  - [x] 8.2 Create rate limiting middleware
    - Implement per-API-key rate limiting using KV
    - Track request count per minute window
    - Return 429 after 100 requests per minute
    - Include Retry-After header
    - _Requirements: 7.5_
  
  - [ ]* 8.3 Write property test for authentication failures
    - **Property 24: Authentication Failure Response**
    - **Validates: Requirements 7.4**
    - Generate requests with invalid/missing API keys, verify 401 responses
  
  - [ ]* 8.4 Write property test for rate limiting
    - **Property 25: Rate Limiting Enforcement**
    - **Validates: Requirements 7.5**
    - Simulate 101 requests in 60 seconds, verify 101st returns 429

- [x] 9. Implement recovery rate calculation
  - [x] 9.1 Create calculateRecoveryRate function
    - Write SQL query to aggregate payment events by branch
    - Calculate total attempts, successful recoveries, and percentage
    - Support filtering by date_range, subscription_plan, recovery_branch
    - Return RecoveryRateResponse with breakdown by payment method
    - _Requirements: 3.2, 3.3_
  
  - [ ]* 9.2 Write property test for recovery rate accuracy
    - **Property 9: Recovery Rate Calculation Accuracy**
    - **Validates: Requirements 3.3**
    - Generate random payment events with known outcomes, verify calculated percentage
  
  - [ ]* 9.3 Write property test for query filters
    - **Property 11: Query Filter Application**
    - **Validates: Requirements 3.2**
    - Generate random filter combinations, verify only matching records returned

- [x] 10. Implement DSO calculation
  - [x] 10.1 Create calculateDSO function
    - Write SQL query to calculate average days between invoice and payment
    - Group by recovery_branch
    - Support date_range filtering
    - Return DSOResponse with average and median DSO
    - _Requirements: 3.4_
  
  - [ ]* 10.2 Write property test for DSO accuracy
    - **Property 10: DSO Calculation Accuracy**
    - **Validates: Requirements 3.4**
    - Generate recovery logs with known date differences, verify average calculation

- [x] 11. Implement cohort analysis
  - [x] 11.1 Create calculateCohortAnalysis function
    - Write SQL query to group customers by subscription start month
    - Calculate recovery rates for each cohort across billing cycles
    - Include total_customers, recovered_customers, recovery_rate
    - Flag cohorts with < 10 customers as statistically insignificant
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 11.2 Write property test for cohort grouping
    - **Property 14: Cohort Grouping by Month**
    - **Validates: Requirements 4.1**
    - Generate customers with random start dates, verify grouping by month
  
  - [ ]* 11.3 Write property test for cohort metric completeness
    - **Property 15: Cohort Metric Completeness**
    - **Validates: Requirements 4.3**
    - Generate cohort data, verify all required fields present
  
  - [ ]* 11.4 Write property test for statistical significance flagging
    - **Property 16: Statistical Significance Flagging**
    - **Validates: Requirements 4.4**
    - Generate cohorts with varying sizes, verify < 10 flagged as insignificant

- [x] 12. Implement caching layer with KV
  - [x] 12.1 Create cache wrapper functions
    - Implement getCachedMetrics function with KV.get
    - Implement setCachedMetrics function with KV.put and TTL
    - Generate cache keys from query parameters
    - Implement cache invalidation on write operations
    - _Requirements: 6.2, 6.3_
  
  - [x] 12.2 Add cache bypass for current day queries
    - Detect "today" or "current" in date_range parameter
    - Skip KV lookup and query D1 directly
    - _Requirements: 6.4_
  
  - [ ]* 12.3 Write property test for cache hits
    - **Property 20: Cache Hit for Repeated Queries**
    - **Validates: Requirements 6.2, 6.3**
    - Execute same query twice within 5 minutes, verify second is from cache
  
  - [ ]* 12.4 Write property test for current day bypass
    - **Property 21: Current Day Cache Bypass**
    - **Validates: Requirements 6.4**
    - Query current day data, verify always queries D1 directly

- [x] 13. Implement analytics API endpoints
  - [x] 13.1 Create GET /api/metrics/recovery-rate endpoint
    - Apply authentication and rate limiting middleware
    - Parse query parameters (branch, date_range, plan)
    - Check KV cache first
    - Call calculateRecoveryRate if cache miss
    - Store result in KV with 5-minute TTL
    - Return JSON response
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 13.2 Create GET /api/metrics/dso endpoint
    - Apply authentication and rate limiting middleware
    - Parse date_range query parameter
    - Check KV cache first
    - Call calculateDSO if cache miss
    - Store result in KV with 5-minute TTL
    - Return JSON response
    - _Requirements: 3.4_
  
  - [x] 13.3 Create GET /api/metrics/cohorts endpoint
    - Apply authentication and rate limiting middleware
    - Parse start_month and end_month query parameters
    - Check KV cache first
    - Call calculateCohortAnalysis if cache miss
    - Store result in KV with 5-minute TTL
    - Return JSON response
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 13.4 Implement pagination for large result sets
    - Add page and page_size query parameters
    - Limit results to 100 per page by default
    - Include pagination metadata in response (total, page, page_size)
    - _Requirements: 3.5_
  
  - [x] 13.5 Implement error handling for invalid parameters
    - Validate query parameters (date formats, numeric ranges)
    - Return HTTP 400 with descriptive error messages
    - _Requirements: 3.6_
  
  - [ ]* 13.6 Write property test for pagination consistency
    - **Property 12: Pagination Consistency**
    - **Validates: Requirements 3.5**
    - Generate > 100 records, fetch all pages, verify completeness
  
  - [ ]* 13.7 Write property test for invalid parameter errors
    - **Property 13: Invalid Parameter Error Responses**
    - **Validates: Requirements 3.6**
    - Generate invalid parameters, verify 400 responses with error messages

- [x] 14. Checkpoint - Ensure analytics API works end-to-end
  - Test all API endpoints with curl or Postman
  - Verify caching behavior with repeated requests
  - Verify pagination with large datasets
  - Ensure all tests pass, ask the user if questions arise

- [~] 15. Implement Chatwoot sidebar API
  - [~] 15.1 Create GET /api/chatwoot/customer/:customer_id/billing endpoint
    - Apply Chatwoot token authentication
    - Query D1 for customer's outstanding invoices
    - Include invoice_id, amount, due_date, status, payment_method
    - Include pix_code if payment method is Pix
    - Include boleto_url if payment method is Boleto
    - Calculate days_overdue for overdue invoices
    - Return CustomerBillingResponse
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [~] 15.2 Create POST /api/chatwoot/customer/:customer_id/resend-boleto endpoint
    - Apply Chatwoot token authentication
    - Parse invoice_id from request body
    - Trigger n8n webhook with action, customer_id, invoice_id
    - Return success status
    - _Requirements: 5.5_
  
  - [ ]* 15.3 Write property test for billing history completeness
    - **Property 17: Billing History Completeness**
    - **Validates: Requirements 5.2**
    - Generate random customer invoices, verify all required fields present
  
  - [ ]* 15.4 Write property test for conditional payment buttons
    - **Property 18: Conditional Payment Action Buttons**
    - **Validates: Requirements 5.3, 5.4**
    - Generate invoices with different payment methods, verify correct fields present
  
  - [ ]* 15.5 Write property test for Boleto resend trigger
    - **Property 19: Boleto Resend Trigger**
    - **Validates: Requirements 5.5**
    - Simulate button click, verify n8n webhook called with correct payload

- [~] 16. Implement error handling and retry logic
  - [~] 16.1 Create retry wrapper with exponential backoff
    - Implement processWithRetry function
    - Retry failed operations up to 3 times
    - Use exponential backoff (1s, 2s, 4s)
    - _Requirements: 8.2_
  
  - [~] 16.2 Implement dead-letter queue for persistent failures
    - Write failed events to KV with dlq: prefix
    - Include error message, attempt count, timestamp
    - Set TTL to 7 days
    - _Requirements: 8.3_
  
  - [~] 16.3 Add immediate webhook acknowledgment
    - Return HTTP 202 within 100ms of receiving webhook
    - Process event asynchronously after acknowledgment
    - _Requirements: 8.1_
  
  - [ ]* 16.4 Write property test for immediate acknowledgment
    - **Property 26: Immediate Webhook Acknowledgment**
    - **Validates: Requirements 8.1**
    - Send webhook, verify 202 returned within 100ms
  
  - [ ]* 16.5 Write property test for retry logic
    - **Property 27: Retry with Exponential Backoff**
    - **Validates: Requirements 8.2**
    - Simulate database failures, verify 3 retries with correct delays
  
  - [ ]* 16.6 Write property test for dead-letter queue
    - **Property 28: Dead Letter Queue on Persistent Failure**
    - **Validates: Requirements 8.3**
    - Simulate persistent failures, verify events written to DLQ

- [~] 17. Implement data privacy and security measures
  - [~] 17.1 Add data validation to prevent PII storage
    - Create validation function to check for sensitive fields
    - Reject or strip fields like name, email, phone, address
    - Log warnings if PII detected
    - _Requirements: 7.3_
  
  - [~] 17.2 Implement historical data query support
    - Ensure queries support date ranges up to 24 months
    - Test with old data to verify no errors
    - _Requirements: 8.4_
  
  - [ ]* 17.3 Write property test for data privacy compliance
    - **Property 23: Data Privacy Compliance**
    - **Validates: Requirements 7.3**
    - Generate random records, verify no PII fields stored
  
  - [ ]* 17.4 Write property test for historical data support
    - **Property 29: Historical Data Query Support**
    - **Validates: Requirements 8.4**
    - Query data from 24 months ago, verify successful results

- [~] 18. Build React dashboard frontend
  - [~] 18.1 Set up React project with Vite
    - Initialize Vite project with React and TypeScript
    - Configure Tailwind CSS
    - Install shadcn/ui components
    - Install Framer Motion for animations
    - Install React Query for data fetching
    - Install Recharts for data visualization
    - _Requirements: 6.1_
  
  - [~] 18.2 Create API client with React Query
    - Create useRecoveryMetrics hook
    - Create useCohortAnalysis hook
    - Create useDSOMetrics hook
    - Implement error handling and retry logic
    - Configure caching and refetching strategies
    - _Requirements: 3.1, 3.4, 4.1_
  
  - [~] 18.3 Build RecoveryRateChart component
    - Create bar chart with Recharts
    - Display recovery rates by branch
    - Add filter controls (date range, plan, branch)
    - Show loading skeleton during data fetch
    - Handle error states with toast notifications
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [~] 18.4 Build CohortAnalysisTable component
    - Create data table with shadcn/ui Table component
    - Display cohorts with recovery rates across billing cycles
    - Highlight statistically insignificant cohorts
    - Add sorting and filtering
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [~] 18.5 Build DSOMetrics component
    - Create metric cards with average and median DSO
    - Display DSO by branch with comparison
    - Add date range filter
    - Animate metric changes with Framer Motion
    - _Requirements: 3.4_
  
  - [~] 18.6 Build main Dashboard component
    - Compose all chart and metric components
    - Add responsive layout with Tailwind CSS
    - Implement global filter controls
    - Add refresh button and auto-refresh option
    - _Requirements: 6.1_

- [~] 19. Build Chatwoot sidebar integration
  - [~] 19.1 Create BillingSidebar component
    - Create React component for Chatwoot iframe
    - Use useCustomerBilling hook to fetch data
    - Display outstanding invoices with amounts and due dates
    - Show payment status badges
    - Calculate and display days overdue
    - _Requirements: 5.1, 5.2_
  
  - [~] 19.2 Add payment action buttons
    - Create "Copy Pix Code" button (conditional on pix_code presence)
    - Create "Resend Boleto" button (conditional on boleto_url presence)
    - Implement copy-to-clipboard functionality
    - Implement Boleto resend API call
    - Show success/error toast notifications
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [~] 19.3 Style sidebar for Chatwoot iframe context
    - Use compact layout for sidebar width
    - Ensure responsive design for mobile
    - Match Chatwoot's design language
    - Test in actual Chatwoot iframe

- [~] 20. Checkpoint - Ensure frontend works end-to-end
  - Test dashboard with real API data
  - Test all chart interactions and filters
  - Test Chatwoot sidebar in iframe context
  - Test responsive design on mobile devices
  - Ensure all tests pass, ask the user if questions arise

- [~] 21. Set up GitHub Actions CI/CD pipeline
  - [~] 21.1 Create test workflow
    - Configure GitHub Actions to run on push and PR
    - Set up Node.js environment
    - Install dependencies
    - Run unit tests
    - Run property-based tests
    - Run integration tests
    - _Requirements: 9.1_
  
  - [~] 21.2 Create Worker deployment workflow
    - Configure Wrangler deployment
    - Set up Cloudflare API token secret
    - Deploy to correct environment based on branch
    - Add failure notifications
    - _Requirements: 9.2, 9.4_
  
  - [~] 21.3 Create frontend deployment workflow
    - Build React application with Vite
    - Set environment-specific API URLs
    - Deploy to Cloudflare Pages
    - Add failure notifications
    - _Requirements: 9.3, 9.4_

- [~] 22. Final integration and testing
  - [~] 22.1 Deploy to staging environment
    - Apply database migrations to staging D1
    - Deploy Worker to staging
    - Deploy frontend to staging Pages
    - Configure staging secrets and environment variables
    - _Requirements: 9.5_
  
  - [~] 22.2 End-to-end testing in staging
    - Send test webhooks from n8n staging
    - Verify data flows through entire system
    - Test dashboard with real data
    - Test Chatwoot sidebar integration
    - Verify caching behavior
    - Test rate limiting and authentication
  
  - [~] 22.3 Performance testing
    - Run load tests with k6
    - Measure API latency (p95, p99)
    - Verify cache hit rates
    - Test with 1000+ concurrent webhook requests
    - Verify dashboard loads within 2 seconds
    - _Requirements: 6.1_
  
  - [ ]* 22.4 Final checkpoint - Production readiness review
    - Verify all tests pass
    - Review security configuration
    - Verify monitoring and alerting setup
    - Review deployment runbook
    - Ask the user if ready for production deployment

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation throughout development
- The implementation follows a bottom-up approach: database → business logic → API → frontend
- All code should be written in TypeScript for type safety
- Use fast-check library for property-based testing with minimum 100 iterations per test
