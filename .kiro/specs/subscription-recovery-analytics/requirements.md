# Requirements Document

## Introduction

The Subscription Recovery Analytics system is a real-time analytics layer that integrates with an existing n8n-driven billing system to track subscription recovery efficiency across multiple communication branches (3-day notice, due today, overdue). The system monitors WhatsApp engagement through ZuckZapGo, provides actionable insights through a dashboard, and offers contextual billing information to support agents via a Chatwoot sidebar integration.

## Glossary

- **System**: The Subscription Recovery Analytics platform
- **Recovery_Branch**: A communication stage in the dunning process (3-day notice, due today, overdue)
- **Payment_Event**: A transaction record from Asaas payment gateway processed through n8n
- **Engagement_Event**: A WhatsApp message status update (read, delivered) from ZuckZapGo
- **Recovery_Log**: A database record tracking payment attempts and their outcomes
- **Dashboard**: The web-based analytics interface for finance team
- **Sidebar_App**: The Chatwoot integration displaying customer billing context
- **DSO**: Days Sales Outstanding metric
- **Cohort**: A group of customers grouped by subscription start date or billing cycle
- **n8n_Workflow**: The existing automation platform orchestrating billing operations
- **ZuckZapGo**: The WhatsApp gateway service
- **Chatwoot**: The customer support platform
- **Worker**: Cloudflare Workers serverless function
- **D1_Database**: Cloudflare's SQL database service
- **KV_Store**: Cloudflare's key-value cache storage
- **API**: The REST API exposing recovery metrics
- **Pix**: Brazilian instant payment method
- **Boleto**: Brazilian bank slip payment method

## Requirements

### Requirement 1: Event Logging from Payment Processing

**User Story:** As a finance analyst, I want all payment processing events to be logged with recovery branch context, so that I can track which communication stage led to successful recoveries.

#### Acceptance Criteria

1. WHEN n8n processes a payment event from Asaas, THE System SHALL receive the event via HTTP webhook
2. WHEN a payment event is received, THE System SHALL extract customer_id, amount, payment_method, status, and timestamp
3. WHEN logging a payment event, THE System SHALL associate it with the current Recovery_Branch (3-day notice, due today, or overdue)
4. WHEN a payment event is successfully logged, THE System SHALL store it in D1_Database with a unique event_id
5. WHEN a duplicate event_id is received, THE System SHALL reject the duplicate and return an error response

### Requirement 2: WhatsApp Engagement Tracking

**User Story:** As a finance analyst, I want to track WhatsApp message engagement, so that I can correlate message delivery and read rates with payment recovery success.

#### Acceptance Criteria

1. WHEN ZuckZapGo emits a message_delivered status, THE System SHALL receive the webhook and update the corresponding Recovery_Log
2. WHEN ZuckZapGo emits a message_read status, THE System SHALL receive the webhook and update the corresponding Recovery_Log
3. WHEN an engagement event is received, THE System SHALL extract message_id, customer_id, status, and timestamp
4. WHEN updating a Recovery_Log with engagement data, THE System SHALL preserve the original payment event data
5. IF no matching Recovery_Log exists for a message_id, THEN THE System SHALL log a warning and store the orphaned engagement event

### Requirement 3: Recovery Metrics API

**User Story:** As a dashboard developer, I want a REST API that provides recovery metrics with flexible filtering, so that I can build interactive analytics visualizations.

#### Acceptance Criteria

1. THE API SHALL expose an endpoint that returns recovery rates grouped by Recovery_Branch
2. WHEN querying recovery metrics, THE API SHALL support filtering by date_range, subscription_plan, and Recovery_Branch
3. WHEN calculating recovery rates, THE API SHALL compute the percentage of successful payments per total attempts for each branch
4. WHEN querying DSO metrics, THE API SHALL calculate the average days between invoice creation and payment
5. WHEN API responses exceed 100 records, THE API SHALL implement pagination with configurable page_size
6. WHEN API requests include invalid parameters, THE API SHALL return descriptive error messages with HTTP 400 status

### Requirement 4: Cohort Analysis

**User Story:** As a finance analyst, I want to view cohort-based recovery analysis, so that I can identify trends in customer payment behavior over time.

#### Acceptance Criteria

1. WHEN requesting cohort analysis, THE API SHALL group customers by their subscription start month
2. WHEN displaying cohort data, THE System SHALL show recovery rates for each cohort across multiple billing cycles
3. WHEN calculating cohort metrics, THE System SHALL include total customers, recovered customers, and recovery percentage
4. WHEN a cohort has fewer than 10 customers, THE System SHALL flag it as statistically insignificant

### Requirement 5: Chatwoot Sidebar Integration

**User Story:** As a support agent, I want to see customer billing history and payment options in Chatwoot, so that I can quickly assist customers with payment issues.

#### Acceptance Criteria

1. WHEN a support agent opens a customer conversation in Chatwoot, THE Sidebar_App SHALL fetch the customer's billing history
2. WHEN displaying billing history, THE Sidebar_App SHALL show outstanding invoices with amounts, due dates, and current status
3. WHEN an invoice has an active Pix code, THE Sidebar_App SHALL display a "Copy Pix Code" button
4. WHEN an invoice has a Boleto URL, THE Sidebar_App SHALL display a "Resend Boleto" button
5. WHEN an agent clicks "Resend Boleto", THE System SHALL trigger n8n_Workflow to regenerate and send the Boleto via WhatsApp

### Requirement 6: Dashboard Performance

**User Story:** As a finance analyst, I want the dashboard to load quickly, so that I can make timely decisions without waiting for data.

#### Acceptance Criteria

1. WHEN a user loads the Dashboard, THE System SHALL render initial charts within 2 seconds
2. WHEN querying aggregated metrics, THE System SHALL use KV_Store for frequently accessed data
3. WHEN KV_Store cache is older than 5 minutes, THE System SHALL refresh it from D1_Database
4. WHEN the Dashboard requests data for the current day, THE System SHALL bypass cache and query D1_Database directly

### Requirement 7: Security and Compliance

**User Story:** As a compliance officer, I want the system to protect customer data according to LGPD regulations, so that we avoid legal penalties and maintain customer trust.

#### Acceptance Criteria

1. THE System SHALL store all API tokens and webhook secrets in Cloudflare Secrets Manager
2. WHEN receiving webhook requests, THE System SHALL validate HMAC signatures or bearer tokens
3. WHEN logging customer data, THE System SHALL NOT store sensitive personal information beyond customer_id and transaction metadata
4. WHEN an API request lacks valid authentication, THE System SHALL return HTTP 401 and log the attempt
5. THE System SHALL implement rate limiting of 100 requests per minute per API key

### Requirement 8: Data Persistence and Reliability

**User Story:** As a system administrator, I want event data to be reliably stored and recoverable, so that we don't lose critical billing analytics.

#### Acceptance Criteria

1. WHEN a webhook is received, THE System SHALL acknowledge receipt with HTTP 202 before processing
2. WHEN database writes fail, THE System SHALL retry up to 3 times with exponential backoff
3. IF all retry attempts fail, THEN THE System SHALL log the event to a dead-letter queue for manual review
4. WHEN querying historical data, THE System SHALL support date ranges up to 24 months in the past
5. THE System SHALL maintain database indexes on customer_id, timestamp, and Recovery_Branch for query performance

### Requirement 9: Deployment and CI/CD

**User Story:** As a DevOps engineer, I want automated deployment pipelines, so that code changes can be safely deployed to production.

#### Acceptance Criteria

1. WHEN code is pushed to the main branch, THE System SHALL trigger GitHub Actions to run tests
2. WHEN all tests pass, THE System SHALL deploy the Worker to Cloudflare using Wrangler CLI
3. WHEN deploying the frontend, THE System SHALL build the React application and deploy to Cloudflare Pages
4. WHEN deployment fails, THE System SHALL send notifications to the DevOps team
5. THE System SHALL maintain separate environments for development, staging, and production

### Requirement 10: Recovery Branch Classification

**User Story:** As a finance analyst, I want payment events to be automatically classified into recovery branches, so that I can analyze the effectiveness of each communication stage.

#### Acceptance Criteria

1. WHEN an invoice is 3 days before due date, THE System SHALL classify communications as "3-day notice" branch
2. WHEN an invoice is due today, THE System SHALL classify communications as "due today" branch
3. WHEN an invoice is past due date, THE System SHALL classify communications as "overdue" branch
4. WHEN n8n sends a payment event, THE System SHALL accept an explicit branch parameter
5. IF no branch parameter is provided, THEN THE System SHALL infer the branch from invoice due_date and current timestamp
