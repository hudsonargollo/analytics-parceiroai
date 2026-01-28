#!/bin/bash

# Production Secrets Setup Script
# This script helps you set up all required secrets for the production environment

set -e

echo "🔐 Production Secrets Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo -e "${RED}Error: wrangler.toml not found${NC}"
    echo "Please run this script from the packages/worker directory"
    exit 1
fi

echo -e "${BLUE}This script will help you set up the required secrets for production.${NC}"
echo ""
echo "You'll need to provide:"
echo "  1. WEBHOOK_SECRET - For n8n webhook validation"
echo "  2. ZUCKZAPGO_SECRET - For WhatsApp webhook validation"
echo "  3. VALID_API_KEYS - For dashboard API access (comma-separated)"
echo "  4. CHATWOOT_TOKEN - For Chatwoot integration"
echo ""

read -p "Continue? (y/n): " CONTINUE
if [ "$CONTINUE" != "y" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${BLUE}Generating secure random secrets...${NC}"
echo ""

# Generate secrets
SECRET1=$(openssl rand -hex 32)
SECRET2=$(openssl rand -hex 32)
SECRET3=$(openssl rand -hex 32)
SECRET4=$(openssl rand -hex 32)

echo "Generated secrets (save these securely!):"
echo ""
echo -e "${GREEN}WEBHOOK_SECRET:${NC}"
echo "$SECRET1"
echo ""
echo -e "${GREEN}ZUCKZAPGO_SECRET:${NC}"
echo "$SECRET2"
echo ""
echo -e "${GREEN}API_KEY_1:${NC}"
echo "$SECRET3"
echo ""
echo -e "${GREEN}API_KEY_2:${NC}"
echo "$SECRET4"
echo ""

read -p "Save these secrets to a file? (y/n): " SAVE_SECRETS
if [ "$SAVE_SECRETS" = "y" ]; then
    SECRETS_FILE="production-secrets-$(date +%Y%m%d-%H%M%S).txt"
    cat > "$SECRETS_FILE" << EOF
Production Secrets - Generated $(date)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WEBHOOK_SECRET (for n8n):
$SECRET1

ZUCKZAPGO_SECRET (for WhatsApp):
$SECRET2

API_KEY_1 (for dashboard):
$SECRET3

API_KEY_2 (for dashboard):
$SECRET4

VALID_API_KEYS (comma-separated):
$SECRET3,$SECRET4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  IMPORTANT: Store this file securely and delete it after setting secrets!
EOF
    echo -e "${GREEN}✓ Secrets saved to: $SECRETS_FILE${NC}"
    echo -e "${YELLOW}⚠️  Remember to delete this file after setting secrets!${NC}"
    echo ""
fi

echo ""
echo -e "${BLUE}Setting secrets in Cloudflare...${NC}"
echo ""

# Set WEBHOOK_SECRET
echo -e "${YELLOW}Setting WEBHOOK_SECRET...${NC}"
echo "$SECRET1" | wrangler secret put WEBHOOK_SECRET --env production
echo -e "${GREEN}✓ WEBHOOK_SECRET set${NC}"
echo ""

# Set ZUCKZAPGO_SECRET
echo -e "${YELLOW}Setting ZUCKZAPGO_SECRET...${NC}"
echo "$SECRET2" | wrangler secret put ZUCKZAPGO_SECRET --env production
echo -e "${GREEN}✓ ZUCKZAPGO_SECRET set${NC}"
echo ""

# Set VALID_API_KEYS
echo -e "${YELLOW}Setting VALID_API_KEYS...${NC}"
echo "$SECRET3,$SECRET4" | wrangler secret put VALID_API_KEYS --env production
echo -e "${GREEN}✓ VALID_API_KEYS set${NC}"
echo ""

# Set CHATWOOT_TOKEN
echo -e "${YELLOW}Setting CHATWOOT_TOKEN...${NC}"
echo ""
echo "Please enter your Chatwoot authentication token:"
echo "(You can find this in your Chatwoot dashboard)"
read -s CHATWOOT_TOKEN
echo ""
echo "$CHATWOOT_TOKEN" | wrangler secret put CHATWOOT_TOKEN --env production
echo -e "${GREEN}✓ CHATWOOT_TOKEN set${NC}"
echo ""

# Verify secrets
echo ""
echo -e "${BLUE}Verifying secrets...${NC}"
wrangler secret list --env production
echo ""

echo -e "${GREEN}✓ All secrets set successfully!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Update N8N_WEBHOOK_URL in wrangler.toml with your actual n8n URL"
echo "2. Redeploy: wrangler deploy --env production"
echo "3. Test the worker: curl https://painel-parceiroai-prod.hudsonargollo2.workers.dev/"
echo "4. Configure n8n to use the generated WEBHOOK_SECRET"
echo "5. Configure ZuckZapGo to use the generated ZUCKZAPGO_SECRET"
echo ""
echo "API Keys for dashboard access:"
echo "  - $SECRET3"
echo "  - $SECRET4"
echo ""
echo -e "${YELLOW}⚠️  Save these API keys securely - you'll need them to access the dashboard!${NC}"
echo ""

if [ "$SAVE_SECRETS" = "y" ]; then
    echo -e "${RED}⚠️  Don't forget to delete $SECRETS_FILE after saving the secrets securely!${NC}"
    echo ""
fi

echo "🎉 Setup complete!"
