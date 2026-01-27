# Staging Deployment Guide

This guide walks you through deploying the Subscription Recovery Analytics system to the staging environment.

## Prerequisites

- Cloudflare account with Workers and Pages enabled
- Cloudflare API token with appropriate permissions
- GitHub repository with secrets configured
- Wrangler CLI installed (`npm install -g wrangler`)

## Step 1: Configure Cloudflare Secrets

Set up the required secrets for the staging environment:

```bash
# Navigate to worker directory
cd packages/worker

# Set webhook secret
wrangler secret put WEBHOOK_SECRET --env staging

# Set valid API keys (comma-separated)
wrangler secret put VALID_API_KEYS --env staging

# Set Chatwoot token
wrangler secret put CHATWOOT_TOKEN --env staging

# Set n8n webhook URL
wrangler secret put N8N_WEBHOOK_URL --env staging
```

## Step 2: Apply Database Migrations

Create and migrate the D1 database for staging:

```bash
# Create D1 database (if not exists)
wrangler d1 create subscription-recovery-staging

# Update wrangler.toml with the database ID

# Apply migrations
wrangler d1 migrations apply subscription-recovery-staging --env staging
```

## Step 3: Deploy Worker to Staging

Deploy the Cloudflare Worker:

```bash
# From packages/worker directory
npm run build
wrangler deploy --env staging
```

Verify the deployment:
```bash
curl https://staging-worker.your-domain.workers.dev/health
```

## Step 4: Deploy Frontend to Staging

Build and deploy the frontend to Cloudflare Pages:

```bash
# Navigate to frontend directory
cd packages/frontend

# Set staging API URL
export VITE_API_BASE_URL=https://staging-worker.your-domain.workers.dev

# Build the frontend
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=subscription-recovery-staging
```

## Step 5: Configure GitHub Secrets

Add the following secrets to your GitHub repository:

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

## Step 6: Verify Deployment

Test the staging deployment:

### Test Worker Health
```bash
curl https://staging-worker.your-domain.workers.dev/health
```

### Test Payment Webhook
```bash
curl -X POST https://staging-worker.your-domain.workers.dev/webhooks/payment \
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
curl https://staging-worker.your-domain.workers.dev/api/metrics/recovery-rate?date_range=30d \
  -H "X-API-Key: your-api-key"
```

### Test Frontend
Open your browser and navigate to:
```
https://subscription-recovery-staging.pages.dev
```

## Step 7: Monitor Logs

Monitor the staging environment:

```bash
# Worker logs
wrangler tail --env staging

# Check D1 database
wrangler d1 execute subscription-recovery-staging --env staging \
  --command "SELECT COUNT(*) FROM payment_events"
```

## Troubleshooting

### Worker Not Responding
- Check wrangler.toml configuration
- Verify secrets are set correctly
- Check Cloudflare dashboard for errors

### Database Errors
- Verify migrations were applied
- Check D1 binding in wrangler.toml
- Ensure database ID is correct

### Frontend Not Loading
- Check VITE_API_BASE_URL environment variable
- Verify Pages deployment succeeded
- Check browser console for errors

## Next Steps

After successful staging deployment:
1. Run end-to-end tests (Task 22.2)
2. Perform performance testing (Task 22.3)
3. Review for production readiness
4. Deploy to production

## Rollback Procedure

If issues occur, rollback to previous version:

```bash
# Worker rollback
wrangler rollback --env staging

# Frontend rollback
# Redeploy previous version from GitHub
```

## Support

For issues or questions:
- Check Cloudflare dashboard logs
- Review GitHub Actions workflow runs
- Consult Cloudflare Workers documentation
