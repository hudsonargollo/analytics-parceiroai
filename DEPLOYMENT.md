# Deployment Guide: Subscription Recovery Analytics

This guide walks you through deploying the Subscription Recovery Analytics system to Cloudflare using Wrangler and GitHub Actions.

## Prerequisites

Before deploying, ensure you have:

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com
2. **Wrangler CLI**: Installed globally (`npm install -g wrangler`)
3. **GitHub Repository**: Code pushed to GitHub
4. **Node.js**: Version 20 or higher

## Step 1: Authenticate with Cloudflare

```bash
# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

## Step 2: Create Cloudflare Resources

### 2.1 Create D1 Database

```bash
cd packages/worker

# Create the database
wrangler d1 create recovery_analytics

# Output will show:
# [[d1_databases]]
# binding = "DB"
# database_name = "recovery_analytics"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Copy the database_id and update wrangler.toml
```

**Update `packages/worker/wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "recovery_analytics"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID
```

### 2.2 Apply Database Migrations

```bash
# Apply migrations to local database (for testing)
wrangler d1 execute recovery_analytics --local --file=./migrations/0001_initial_schema.sql

# Apply migrations to remote database (production)
wrangler d1 execute recovery_analytics --remote --file=./migrations/0001_initial_schema.sql
```

### 2.3 Create KV Namespace

```bash
# Create KV namespace for caching
wrangler kv:namespace create "CACHE"

# Output will show:
# { binding = "KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }

# Copy the id and update wrangler.toml
```

**Update `packages/worker/wrangler.toml`:**
```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_ID_HERE"  # Replace with actual ID
```

### 2.4 Set Secrets

Generate secure secrets and set them in Cloudflare:

```bash
# Generate secure secrets
openssl rand -hex 32  # For WEBHOOK_SECRET
openssl rand -hex 32  # For ZUCKZAPGO_SECRET
openssl rand -hex 32  # For API key 1
openssl rand -hex 32  # For API key 2

# Set secrets in Cloudflare
wrangler secret put WEBHOOK_SECRET
# Paste the generated secret when prompted

wrangler secret put ZUCKZAPGO_SECRET
# Paste the generated secret

wrangler secret put VALID_API_KEYS
# Enter comma-separated API keys: key1,key2,key3

wrangler secret put CHATWOOT_TOKEN
# Enter your Chatwoot authentication token
```

## Step 3: Update Environment Variables

Update `packages/worker/wrangler.toml` with your n8n webhook URL:

```toml
[vars]
N8N_WEBHOOK_URL = "https://your-n8n-instance.com/webhook/boleto-resend"
```

## Step 4: Test Local Deployment

Before deploying to production, test locally:

```bash
cd packages/worker

# Start local development server
npm run dev

# In another terminal, test the health endpoint
curl http://localhost:8787/

# Expected response:
# {
#   "status": "ok",
#   "service": "subscription-recovery-analytics",
#   "environment": "development",
#   "timestamp": "2024-01-26T..."
# }
```

## Step 5: Deploy to Cloudflare

### Manual Deployment

```bash
cd packages/worker

# Deploy to development
wrangler deploy --env development

# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

After deployment, Wrangler will output the worker URL:
```
Published subscription-recovery-analytics-prod (X.XX sec)
  https://subscription-recovery-analytics-prod.your-subdomain.workers.dev
```

## Step 6: Set Up GitHub Actions

### 6.1 Get Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Add permissions:
   - Account > Workers Scripts > Edit
   - Account > Workers KV Storage > Edit
   - Account > D1 > Edit
5. Copy the generated token

### 6.2 Get Cloudflare Account ID

1. Go to https://dash.cloudflare.com
2. Select your account
3. Copy the Account ID from the right sidebar

### 6.3 Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Add the following secrets:

   - **CLOUDFLARE_API_TOKEN**: Your Cloudflare API token
   - **CLOUDFLARE_ACCOUNT_ID**: Your Cloudflare account ID

### 6.4 Push to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: Subscription Recovery Analytics"

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

The GitHub Actions workflow will automatically:
1. Run all tests
2. Deploy the worker to Cloudflare
3. Deploy the frontend to Cloudflare Pages (when ready)

## Step 7: Verify Deployment

### 7.1 Test the Deployed Worker

```bash
# Replace with your actual worker URL
WORKER_URL="https://subscription-recovery-analytics-prod.your-subdomain.workers.dev"

# Test health endpoint
curl $WORKER_URL/

# Test with API key
curl -H "X-API-Key: your-api-key" $WORKER_URL/api/metrics/recovery-rate
```

### 7.2 Test Webhook Endpoints

```bash
# Generate HMAC signature
SECRET="your-webhook-secret"
PAYLOAD='{"event_id":"test_001","customer_id":"cust_123","invoice_id":"inv_456","amount":5000,"payment_method":"pix","status":"pending","due_date":"2024-01-29","timestamp":"2024-01-26T10:00:00Z"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send test webhook
curl -X POST $WORKER_URL/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"

# Expected response:
# {"status":"accepted","event_id":"test_001"}
```

### 7.3 Query the Database

```bash
# Check payment events
wrangler d1 execute recovery_analytics --remote \
  --command "SELECT * FROM payment_events ORDER BY created_at DESC LIMIT 5"

# Check engagement events
wrangler d1 execute recovery_analytics --remote \
  --command "SELECT * FROM engagement_events ORDER BY created_at DESC LIMIT 5"
```

## Step 8: Set Up Custom Domain (Optional)

### 8.1 Add Custom Domain in Cloudflare Dashboard

1. Go to Workers & Pages > Your Worker
2. Click "Triggers" tab
3. Click "Add Custom Domain"
4. Enter your domain (e.g., `api.recovery-analytics.com`)
5. Cloudflare will automatically configure DNS

### 8.2 Update n8n Webhook URLs

Update your n8n workflows to use the new custom domain:
- Old: `https://subscription-recovery-analytics-prod.your-subdomain.workers.dev/webhooks/payment`
- New: `https://api.recovery-analytics.com/webhooks/payment`

## Step 9: Monitor Deployment

### 9.1 View Logs

```bash
# Tail production logs
wrangler tail --env production

# Filter for errors
wrangler tail --env production --status error
```

### 9.2 Check Metrics

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages > Your Worker
3. View metrics:
   - Requests per second
   - Error rate
   - CPU time
   - Duration

## Troubleshooting

### Issue: "Database not found"

**Solution:**
```bash
# Verify database exists
wrangler d1 list

# If missing, create it
wrangler d1 create recovery_analytics

# Apply migrations
wrangler d1 execute recovery_analytics --remote --file=./migrations/0001_initial_schema.sql
```

### Issue: "KV namespace not found"

**Solution:**
```bash
# Verify KV namespace exists
wrangler kv:namespace list

# If missing, create it
wrangler kv:namespace create "CACHE"

# Update wrangler.toml with the new ID
```

### Issue: "Secret not found"

**Solution:**
```bash
# List all secrets
wrangler secret list

# Set missing secrets
wrangler secret put WEBHOOK_SECRET
wrangler secret put ZUCKZAPGO_SECRET
wrangler secret put VALID_API_KEYS
wrangler secret put CHATWOOT_TOKEN
```

### Issue: "GitHub Actions failing"

**Solution:**
1. Check that GitHub secrets are set correctly
2. Verify Cloudflare API token has correct permissions
3. Check workflow logs for specific errors
4. Ensure wrangler.toml has correct database_id and KV id

### Issue: "Webhook signature validation failing"

**Solution:**
1. Verify WEBHOOK_SECRET matches between n8n and Cloudflare
2. Check HMAC signature generation in n8n
3. Test locally first with known good signature
4. Check worker logs for signature mismatch details

## Environment-Specific Deployments

### Development
```bash
wrangler deploy --env development
# URL: https://subscription-recovery-analytics-dev.your-subdomain.workers.dev
```

### Staging
```bash
wrangler deploy --env staging
# URL: https://subscription-recovery-analytics-staging.your-subdomain.workers.dev
```

### Production
```bash
wrangler deploy --env production
# URL: https://subscription-recovery-analytics-prod.your-subdomain.workers.dev
```

## Rollback Procedure

If you need to rollback a deployment:

```bash
# View deployment history
wrangler deployments list

# Rollback to previous version
wrangler rollback [DEPLOYMENT_ID]
```

## Next Steps

After successful deployment:

1. ✅ Configure n8n webhooks to point to your worker URL
2. ✅ Set up monitoring and alerting
3. ✅ Configure Chatwoot sidebar integration
4. ✅ Deploy frontend to Cloudflare Pages
5. ✅ Set up custom domains
6. ✅ Configure rate limiting and security rules
7. ✅ Set up backup and disaster recovery

## Support

For issues or questions:
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Wrangler CLI Docs: https://developers.cloudflare.com/workers/wrangler/
- GitHub Actions Docs: https://docs.github.com/en/actions

