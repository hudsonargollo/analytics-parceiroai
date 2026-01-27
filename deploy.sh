#!/bin/bash

# Subscription Recovery Analytics - Deployment Script
# This script automates deployment to GitHub and Cloudflare

set -e

echo "🚀 Subscription Recovery Analytics - Deployment Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git is installed${NC}"

if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}✗ Wrangler is not installed${NC}"
    echo "Install with: npm install -g wrangler"
    exit 1
fi
echo -e "${GREEN}✓ Wrangler is installed${NC}"

if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}✗ Not logged in to Cloudflare${NC}"
    echo "Run: wrangler login"
    exit 1
fi
echo -e "${GREEN}✓ Logged in to Cloudflare${NC}"
echo ""

# Step 2: Commit to Git
echo -e "${BLUE}Step 2: Committing changes to Git...${NC}"

git add .

if git diff --cached --quiet; then
    echo -e "${YELLOW}No changes to commit${NC}"
else
    read -p "Enter commit message (or press Enter for default): " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="Deploy subscription recovery analytics"
    fi
    
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✓ Changes committed${NC}"
fi
echo ""

# Step 3: Check if remote exists
echo -e "${BLUE}Step 3: Checking GitHub remote...${NC}"

if ! git remote get-url origin &> /dev/null; then
    echo -e "${YELLOW}No GitHub remote configured${NC}"
    read -p "Enter GitHub repository URL (e.g., https://github.com/username/repo.git): " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo -e "${RED}✗ Repository URL is required${NC}"
        exit 1
    fi
    
    git remote add origin "$REPO_URL"
    echo -e "${GREEN}✓ Remote added${NC}"
else
    REPO_URL=$(git remote get-url origin)
    echo -e "${GREEN}✓ Remote exists: $REPO_URL${NC}"
fi
echo ""

# Step 4: Push to GitHub
echo -e "${BLUE}Step 4: Pushing to GitHub...${NC}"

CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    CURRENT_BRANCH="main"
    git branch -M main
fi

echo "Pushing to branch: $CURRENT_BRANCH"
git push -u origin "$CURRENT_BRANCH" || {
    echo -e "${YELLOW}Note: If this is the first push, you may need to authenticate with GitHub${NC}"
    exit 1
}
echo -e "${GREEN}✓ Pushed to GitHub${NC}"
echo ""

# Step 5: Check Cloudflare resources
echo -e "${BLUE}Step 5: Checking Cloudflare resources...${NC}"

cd packages/worker

# Check if D1 database exists
echo "Checking D1 database..."
if wrangler d1 list | grep -q "recovery_analytics"; then
    echo -e "${GREEN}✓ D1 database exists${NC}"
else
    echo -e "${YELLOW}⚠ D1 database not found${NC}"
    read -p "Create D1 database? (y/n): " CREATE_DB
    if [ "$CREATE_DB" = "y" ]; then
        wrangler d1 create recovery_analytics
        echo -e "${YELLOW}⚠ Please update wrangler.toml with the database_id from above${NC}"
        read -p "Press Enter after updating wrangler.toml..."
    fi
fi

# Check if KV namespace exists
echo "Checking KV namespace..."
if wrangler kv:namespace list | grep -q "CACHE"; then
    echo -e "${GREEN}✓ KV namespace exists${NC}"
else
    echo -e "${YELLOW}⚠ KV namespace not found${NC}"
    read -p "Create KV namespace? (y/n): " CREATE_KV
    if [ "$CREATE_KV" = "y" ]; then
        wrangler kv:namespace create "CACHE"
        echo -e "${YELLOW}⚠ Please update wrangler.toml with the KV id from above${NC}"
        read -p "Press Enter after updating wrangler.toml..."
    fi
fi
echo ""

# Step 6: Check secrets
echo -e "${BLUE}Step 6: Checking secrets...${NC}"

SECRETS=$(wrangler secret list 2>/dev/null || echo "")

check_secret() {
    local secret_name=$1
    if echo "$SECRETS" | grep -q "$secret_name"; then
        echo -e "${GREEN}✓ $secret_name is set${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ $secret_name is not set${NC}"
        return 1
    fi
}

MISSING_SECRETS=0

check_secret "WEBHOOK_SECRET" || MISSING_SECRETS=1
check_secret "ZUCKZAPGO_SECRET" || MISSING_SECRETS=1
check_secret "VALID_API_KEYS" || MISSING_SECRETS=1
check_secret "CHATWOOT_TOKEN" || MISSING_SECRETS=1

if [ $MISSING_SECRETS -eq 1 ]; then
    echo ""
    echo -e "${YELLOW}Some secrets are missing. You can set them now or later.${NC}"
    read -p "Set secrets now? (y/n): " SET_SECRETS
    
    if [ "$SET_SECRETS" = "y" ]; then
        echo ""
        echo "Setting secrets..."
        echo "Tip: Generate secure secrets with: openssl rand -hex 32"
        echo ""
        
        if ! echo "$SECRETS" | grep -q "WEBHOOK_SECRET"; then
            wrangler secret put WEBHOOK_SECRET
        fi
        
        if ! echo "$SECRETS" | grep -q "ZUCKZAPGO_SECRET"; then
            wrangler secret put ZUCKZAPGO_SECRET
        fi
        
        if ! echo "$SECRETS" | grep -q "VALID_API_KEYS"; then
            echo "Enter comma-separated API keys (e.g., key1,key2,key3):"
            wrangler secret put VALID_API_KEYS
        fi
        
        if ! echo "$SECRETS" | grep -q "CHATWOOT_TOKEN"; then
            wrangler secret put CHATWOOT_TOKEN
        fi
    fi
fi
echo ""

# Step 7: Apply database migrations
echo -e "${BLUE}Step 7: Applying database migrations...${NC}"

if [ -f "migrations/0001_initial_schema.sql" ]; then
    read -p "Apply migrations to remote database? (y/n): " APPLY_MIGRATIONS
    if [ "$APPLY_MIGRATIONS" = "y" ]; then
        wrangler d1 execute recovery_analytics --remote --file=./migrations/0001_initial_schema.sql
        echo -e "${GREEN}✓ Migrations applied${NC}"
    else
        echo -e "${YELLOW}⚠ Skipped migrations${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No migration file found${NC}"
fi
echo ""

# Step 8: Deploy to Cloudflare
echo -e "${BLUE}Step 8: Deploying to Cloudflare...${NC}"

echo "Select environment:"
echo "1) Development"
echo "2) Staging"
echo "3) Production"
read -p "Enter choice (1-3): " ENV_CHOICE

case $ENV_CHOICE in
    1)
        ENV="development"
        ;;
    2)
        ENV="staging"
        ;;
    3)
        ENV="production"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo "Deploying to $ENV..."
wrangler deploy --env "$ENV"

echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""

# Step 9: Display deployment info
echo -e "${BLUE}Step 9: Deployment Information${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your worker has been deployed!"
echo ""
echo "Next steps:"
echo "1. Test your worker with: curl https://your-worker-url.workers.dev/"
echo "2. Configure n8n webhooks to point to your worker URL"
echo "3. Set up GitHub Actions secrets for automated deployments:"
echo "   - CLOUDFLARE_API_TOKEN"
echo "   - CLOUDFLARE_ACCOUNT_ID"
echo "4. Monitor logs with: wrangler tail --env $ENV"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"
echo ""
echo -e "${GREEN}🎉 Deployment successful!${NC}"
