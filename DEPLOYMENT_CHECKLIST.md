# Deployment Checklist

Use this checklist to ensure all steps are completed for a successful deployment.

## Pre-Deployment Checklist

### Local Development
- [ ] All tests passing locally (`npm test`)
- [ ] Code builds without errors (`npm run build:worker`)
- [ ] Local development server works (`npm run dev:worker`)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] All sensitive data removed from code
- [ ] Environment variables documented

### Cloudflare Account Setup
- [ ] Cloudflare account created
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Authenticated with Cloudflare (`wrangler login`)
- [ ] Account ID obtained from dashboard

### GitHub Setup
- [ ] Repository created on GitHub
- [ ] Local git repository initialized
- [ ] `.gitignore` configured properly
- [ ] No secrets committed to git

## Cloudflare Resource Creation

### D1 Database
- [ ] Database created (`wrangler d1 create recovery_analytics`)
- [ ] Database ID copied
- [ ] `wrangler.toml` updated with database_id
- [ ] Migrations applied locally (`--local`)
- [ ] Migrations applied remotely (`--remote`)
- [ ] Tables verified with SELECT query

### KV Namespace
- [ ] KV namespace created (`wrangler kv:namespace create "CACHE"`)
- [ ] KV ID copied
- [ ] `wrangler.toml` updated with KV id
- [ ] KV namespace verified (`wrangler kv:namespace list`)

### Secrets Configuration
- [ ] WEBHOOK_SECRET generated and set
- [ ] ZUCKZAPGO_SECRET generated and set
- [ ] VALID_API_KEYS generated and set (comma-separated)
- [ ] CHATWOOT_TOKEN obtained and set
- [ ] All secrets verified (`wrangler secret list`)
- [ ] Secrets documented securely (password manager)

### Environment Variables
- [ ] N8N_WEBHOOK_URL updated in `wrangler.toml`
- [ ] ENVIRONMENT variable set for each environment
- [ ] All required variables documented

## First Deployment

### Development Environment
- [ ] Deploy to development (`wrangler deploy --env development`)
- [ ] Worker URL obtained from output
- [ ] Health endpoint tested (`curl $WORKER_URL/`)
- [ ] Logs checked (`wrangler tail --env development`)

### Staging Environment
- [ ] Deploy to staging (`wrangler deploy --env staging`)
- [ ] Worker URL obtained from output
- [ ] Health endpoint tested
- [ ] Integration tests run against staging

### Production Environment
- [ ] Deploy to production (`wrangler deploy --env production`)
- [ ] Worker URL obtained from output
- [ ] Health endpoint tested
- [ ] Production monitoring enabled

## Post-Deployment Verification

### Webhook Endpoints
- [ ] Payment webhook tested with valid signature
- [ ] Payment webhook rejects invalid signature
- [ ] Engagement webhook tested with valid signature
- [ ] Engagement webhook rejects invalid signature
- [ ] Duplicate events properly rejected

### Database Operations
- [ ] Payment events stored correctly
- [ ] Engagement events stored correctly
- [ ] Recovery logs created properly
- [ ] Data queryable via wrangler CLI

### API Endpoints (when implemented)
- [ ] Authentication middleware working
- [ ] Rate limiting enforced
- [ ] Recovery rate endpoint returns data
- [ ] DSO endpoint returns data
- [ ] Error responses formatted correctly

### Performance
- [ ] Response times < 200ms for health check
- [ ] Response times < 500ms for webhook processing
- [ ] Database queries optimized
- [ ] KV caching working (when implemented)

## GitHub Actions Setup

### Secrets Configuration
- [ ] CLOUDFLARE_API_TOKEN added to GitHub secrets
- [ ] CLOUDFLARE_ACCOUNT_ID added to GitHub secrets
- [ ] Secrets verified in repository settings

### Workflow Testing
- [ ] Push to development branch triggers deployment
- [ ] Push to staging branch triggers deployment
- [ ] Push to main branch triggers deployment
- [ ] Tests run before deployment
- [ ] Deployment succeeds without errors
- [ ] Workflow notifications working

## Integration Testing

### n8n Integration
- [ ] n8n webhook URLs updated to worker URL
- [ ] n8n HMAC signature configured with WEBHOOK_SECRET
- [ ] Test payment event sent from n8n
- [ ] Test payment event received and processed
- [ ] n8n receives success response

### ZuckZapGo Integration
- [ ] ZuckZapGo webhook URL configured
- [ ] ZuckZapGo HMAC signature configured with ZUCKZAPGO_SECRET
- [ ] Test engagement event sent from ZuckZapGo
- [ ] Test engagement event received and processed
- [ ] ZuckZapGo receives success response

### Chatwoot Integration (when implemented)
- [ ] Chatwoot sidebar URL configured
- [ ] Chatwoot token configured
- [ ] Sidebar loads in Chatwoot
- [ ] Customer billing data displays
- [ ] Payment actions work correctly

## Monitoring and Alerting

### Cloudflare Dashboard
- [ ] Worker metrics visible
- [ ] Request rate monitored
- [ ] Error rate monitored
- [ ] CPU time monitored
- [ ] Alerts configured for errors

### Logging
- [ ] Logs accessible via `wrangler tail`
- [ ] Error logs reviewed
- [ ] Authentication failures logged
- [ ] Rate limit violations logged

## Documentation

### Internal Documentation
- [ ] Deployment process documented
- [ ] Secrets management documented
- [ ] Rollback procedure documented
- [ ] Troubleshooting guide created

### External Documentation
- [ ] API documentation created (when API is public)
- [ ] Webhook integration guide created
- [ ] Authentication guide created
- [ ] Rate limiting documentation created

## Security Review

### Access Control
- [ ] API keys rotated from defaults
- [ ] Secrets not exposed in logs
- [ ] Secrets not committed to git
- [ ] Cloudflare API token has minimal permissions
- [ ] GitHub secrets properly configured

### Data Privacy
- [ ] No PII stored beyond requirements
- [ ] Data retention policies implemented
- [ ] LGPD compliance verified
- [ ] Data encryption at rest (Cloudflare default)
- [ ] Data encryption in transit (HTTPS)

### Rate Limiting
- [ ] Rate limiting configured (100 req/min)
- [ ] Rate limit responses tested
- [ ] Retry-After header included
- [ ] Rate limit bypass not possible

## Rollback Plan

### Preparation
- [ ] Previous deployment ID noted
- [ ] Rollback command tested in staging
- [ ] Rollback procedure documented
- [ ] Team notified of rollback capability

### Rollback Testing
- [ ] Rollback command works (`wrangler rollback [ID]`)
- [ ] Previous version functional after rollback
- [ ] Database migrations compatible with rollback
- [ ] No data loss during rollback

## Custom Domain Setup (Optional)

### Domain Configuration
- [ ] Custom domain added in Cloudflare
- [ ] DNS records configured
- [ ] SSL certificate provisioned
- [ ] Domain verified and active

### URL Updates
- [ ] n8n webhooks updated to custom domain
- [ ] ZuckZapGo webhooks updated to custom domain
- [ ] Frontend API URL updated to custom domain
- [ ] Documentation updated with custom domain

## Final Verification

### End-to-End Testing
- [ ] Complete payment flow tested
- [ ] Complete engagement flow tested
- [ ] Data flows through entire system
- [ ] Analytics queries return correct data
- [ ] All integrations working

### Performance Testing
- [ ] Load testing completed
- [ ] Concurrent request handling verified
- [ ] Database performance acceptable
- [ ] Cache hit rates acceptable (when implemented)

### Sign-Off
- [ ] Technical lead approval
- [ ] Product owner approval
- [ ] Security review completed
- [ ] Deployment documented
- [ ] Team notified of deployment

## Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Monitor error rates
- [ ] Check webhook processing
- [ ] Verify data accuracy
- [ ] Review logs for issues

### Short-term (Week 1)
- [ ] Analyze performance metrics
- [ ] Review error patterns
- [ ] Optimize slow queries
- [ ] Gather user feedback

### Long-term (Month 1)
- [ ] Review security logs
- [ ] Analyze usage patterns
- [ ] Plan optimizations
- [ ] Document lessons learned

---

## Notes

Use this space to document any deployment-specific notes, issues encountered, or deviations from the standard process:

```
Date: _______________
Deployed by: _______________
Environment: _______________

Notes:
- 
- 
- 

Issues encountered:
- 
- 

Resolutions:
- 
- 
```

