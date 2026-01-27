# Quick Deployment Reference

## Prerequisites Check

```bash
# Check Node.js version (should be 20+)
node --version

# Check if wrangler is installed
wrangler --version

# If not installed:
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

## One-Time Setup (First Deployment)

### 1. Create Cloudflare Resources

```bash
cd packages/worker

# Create D1 database
wrangler d1 create recovery_analytics
# Copy the database_id and update wrangler.toml

# Create KV namespace
wrangler kv:namespace create "CACHE"
# Copy the id and update wrangler.toml

# Apply database migrations
wrangler d1 execute recovery_analytics --remote --file=./migrations/0001_initial_schema.sql
```

### 2. Set Secrets

```bash
# Generate secrets
openssl rand -hex 32  # Use for each secret below

# Set secrets
wrangler secret put WEBHOOK_SECRET
wrangler secret put ZUCKZAPGO_SECRET
wrangler secret put VALID_API_KEYS  # Comma-separated: key1,key2
wrangler secret put CHATWOOT_TOKEN
```

### 3. Update wrangler.toml

Update these values in `packages/worker/wrangler.toml`:
- `database_id` - from step 1
- `id` (KV namespace) - from step 1
- `N8N_WEBHOOK_URL` - your n8n webhook URL

## Deploy Commands

### Deploy to Development
```bash
cd packages/worker
wrangler deploy --env development
```

### Deploy to Staging
```bash
cd packages/worker
wrangler deploy --env staging
```

### Deploy to Production
```bash
cd packages/worker
wrangler deploy --env production
```

## Test Deployment

```bash
# Get your worker URL from deployment output
WORKER_URL="https://subscription-recovery-analytics-prod.YOUR-SUBDOMAIN.workers.dev"

# Test health endpoint
curl $WORKER_URL/

# Expected: {"status":"ok","service":"subscription-recovery-analytics",...}
```

## GitHub Actions Setup

### 1. Get Cloudflare Credentials

- **API Token**: https://dash.cloudflare.com/profile/api-tokens
  - Create token with "Edit Cloudflare Workers" template
- **Account ID**: https://dash.cloudflare.com (right sidebar)

### 2. Add GitHub Secrets

Go to: Repository Settings > Secrets and variables > Actions

Add:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 3. Push to GitHub

```bash
git add .
git commit -m "Deploy subscription recovery analytics"
git push origin main
```

GitHub Actions will automatically deploy on push to main/staging/development branches.

## Common Commands

### View Logs
```bash
wrangler tail --env production
```

### List Deployments
```bash
wrangler deployments list
```

### Query Database
```bash
wrangler d1 execute recovery_analytics --remote \
  --command "SELECT * FROM payment_events LIMIT 5"
```

### List Secrets
```bash
wrangler secret list
```

### Update a Secret
```bash
wrangler secret put SECRET_NAME
```

## Troubleshooting

### "Database not found"
```bash
wrangler d1 list  # Check if database exists
wrangler d1 create recovery_analytics  # Create if missing
```

### "KV namespace not found"
```bash
wrangler kv:namespace list  # Check if namespace exists
wrangler kv:namespace create "CACHE"  # Create if missing
```

### "Unauthorized" errors
```bash
wrangler logout
wrangler login
```

### Check deployment status
```bash
# View recent deployments
wrangler deployments list

# View worker details
wrangler whoami
```

## Automated Setup Script

For automated setup, run:
```bash
./scripts/setup-cloudflare.sh
```

This script will guide you through:
1. Creating D1 database
2. Applying migrations
3. Creating KV namespace
4. Generating and setting secrets
5. Deploying to your chosen environment

## Next Steps After Deployment

1. ✅ Test webhook endpoints with curl
2. ✅ Configure n8n to send webhooks to your worker URL
3. ✅ Set up custom domain (optional)
4. ✅ Monitor logs and metrics in Cloudflare dashboard
5. ✅ Deploy frontend to Cloudflare Pages

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

