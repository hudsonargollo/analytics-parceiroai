# Project Structure

This document provides an overview of the Subscription Recovery Analytics project structure.

## Directory Layout

```
subscription-recovery-analytics/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions CI/CD pipeline
├── .kiro/
│   └── specs/
│       └── subscription-recovery-analytics/
│           ├── requirements.md     # Project requirements
│           ├── design.md          # System design document
│           └── tasks.md           # Implementation tasks
├── packages/
│   ├── worker/                    # Cloudflare Worker backend
│   │   ├── migrations/
│   │   │   └── 0001_initial_schema.sql  # Database schema
│   │   ├── src/
│   │   │   ├── index.ts          # Worker entry point
│   │   │   └── types.ts          # TypeScript type definitions
│   │   ├── tests/
│   │   │   └── index.test.ts     # Basic tests
│   │   ├── package.json          # Worker dependencies
│   │   ├── tsconfig.json         # TypeScript config
│   │   ├── vitest.config.ts      # Vitest config
│   │   └── wrangler.toml         # Cloudflare Worker config
│   └── frontend/                  # React dashboard
│       ├── src/
│       │   ├── lib/
│       │   │   ├── api.ts        # API client
│       │   │   └── utils.ts      # Utility functions
│       │   ├── test/
│       │   │   └── setup.ts      # Test setup
│       │   ├── App.tsx           # Main App component
│       │   ├── App.test.tsx      # App tests
│       │   ├── main.tsx          # React entry point
│       │   └── index.css         # Global styles
│       ├── .env                   # Environment variables (local)
│       ├── .env.example          # Environment variables template
│       ├── .eslintrc.cjs         # ESLint configuration
│       ├── index.html            # HTML template
│       ├── package.json          # Frontend dependencies
│       ├── postcss.config.js     # PostCSS config
│       ├── tailwind.config.js    # Tailwind CSS config
│       ├── tsconfig.json         # TypeScript config
│       ├── tsconfig.node.json    # TypeScript config for Node
│       ├── vite.config.ts        # Vite config
│       └── vitest.config.ts      # Vitest config
├── .gitignore                     # Git ignore rules
├── package.json                   # Root package.json (monorepo)
├── README.md                      # Project overview
├── SETUP.md                       # Setup instructions
└── PROJECT_STRUCTURE.md           # This file
```

## Package Overview

### Root Package

The root `package.json` defines the monorepo workspace structure and provides convenience scripts for running commands across all packages.

**Key Scripts:**
- `npm run dev:worker` - Start worker in development mode
- `npm run dev:frontend` - Start frontend in development mode
- `npm test` - Run all tests
- `npm run test:unit` - Run unit tests only
- `npm run test:property` - Run property-based tests only

### Worker Package (`packages/worker`)

The backend service built on Cloudflare Workers using Hono.js framework.

**Key Technologies:**
- **Hono.js**: Lightweight web framework for routing and middleware
- **Cloudflare D1**: SQLite database for data persistence
- **Cloudflare KV**: Key-value store for caching
- **Vitest**: Testing framework
- **fast-check**: Property-based testing library

**Key Files:**
- `src/index.ts`: Main worker entry point with Hono app setup
- `src/types.ts`: TypeScript interfaces for payloads, responses, and models
- `wrangler.toml`: Cloudflare Worker configuration with D1 and KV bindings
- `migrations/0001_initial_schema.sql`: Database schema with all tables and indexes

**Environment Bindings:**
- `DB`: D1 database binding
- `KV`: KV namespace binding
- `WEBHOOK_SECRET`: HMAC secret for n8n webhooks
- `ZUCKZAPGO_SECRET`: HMAC secret for ZuckZapGo webhooks
- `VALID_API_KEYS`: Comma-separated API keys
- `CHATWOOT_TOKEN`: Chatwoot authentication token

### Frontend Package (`packages/frontend`)

The React-based dashboard for visualizing analytics data.

**Key Technologies:**
- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library
- **TanStack Query**: Data fetching and caching
- **Recharts**: Charting library
- **Framer Motion**: Animation library

**Key Files:**
- `src/main.tsx`: React application entry point
- `src/App.tsx`: Main application component with React Query setup
- `src/lib/api.ts`: API client for backend communication
- `src/lib/utils.ts`: Utility functions (cn helper for Tailwind)
- `vite.config.ts`: Vite configuration with path aliases
- `tailwind.config.js`: Tailwind CSS theme configuration

**Environment Variables:**
- `VITE_API_URL`: Backend API URL (default: http://localhost:8787)
- `VITE_API_KEY`: API key for authentication

## Database Schema

The D1 database includes four main tables:

1. **payment_events**: Stores payment transaction records
2. **engagement_events**: Stores WhatsApp message engagement data
3. **recovery_logs**: Links payment and engagement events for analysis
4. **customer_cohorts**: Groups customers by subscription start date

All tables include appropriate indexes for query performance.

## Testing Strategy

### Unit Tests
- Test individual functions and components in isolation
- Located alongside source files with `.test.ts` or `.test.tsx` extension
- Run with: `npm run test:unit`

### Property-Based Tests
- Validate universal correctness properties using fast-check
- Run a minimum of 100 iterations per test
- Run with: `npm run test:property`

### Integration Tests
- Test complete request/response cycles
- Located in `tests/integration` directories
- Run with: `npm run test:integration`

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/deploy.yml`) handles:

1. **Test Job**: Runs all tests on push and pull requests
2. **Deploy Worker Job**: Deploys worker to Cloudflare Workers
3. **Deploy Frontend Job**: Builds and deploys frontend to Cloudflare Pages

Deployments are environment-aware:
- `main` branch → production
- `staging` branch → staging
- `development` branch → development

## Development Workflow

### Local Development

1. **Start Worker**:
   ```bash
   npm run dev:worker
   ```
   Available at: http://localhost:8787

2. **Start Frontend**:
   ```bash
   npm run dev:frontend
   ```
   Available at: http://localhost:5173

3. **Run Tests**:
   ```bash
   npm test
   ```

### Making Changes

1. Create a feature branch
2. Make changes in appropriate package
3. Write tests (unit and property-based)
4. Run tests locally
5. Commit and push
6. Create pull request
7. CI runs tests automatically
8. Merge to deploy

## Configuration Files

### TypeScript Configuration

- **Worker**: Targets ES2022, uses Cloudflare Workers types
- **Frontend**: Targets ES2020, includes DOM types, uses path aliases

### Testing Configuration

- **Vitest**: Configured for both packages with different environments
  - Worker: Uses `@cloudflare/vitest-pool-workers` for Worker environment
  - Frontend: Uses `jsdom` for browser environment

### Build Configuration

- **Worker**: TypeScript compilation, deployed via Wrangler
- **Frontend**: Vite build with optimizations, deployed to Cloudflare Pages

## Next Steps

After completing the initial setup (see SETUP.md), follow the implementation tasks in `.kiro/specs/subscription-recovery-analytics/tasks.md` to build out the features:

1. Database schema and migrations ✅ (Complete)
2. Recovery branch classification logic
3. Webhook signature validation
4. Payment event ingestion
5. Engagement event ingestion
6. Analytics API endpoints
7. Chatwoot sidebar integration
8. React dashboard components

Each task includes specific requirements, acceptance criteria, and property-based tests to ensure correctness.
