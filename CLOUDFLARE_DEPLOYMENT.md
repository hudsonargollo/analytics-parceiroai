# Cloudflare Deployment Guide - Painel Parceiro AI

This guide will walk you through deploying the Painel Parceiro AI to Cloudflare with the custom domain `painel.clubemkt.digital`.

## Prerequisites

- Cloudflare account
- Domain `clubemkt.digital` added to Cloudflare
- Wrangler CLI installed: `npm install -g wrangler`
- GitHub repository: https://github.com/hudsonargollo/analytics-parceiroai

## Quick Start

Run the automated deployment script:

```bash
./deploy-painel-parceiroai.sh
```

Or follow the manual steps below:

## Manual Deployment Steps

### Step 1: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication.

### Step 2: Create D1 Database

```bash
cd packages/worker
wrangler d1 create painel-parceiroai-db
```

Copy the database ID from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "painel-parceiroai-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID
```

### Step 3: Apply Database Migrations

```bash
wrangler d1 migrations apply painel-parceiroai-db --env production
```

### Step 4: Create KV Namespace

```bash
wrangler kv:namespace create "CACHE" --env production
```

Copy the namespace ID and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID_HERE"  # Replace with actual ID
```

### Step 5: Set Secrets

Set the required secrets for production:

```bash
# Webhook secret for n8n
wrangler secret put WEBHOOK_SECRET --env production

# API keys (comma-separated)
wrangler secret put VALID_API_KEYS --env production

# Chatwoot authentication token
wrangler secret put CHATWOOT_TOKEN --env production
```

### Step 6: Deploy Worker

```bash
# Build TypeScript
npm run build

# Deploy to production
wrangler deploy --env production
```

The Worker will be deployed to: `https://painel-parceiroai-prod.YOUR_SUBDOMAIN.workers.dev`

### Step 7: Configure Worker Custom Domain

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** > **painel-parceiroai-prod**
3. Click **Settings** > **Triggers** > **Custom Domains**
4. Click **Add Custom Domain**
5. Enter: `api.painel.clubemkt.digital`
6. Click **Add Custom Domain**

Cloudflare will automatically configure the DNS records.

### Step 8: Build and Deploy Frontend

```bash
cd packages/frontend

# Set production API URL
export VITE_API_BASE_URL="https://api.painel.clubemkt.digital"

# Build the frontend
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=painel-parceiroai --branch=main
```

### Step 9: Configure Frontend Custom Domain

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** > **painel-parceiroai**
3. Click **Custom domains** tab
4. Click **Set up a custom domain**
5. Enter: `painel.clubemkt.digital`
6. Click **Continue**

Cloudflare will automatically configure the DNS records.

### Step 10: Verify Deployment

Test the Worker API:

```bash
curl https://api.painel.clubemkt.digital/health
```

Test the Frontend:

Open your browser and navigate to:
```
https://painel.clubemkt.digital
```

## Environment Variables

### Worker Environment Variables

Set in `wrangler.toml`:

```toml
[vars]
N8N_WEBHOOK_URL = "https://your-n8n-instance.com/webhook/boleto-resend"
```

### Frontend Environment Variables

Set during build:

```bash
export VITE_API_BASE_URL="https://api.painel.clubemkt.digital"
```

## Secrets Management

Secrets are stored securely in Cloudflare and never exposed in code:

- `WEBHOOK_SECRET`: HMAC secret for validating n8n webhooks
- `VALID_API_KEYS`: Comma-separated list of valid API keys for authentication
- `CHATWOOT_TOKEN`: Bearer token for Chatwoot API authentication

To update a secret:

```bash
wrangler secret put SECRET_NAME --env production
```

To list secrets:

```bash
wrangler secret list --env production
```

## DNS Configuration

Cloudflare automatically configures DNS when you add custom domains. Verify the records:

1. Go to Cloudflare Dashboard
2. Select domain: `clubemkt.digital`
3. Click **DNS** > **Records**

You should see:
- `painel.clubemkt.digital` → CNAME to Cloudflare Pages
- `api.painel.clubemkt.digital` → CNAME to Cloudflare Workers

## Monitoring and Logs

### View Worker Logs

```bash
wrangler tail --env production
```

### View Pages Deployment Logs

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** > **painel-parceiroai**
3. Click **Deployments** tab
4. Click on a deployment to view logs

### Check D1 Database

```bash
# List tables
wrangler d1 execute painel-parceiroai-db --env production \
  --command "SELECT name FROM sqlite_master WHERE type='table'"

# Check payment events count
wrangler d1 execute painel-parceiroai-db --env production \
  --command "SELECT COUNT(*) as count FROM payment_events"
```

### Check KV Cache

```bash
# List keys
wrangler kv:key list --namespace-id=YOUR_KV_NAMESPACE_ID

# Get a specific key
wrangler kv:key get "recovery_rate:30d:all" --namespace-id=YOUR_KV_NAMESPACE_ID
```

## Testing the Deployment

### Test Payment Webhook

```bash
curl -X POST https://api.painel.clubemkt.digital/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: your-hmac-signature" \
  -d '{
    "event_id": "test_001",
    "customer_id": "cust_test",
    "invoice_id": "inv_test",
    "amount": 10000,
    "payment_method": "pix",
    "status": "confirmed",
    "due_date": "2024-02-01",
    "timestamp": "2024-01-27T12:00:00Z"
  }'
```

### Test Analytics API

```bash
curl https://api.painel.clubemkt.digital/api/metrics/recovery-rate?date_range=30d \
  -H "X-API-Key: your-api-key"
```

### Test Dashboard

Open browser to: https://painel.clubemkt.digital

## Troubleshooting

### Worker Not Responding

1. Check deployment status:
   ```bash
   wrangler deployments list --env production
   ```

2. View logs:
   ```bash
   wrangler tail --env production
   ```

3. Verify secrets are set:
   ```bash
   wrangler secret list --env production
   ```

### Database Errors

1. Verify database exists:
   ```bash
   wrangler d1 list
   ```

2. Check migrations:
   ```bash
   wrangler d1 migrations list painel-parceiroai-db --env production
   ```

3. Re-apply migrations if needed:
   ```bash
   wrangler d1 migrations apply painel-parceiroai-db --env production
   ```

### Frontend Not Loading

1. Check Pages deployment:
   - Go to Cloudflare Dashboard > Workers & Pages > painel-parceiroai
   - Verify latest deployment is successful

2. Check environment variables:
   - Ensure `VITE_API_BASE_URL` was set during build

3. Rebuild and redeploy:
   ```bash
   cd packages/frontend
   export VITE_API_BASE_URL="https://api.painel.clubemkt.digital"
   npm run build
   npx wrangler pages deploy dist --project-name=painel-parceiroai
   ```

### Custom Domain Not Working

1. Verify DNS records in Cloudflare Dashboard
2. Wait for DNS propagation (can take up to 24 hours)
3. Check SSL/TLS settings:
   - Go to Cloudflare Dashboard > SSL/TLS
   - Ensure mode is set to "Full" or "Full (strict)"

## Rollback Procedure

### Rollback Worker

```bash
# List deployments
wrangler deployments list --env production

# Rollback to previous version
wrangler rollback --env production
```

### Rollback Frontend

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** > **painel-parceiroai**
3. Click **Deployments** tab
4. Find the previous working deployment
5. Click **...** > **Rollback to this deployment**

## CI/CD with GitHub Actions

The repository includes GitHub Actions workflows for automated deployment.

### Setup GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to GitHub repository settings
2. Click **Secrets and variables** > **Actions**
3. Add the following secrets:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

### Automatic Deployment

Pushes to the `main` branch will automatically:
1. Run tests
2. Deploy Worker to production
3. Deploy Frontend to production

## Performance Optimization

### Enable Caching

The system uses KV for caching with 5-minute TTL. Monitor cache hit rates:

```bash
wrangler tail --env production | grep "cache"
```

### Database Optimization

Ensure indexes are created:

```bash
wrangler d1 execute painel-parceiroai-db --env production \
  --command "PRAGMA index_list('payment_events')"
```

### Monitor Performance

Use Cloudflare Analytics:
1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** > **painel-parceiroai-prod**
3. Click **Metrics** tab

## Support

For issues or questions:
- Check logs: `wrangler tail --env production`
- Review documentation: https://developers.cloudflare.com/workers/
- GitHub repository: https://github.com/hudsonargollo/analytics-parceiroai

## Next Steps

After successful deployment:
1. Configure n8n webhooks to point to `https://api.painel.clubemkt.digital`
2. Set up Chatwoot sidebar integration
3. Test all features end-to-end
4. Monitor performance and errors
5. Set up alerts for critical issues

---

**Deployment Complete! 🎉**

Your Painel Parceiro AI is now live at:
- Frontend: https://painel.clubemkt.digital
- API: https://api.painel.clubemkt.digital
