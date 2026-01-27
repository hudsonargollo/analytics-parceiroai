# Pre-Deployment Checklist

Complete this checklist before running the deployment script.

## ✅ Prerequisites

- [ ] Node.js 20+ installed (`node --version`)
- [ ] Wrangler CLI installed (`wrangler --version`)
- [ ] Logged in to Cloudflare (`wrangler whoami`)
- [ ] GitHub account with repository access
- [ ] Cloudflare account with Workers enabled

## ✅ Configuration Files

- [ ] Review `packages/worker/wrangler.toml`
- [ ] Update `N8N_WEBHOOK_URL` with your n8n instance URL
- [ ] Review `.github/workflows/deploy.yml`

## ✅ Cloudflare Resources (Will be created during deployment)

- [ ] D1 Database: `recovery_analytics`
- [ ] KV Namespace: `CACHE`
- [ ] Secrets to set:
  - [ ] `WEBHOOK_SECRET` (for n8n webhook validation)
  - [ ] `ZUCKZAPGO_SECRET` (for WhatsApp webhook validation)
  - [ ] `VALID_API_KEYS` (comma-separated API keys)
  - [ ] `CHATWOOT_TOKEN` (for Chatwoot integration)

## ✅ GitHub Setup

- [ ] Create GitHub repository (if not exists)
- [ ] Have repository URL ready (e.g., `https://github.com/username/repo.git`)
- [ ] GitHub Actions secrets (for automated deployments):
  - [ ] `CLOUDFLARE_API_TOKEN` (from Cloudflare dashboard)
  - [ ] `CLOUDFLARE_ACCOUNT_ID` (from Cloudflare dashboard)

## ✅ Testing

- [ ] Run local tests: `cd packages/worker && npm test`
- [ ] Test local worker: `cd packages/worker && npm run dev`
- [ ] Verify health endpoint: `curl http://localhost:8787/`

## 🚀 Ready to Deploy?

Once all items are checked, run:

```bash
./deploy.sh
```

The script will guide you through:
1. Committing changes to Git
2. Pushing to GitHub
3. Creating Cloudflare resources
4. Setting secrets
5. Applying database migrations
6. Deploying to your chosen environment

## 📝 Post-Deployment Tasks

After deployment:

- [ ] Test deployed worker health endpoint
- [ ] Configure n8n webhooks with worker URL
- [ ] Test webhook endpoints with sample data
- [ ] Monitor logs: `wrangler tail --env production`
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring and alerts

## 🆘 Need Help?

- See `DEPLOYMENT.md` for detailed instructions
- See `QUICK_DEPLOY.md` for quick reference
- Check Cloudflare Workers docs: https://developers.cloudflare.com/workers/
