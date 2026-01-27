# Painel Parceiro AI - Quick Deployment Reference

## 🚀 Quick Deploy Commands

### One-Line Deployment
```bash
./deploy-painel-parceiroai.sh
```

### Manual Deployment

**1. Setup Infrastructure**
```bash
# Login
wrangler login

# Create D1 Database
wrangler d1 create painel-parceiroai-db

# Create KV Namespace
wrangler kv:namespace create "CACHE" --env production

# Apply Migrations
cd packages/worker
wrangler d1 migrations apply painel-parceiroai-db --env production
```

**2. Configure Secrets**
```bash
wrangler secret put WEBHOOK_SECRET --env production
wrangler secret put VALID_API_KEYS --env production
wrangler secret put CHATWOOT_TOKEN --env production
```

**3. Deploy Worker**
```bash
cd packages/worker
npm run build
wrangler deploy --env production
```

**4. Deploy Frontend**
```bash
cd packages/frontend
export VITE_API_BASE_URL="https://api.painel.clubemkt.digital"
npm run build
npx wrangler pages deploy dist --project-name=painel-parceiroai
```

## 🌐 URLs

- **Frontend**: https://painel.clubemkt.digital
- **API**: https://api.painel.clubemkt.digital
- **GitHub**: https://github.com/hudsonargollo/analytics-parceiroai

## 🔑 Required Secrets

| Secret | Description |
|--------|-------------|
| `WEBHOOK_SECRET` | HMAC secret for n8n webhooks |
| `VALID_API_KEYS` | Comma-separated API keys |
| `CHATWOOT_TOKEN` | Chatwoot authentication token |

## 📊 Monitoring Commands

```bash
# View Worker logs
wrangler tail --env production

# Check database
wrangler d1 execute painel-parceiroai-db --env production \
  --command "SELECT COUNT(*) FROM payment_events"

# List KV keys
wrangler kv:key list --namespace-id=YOUR_KV_ID
```

## 🧪 Test Commands

```bash
# Test API health
curl https://api.painel.clubemkt.digital/health

# Test recovery rate endpoint
curl https://api.painel.clubemkt.digital/api/metrics/recovery-rate?date_range=30d \
  -H "X-API-Key: your-key"

# Test payment webhook
curl -X POST https://api.painel.clubemkt.digital/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: signature" \
  -d '{"event_id":"test","customer_id":"cust_1",...}'
```

## 🔄 Update Commands

```bash
# Update Worker
cd packages/worker
npm run build
wrangler deploy --env production

# Update Frontend
cd packages/frontend
npm run build
npx wrangler pages deploy dist --project-name=painel-parceiroai

# Update Secret
wrangler secret put SECRET_NAME --env production

# Rollback Worker
wrangler rollback --env production
```

## 📝 Configuration Files

- **Worker Config**: `packages/worker/wrangler.toml`
- **Frontend Config**: `packages/frontend/.env`
- **CI/CD**: `.github/workflows/deploy.yml`
- **Database Migrations**: `packages/worker/migrations/`

## 🎯 Custom Domain Setup

**Worker API Domain** (`api.painel.clubemkt.digital`):
1. Cloudflare Dashboard → Workers & Pages → painel-parceiroai-prod
2. Settings → Triggers → Custom Domains → Add Custom Domain

**Frontend Domain** (`painel.clubemkt.digital`):
1. Cloudflare Dashboard → Workers & Pages → painel-parceiroai
2. Custom domains → Set up a custom domain

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Worker not responding | Check `wrangler tail --env production` |
| Database errors | Verify migrations with `wrangler d1 migrations list` |
| Frontend 404 | Rebuild with correct `VITE_API_BASE_URL` |
| Custom domain not working | Check DNS records in Cloudflare Dashboard |
| Secrets not working | Verify with `wrangler secret list --env production` |

## 📚 Documentation

- **Full Deployment Guide**: `CLOUDFLARE_DEPLOYMENT.md`
- **E2E Testing**: `E2E_TESTING_GUIDE.md`
- **Performance Testing**: `PERFORMANCE_TESTING_GUIDE.md`
- **Spec Summary**: `SPEC_COMPLETION_SUMMARY.md`

## 🎉 Post-Deployment Checklist

- [ ] Worker deployed and responding
- [ ] Frontend deployed and loading
- [ ] Custom domains configured
- [ ] Secrets set correctly
- [ ] Database migrations applied
- [ ] API endpoints tested
- [ ] Dashboard loads correctly
- [ ] n8n webhooks configured
- [ ] Chatwoot sidebar tested
- [ ] Monitoring enabled

---

**Need Help?** Check the full guides or run `./deploy-painel-parceiroai.sh`
