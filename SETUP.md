# Setup Guide

This guide will walk you through setting up the Subscription Recovery Analytics project from scratch.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+**: [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git**: [Download here](https://git-scm.com/)
- **Cloudflare Account**: [Sign up here](https://dash.cloudflare.com/sign-up)

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd subscription-recovery-analytics

# Install all dependencies
npm install
```

This will install dependencies for both the worker and frontend packages.

## Step 2: Configure Cloudflare Resources

### 2.1 Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2.2 Authenticate with Cloudflare

```bash
wrangler login
```

This will open a browser window for you to authenticate.

### 2.3 Create D1 Database

```bash
cd packages/worker
npx wrangler d1 create recovery_analytics
```

**Important**: Copy the `database_id` from the output. You'll need it in the next step.

Example output:
```
✅ Successfully created DB 'recovery_analytics'

[[d1_databases]]
binding = "DB"
database_name = "recovery_analytics"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2.4 Update wrangler.toml

Open `packages/worker/wrangler.toml` and replace `placeholder-database-id` with your actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "recovery_analytics"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Replace this
```

### 2.5 Create KV Namespace

```bash
npx wrangler kv:namespace create "CACHE"
```

**Important**: Copy the `id` from the output.

Example output:
```
✅ Successfully created KV namespace 'CACHE'

[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 2.6 Update wrangler.toml with KV ID

Open `packages/worker/wrangler.toml` and replace `placeholder-kv-id` with your actual KV namespace ID:

```toml
[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # Replace this
```

### 2.7 Apply Database Migrations

```bash
# Still in packages/worker directory
npx wrangler d1 execute recovery_analytics --file=./migrations/0001_initial_schema.sql --env=development
```

You should see output confirming the tables were created.

### 2.8 Set Up Secrets

Set the required secrets for the worker:

```bash
# HMAC secret for n8n webhook validation
npx wrangler secret put WEBHOOK_SECRET
# Enter a strong random string when prompted

# HMAC secret for ZuckZapGo webhook validation
npx wrangler secret put ZUCKZAPGO_SECRET
# Enter a strong random string when prompted

# Comma-separated list of valid API keys
npx wrangler secret put VALID_API_KEYS
# Enter something like: key1,key2,key3

# Authentication token for Chatwoot integration
npx wrangler secret put CHATWOOT_TOKEN
# Enter your Chatwoot token when prompted
```

**Tip**: Generate strong secrets using:
```bash
openssl rand -hex 32
```

## Step 3: Configure Environment Variables

### 3.1 Update N8N Webhook URL

Open `packages/worker/wrangler.toml` and update the `N8N_WEBHOOK_URL`:

```toml
[vars]
N8N_WEBHOOK_URL = "https://your-n8n-instance.com/webhook/boleto-resend"
```

Replace with your actual n8n webhook URL.

### 3.2 Frontend Environment Variables

Create a `.env` file in `packages/frontend`:

```bash
cd ../frontend
cat > .env << EOF
VITE_API_URL=http://localhost:8787
EOF
```

For production, you'll update this to your deployed worker URL.

## Step 4: Verify Setup

### 4.1 Test Worker Locally

```bash
cd packages/worker
npm run dev
```

You should see output like:
```
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

Open http://localhost:8787 in your browser. You should see a JSON response:
```json
{
  "status": "ok",
  "service": "subscription-recovery-analytics",
  "environment": "development",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Press `Ctrl+C` to stop the server.

### 4.2 Test Frontend Locally

```bash
cd ../frontend
npm run dev
```

You should see output like:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open http://localhost:5173 in your browser. You should see the dashboard with "Dashboard coming soon..." message.

Press `Ctrl+C` to stop the server.

### 4.3 Run Tests

From the root directory:

```bash
cd ../..
npm test
```

All tests should pass.

## Step 5: Deploy to Staging

### 5.1 Create Staging Environment Resources

```bash
cd packages/worker

# Create staging D1 database
npx wrangler d1 create recovery_analytics_staging

# Create staging KV namespace
npx wrangler kv:namespace create "CACHE" --env=staging
```

Update `wrangler.toml` with the staging IDs in the appropriate environment sections.

### 5.2 Apply Migrations to Staging

```bash
npx wrangler d1 execute recovery_analytics_staging --file=./migrations/0001_initial_schema.sql --env=staging
```

### 5.3 Set Staging Secrets

```bash
npx wrangler secret put WEBHOOK_SECRET --env=staging
npx wrangler secret put ZUCKZAPGO_SECRET --env=staging
npx wrangler secret put VALID_API_KEYS --env=staging
npx wrangler secret put CHATWOOT_TOKEN --env=staging
```

### 5.4 Deploy Worker to Staging

```bash
npm run deploy -- --env=staging
```

### 5.5 Deploy Frontend to Staging

```bash
cd ../frontend
npm run build
npx wrangler pages deploy dist --project-name=subscription-recovery-dashboard-staging
```

## Step 6: Set Up GitHub Actions (Optional)

If you want automated deployments via GitHub Actions:

### 6.1 Get Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Add permissions for D1, KV, and Pages
5. Copy the token

### 6.2 Add GitHub Secrets

In your GitHub repository:

1. Go to Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `CLOUDFLARE_API_TOKEN`: Your API token from step 6.1
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (found in dashboard)

### 6.3 Push to GitHub

```bash
git add .
git commit -m "Initial setup"
git push origin main
```

GitHub Actions will automatically run tests and deploy on push.

## Troubleshooting

### Issue: "Database not found"

**Solution**: Make sure you've created the D1 database and updated the `database_id` in `wrangler.toml`.

### Issue: "KV namespace not found"

**Solution**: Make sure you've created the KV namespace and updated the `id` in `wrangler.toml`.

### Issue: "Secret not found"

**Solution**: Make sure you've set all required secrets using `wrangler secret put`.

### Issue: Tests failing

**Solution**: 
1. Make sure all dependencies are installed: `npm install`
2. Check that you're using Node.js 20+: `node --version`
3. Try clearing node_modules and reinstalling: `rm -rf node_modules package-lock.json && npm install`

### Issue: Worker not starting locally

**Solution**:
1. Make sure you're in the `packages/worker` directory
2. Check that `wrangler.toml` has valid configuration
3. Try running with verbose logging: `npx wrangler dev --log-level debug`

## Next Steps

Now that your environment is set up, you can:

1. **Implement features**: Follow the tasks in `.kiro/specs/subscription-recovery-analytics/tasks.md`
2. **Test webhooks**: Use tools like Postman or curl to test webhook endpoints
3. **Build the dashboard**: Implement the React components for data visualization
4. **Deploy to production**: Repeat the staging deployment steps for production environment

## Support

For issues or questions:
- Check the main README.md for architecture details
- Review the design document in `.kiro/specs/subscription-recovery-analytics/design.md`
- Check Cloudflare Workers documentation: https://developers.cloudflare.com/workers/
