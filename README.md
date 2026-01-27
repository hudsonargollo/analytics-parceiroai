# Subscription Recovery Analytics

Real-time analytics layer for subscription recovery tracking, integrating with n8n-driven billing systems to monitor WhatsApp engagement and provide actionable insights.

## Project Structure

This is a monorepo containing two packages:

- **packages/worker**: Cloudflare Worker backend (Hono.js + D1 + KV)
- **packages/frontend**: React dashboard frontend (Vite + Tailwind CSS + shadcn/ui)

## Prerequisites

- Node.js 20+
- npm or yarn
- Cloudflare account (for deployment)
- Wrangler CLI

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

This will install dependencies for all packages in the monorepo.

### 2. Set Up Cloudflare Resources

#### Create D1 Database

```bash
cd packages/worker
npx wrangler d1 create recovery_analytics
```

Copy the `database_id` from the output and update it in `packages/worker/wrangler.toml`.

#### Create KV Namespace

```bash
npx wrangler kv:namespace create "CACHE"
```

Copy the `id` from the output and update it in `packages/worker/wrangler.toml`.

#### Apply Database Migrations

```bash
npx wrangler d1 execute recovery_analytics --file=./migrations/0001_initial_schema.sql --env=development
```

#### Set Secrets

```bash
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put ZUCKZAPGO_SECRET
npx wrangler secret put VALID_API_KEYS
npx wrangler secret put CHATWOOT_TOKEN
```

### 3. Development

#### Run Worker Locally

```bash
npm run dev:worker
```

The worker will be available at `http://localhost:8787`.

#### Run Frontend Locally

```bash
npm run dev:frontend
```

The frontend will be available at `http://localhost:5173`.

### 4. Testing

#### Run All Tests

```bash
npm test
```

#### Run Unit Tests Only

```bash
npm run test:unit
```

#### Run Property-Based Tests Only

```bash
npm run test:property
```

#### Run Integration Tests

```bash
npm run test:integration
```

### 5. Deployment

#### Deploy Worker

```bash
npm run deploy:worker
```

#### Deploy Frontend

```bash
npm run deploy:frontend
```

## Architecture

### Backend (Cloudflare Worker)

- **Framework**: Hono.js for routing and middleware
- **Database**: Cloudflare D1 (SQLite) for relational data
- **Cache**: Cloudflare KV for metrics caching
- **Testing**: Vitest + fast-check for property-based testing

### Frontend (React)

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Data Fetching**: TanStack Query (React Query)
- **Charts**: Recharts
- **Animations**: Framer Motion

## Environment Variables

### Worker

Set via `wrangler secret put`:

- `WEBHOOK_SECRET`: HMAC secret for n8n webhook validation
- `ZUCKZAPGO_SECRET`: HMAC secret for ZuckZapGo webhook validation
- `VALID_API_KEYS`: Comma-separated list of valid API keys
- `CHATWOOT_TOKEN`: Authentication token for Chatwoot integration

Set in `wrangler.toml`:

- `N8N_WEBHOOK_URL`: URL for n8n webhook callbacks
- `ENVIRONMENT`: Environment name (development/staging/production)

### Frontend

Set in `.env` files:

- `VITE_API_URL`: URL of the worker API

## API Endpoints

### Webhooks

- `POST /webhooks/payment` - Receive payment events from n8n
- `POST /webhooks/engagement` - Receive WhatsApp engagement events from ZuckZapGo

### Analytics API

- `GET /api/metrics/recovery-rate` - Get recovery rate metrics
- `GET /api/metrics/dso` - Get Days Sales Outstanding metrics
- `GET /api/metrics/cohorts` - Get cohort analysis

### Chatwoot Integration

- `GET /api/chatwoot/customer/:customer_id/billing` - Get customer billing history
- `POST /api/chatwoot/customer/:customer_id/resend-boleto` - Trigger Boleto resend

## Testing Strategy

This project uses a comprehensive testing approach:

1. **Unit Tests**: Test individual functions and components
2. **Property-Based Tests**: Validate universal correctness properties using fast-check
3. **Integration Tests**: Test complete request/response cycles

All property-based tests run a minimum of 100 iterations to ensure comprehensive coverage.

## CI/CD

GitHub Actions workflows are configured for:

- Running tests on push and pull requests
- Deploying worker to Cloudflare Workers
- Deploying frontend to Cloudflare Pages
- Environment-specific deployments (development/staging/production)

## License

MIT
