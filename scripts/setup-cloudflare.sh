#!/bin/bash

# Cloudflare Setup Script for Subscription Recovery Analytics
# This script helps automate the initial Cloudflare resource creation

set -e

echo "=================================================="
echo "  Cloudflare Setup for Subscription Recovery"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: Wrangler CLI is not installed${NC}"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Check if logged in
echo "Checking Wrangler authentication..."
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Cloudflare${NC}"
    echo "Running: wrangler login"
    wrangler login
fi

echo -e "${GREEN}✓ Authenticated with Cloudflare${NC}"
echo ""

# Navigate to worker directory
cd packages/worker

# Step 1: Create D1 Database
echo "=================================================="
echo "Step 1: Creating D1 Database"
echo "=================================================="
echo ""

read -p "Create D1 database 'recovery_analytics'? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating D1 database..."
    wrangler d1 create recovery_analytics
    
    echo ""
    echo -e "${YELLOW}⚠ IMPORTANT: Copy the database_id from above and update wrangler.toml${NC}"
    echo "Update this line in wrangler.toml:"
    echo "  database_id = \"YOUR_DATABASE_ID_HERE\""
    echo ""
    read -p "Press Enter after updating wrangler.toml..."
fi

# Step 2: Apply Database Migrations
echo ""
echo "=================================================="
echo "Step 2: Applying Database Migrations"
echo "=================================================="
echo ""

read -p "Apply database migrations? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Applying migrations to local database..."
    wrangler d1 execute recovery_analytics --local --file=./migrations/0001_initial_schema.sql
    
    echo ""
    echo "Applying migrations to remote database..."
    wrangler d1 execute recovery_analytics --remote --file=./migrations/0001_initial_schema.sql
    
    echo -e "${GREEN}✓ Migrations applied successfully${NC}"
fi

# Step 3: Create KV Namespace
echo ""
echo "=================================================="
echo "Step 3: Creating KV Namespace"
echo "=================================================="
echo ""

read -p "Create KV namespace 'CACHE'? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating KV namespace..."
    wrangler kv:namespace create "CACHE"
    
    echo ""
    echo -e "${YELLOW}⚠ IMPORTANT: Copy the id from above and update wrangler.toml${NC}"
    echo "Update this line in wrangler.toml:"
    echo "  id = \"YOUR_KV_ID_HERE\""
    echo ""
    read -p "Press Enter after updating wrangler.toml..."
fi

# Step 4: Generate and Set Secrets
echo ""
echo "=================================================="
echo "Step 4: Setting Secrets"
echo "=================================================="
echo ""

echo "Generating secure secrets..."
WEBHOOK_SECRET=$(openssl rand -hex 32)
ZUCKZAPGO_SECRET=$(openssl rand -hex 32)
API_KEY_1=$(openssl rand -hex 32)
API_KEY_2=$(openssl rand -hex 32)

echo ""
echo -e "${GREEN}Generated secrets (save these securely):${NC}"
echo "WEBHOOK_SECRET: $WEBHOOK_SECRET"
echo "ZUCKZAPGO_SECRET: $ZUCKZAPGO_SECRET"
echo "API_KEY_1: $API_KEY_1"
echo "API_KEY_2: $API_KEY_2"
echo ""

read -p "Set WEBHOOK_SECRET in Cloudflare? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "$WEBHOOK_SECRET" | wrangler secret put WEBHOOK_SECRET
    echo -e "${GREEN}✓ WEBHOOK_SECRET set${NC}"
fi

read -p "Set ZUCKZAPGO_SECRET in Cloudflare? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "$ZUCKZAPGO_SECRET" | wrangler secret put ZUCKZAPGO_SECRET
    echo -e "${GREEN}✓ ZUCKZAPGO_SECRET set${NC}"
fi

read -p "Set VALID_API_KEYS in Cloudflare? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "$API_KEY_1,$API_KEY_2" | wrangler secret put VALID_API_KEYS
    echo -e "${GREEN}✓ VALID_API_KEYS set${NC}"
fi

read -p "Set CHATWOOT_TOKEN in Cloudflare? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Enter your Chatwoot token:"
    wrangler secret put CHATWOOT_TOKEN
    echo -e "${GREEN}✓ CHATWOOT_TOKEN set${NC}"
fi

# Step 5: Update Environment Variables
echo ""
echo "=================================================="
echo "Step 5: Environment Variables"
echo "=================================================="
echo ""

echo "Update the following in wrangler.toml:"
echo "  N8N_WEBHOOK_URL = \"https://your-n8n-instance.com/webhook/boleto-resend\""
echo ""
read -p "Press Enter after updating wrangler.toml..."

# Step 6: Test Local Deployment
echo ""
echo "=================================================="
echo "Step 6: Testing Local Deployment"
echo "=================================================="
echo ""

read -p "Start local development server? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting local server..."
    echo "Press Ctrl+C to stop"
    echo ""
    npm run dev
fi

# Step 7: Deploy to Cloudflare
echo ""
echo "=================================================="
echo "Step 7: Deploy to Cloudflare"
echo "=================================================="
echo ""

echo "Choose environment to deploy:"
echo "1) Development"
echo "2) Staging"
echo "3) Production"
echo "4) Skip deployment"
read -p "Enter choice (1-4): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo "Deploying to development..."
        wrangler deploy --env development
        ;;
    2)
        echo "Deploying to staging..."
        wrangler deploy --env staging
        ;;
    3)
        echo "Deploying to production..."
        wrangler deploy --env production
        ;;
    4)
        echo "Skipping deployment"
        ;;
    *)
        echo "Invalid choice, skipping deployment"
        ;;
esac

# Summary
echo ""
echo "=================================================="
echo "  Setup Complete!"
echo "=================================================="
echo ""
echo -e "${GREEN}✓ D1 Database created${NC}"
echo -e "${GREEN}✓ Database migrations applied${NC}"
echo -e "${GREEN}✓ KV Namespace created${NC}"
echo -e "${GREEN}✓ Secrets configured${NC}"
echo ""
echo "Next steps:"
echo "1. Test your deployment with curl"
echo "2. Configure n8n webhooks"
echo "3. Set up GitHub Actions (see DEPLOYMENT.md)"
echo "4. Configure custom domain (optional)"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"
echo ""

