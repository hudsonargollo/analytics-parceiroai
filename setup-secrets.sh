#!/bin/bash

# Setup Production Secrets for Subscription Recovery Analytics
# This script helps you set all required secrets for the production environment

set -e

echo "🔐 Setting up Production Secrets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd packages/worker

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}This script will help you set 4 required secrets:${NC}"
echo "1. WEBHOOK_SECRET - For n8n webhook validation"
echo "2. ZUCKZAPGO_SECRET - For WhatsApp webhook validation"
echo "3. VALID_API_KEYS - For dashboard API access"
echo "4. CHATWOOT_TOKEN - For Chatwoot integration"
echo ""

echo -e "${YELLOW}Tip: Generate secure secrets with:${NC}"
echo "  openssl rand -hex 32"
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Set WEBHOOK_SECRET
echo -e "${BLUE}Setting WEBHOOK_SECRET...${NC}"
echo "This secret is used to validate webhooks from n8n"
wrangler secret put WEBHOOK_SECRET --env production
echo -e "${GREEN}✓ WEBHOOK_SECRET set${NC}"
echo ""

# Set ZUCKZAPGO_SECRET
echo -e "${BLUE}Setting ZUCKZAPGO_SECRET...${NC}"
echo "This secret is used to validate webhooks from ZuckZapGo (WhatsApp)"
wrangler secret put ZUCKZAPGO_SECRET --env production
echo -e "${GREEN}✓ ZUCKZAPGO_SECRET set${NC}"
echo ""

# Set VALID_API_KEYS
echo -e "${BLUE}Setting VALID_API_KEYS...${NC}"
echo "Enter comma-separated API keys (e.g., key1,key2,key3)"
echo "These keys will be used to authenticate dashboard API requests"
wrangler secret put VALID_API_KEYS --env production
echo -e "${GREEN}✓ VALID_API_KEYS set${NC}"
echo ""

# Set CHATWOOT_TOKEN
echo -e "${BLUE}Setting CHATWOOT_TOKEN...${NC}"
echo "Enter your Chatwoot authentication token"
wrangler secret put CHATWOOT_TOKEN --env production
echo -e "${GREEN}✓ CHATWOOT_TOKEN set${NC}"
echo ""

# Verify all secrets are set
echo -e "${BLUE}Verifying secrets...${NC}"
wrangler secret list --env production
echo ""

echo -e "${GREEN}✅ All secrets have been set!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the worker: curl https://painel-parceiroai-prod.hudsonargollo2.workers.dev/"
echo "2. Update n8n webhooks to use the production URL"
echo "3. Configure the N8N_WEBHOOK_URL in wrangler.toml if needed"
echo ""
