#!/bin/bash

# Deployment script for Painel Parceiro AI
# Project: painel-parceiroai
# Domain: painel.clubemkt.digital

set -e

echo "🚀 Deploying Painel Parceiro AI to Cloudflare"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Installing...${NC}"
    npm install -g wrangler
fi

# Function to check if logged in to Cloudflare
check_cloudflare_auth() {
    if ! wrangler whoami &> /dev/null; then
        echo -e "${YELLOW}⚠️  Not logged in to Cloudflare. Please login:${NC}"
        wrangler login
    else
        echo -e "${GREEN}✓ Logged in to Cloudflare${NC}"
    fi
}

# Function to create D1 database if it doesn't exist
setup_d1_database() {
    echo -e "\n${BLUE}📊 Setting up D1 Database...${NC}"
    
    # Check if database exists
    if wrangler d1 list | grep -q "painel-parceiroai-db"; then
        echo -e "${GREEN}✓ D1 database already exists${NC}"
    else
        echo -e "${YELLOW}Creating D1 database...${NC}"
        wrangler d1 create painel-parceiroai-db
        echo -e "${YELLOW}⚠️  Please update wrangler.toml with the database_id from above${NC}"
        read -p "Press enter after updating wrangler.toml..."
    fi
    
    # Apply migrations
    echo -e "${BLUE}Applying database migrations...${NC}"
    cd packages/worker
    wrangler d1 migrations apply painel-parceiroai-db --env production
    cd ../..
    echo -e "${GREEN}✓ Database migrations applied${NC}"
}

# Function to create KV namespace if it doesn't exist
setup_kv_namespace() {
    echo -e "\n${BLUE}🗄️  Setting up KV Namespace...${NC}"
    
    if wrangler kv:namespace list | grep -q "painel-parceiroai-cache"; then
        echo -e "${GREEN}✓ KV namespace already exists${NC}"
    else
        echo -e "${YELLOW}Creating KV namespace...${NC}"
        wrangler kv:namespace create "CACHE" --env production
        echo -e "${YELLOW}⚠️  Please update wrangler.toml with the KV namespace id from above${NC}"
        read -p "Press enter after updating wrangler.toml..."
    fi
}

# Function to set secrets
setup_secrets() {
    echo -e "\n${BLUE}🔐 Setting up Secrets...${NC}"
    
    echo -e "${YELLOW}You'll need to set the following secrets:${NC}"
    echo "1. WEBHOOK_SECRET - HMAC secret for n8n webhook validation"
    echo "2. VALID_API_KEYS - Comma-separated list of valid API keys"
    echo "3. CHATWOOT_TOKEN - Authentication token for Chatwoot"
    echo "4. N8N_WEBHOOK_URL - n8n webhook URL for Boleto resend"
    echo ""
    
    read -p "Do you want to set secrets now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd packages/worker
        
        echo -e "${BLUE}Setting WEBHOOK_SECRET...${NC}"
        wrangler secret put WEBHOOK_SECRET --env production
        
        echo -e "${BLUE}Setting VALID_API_KEYS...${NC}"
        wrangler secret put VALID_API_KEYS --env production
        
        echo -e "${BLUE}Setting CHATWOOT_TOKEN...${NC}"
        wrangler secret put CHATWOOT_TOKEN --env production
        
        cd ../..
        echo -e "${GREEN}✓ Secrets configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Remember to set secrets before production use!${NC}"
    fi
}

# Function to deploy Worker
deploy_worker() {
    echo -e "\n${BLUE}⚙️  Deploying Cloudflare Worker...${NC}"
    cd packages/worker
    
    # Build TypeScript
    npm run build
    
    # Deploy to production
    wrangler deploy --env production
    
    cd ../..
    echo -e "${GREEN}✓ Worker deployed successfully${NC}"
    echo -e "${GREEN}Worker URL: https://painel-parceiroai-prod.your-subdomain.workers.dev${NC}"
}

# Function to build and deploy frontend
deploy_frontend() {
    echo -e "\n${BLUE}🎨 Building and deploying Frontend...${NC}"
    cd packages/frontend
    
    # Set production API URL
    export VITE_API_BASE_URL="https://api.painel.clubemkt.digital"
    
    # Build the frontend
    npm run build
    
    # Deploy to Cloudflare Pages
    echo -e "${BLUE}Deploying to Cloudflare Pages...${NC}"
    npx wrangler pages deploy dist --project-name=painel-parceiroai --branch=main
    
    cd ../..
    echo -e "${GREEN}✓ Frontend deployed successfully${NC}"
}

# Function to setup custom domain
setup_custom_domain() {
    echo -e "\n${BLUE}🌐 Setting up Custom Domain...${NC}"
    echo ""
    echo "To configure the custom domain painel.clubemkt.digital:"
    echo ""
    echo "1. Go to Cloudflare Dashboard > Pages > painel-parceiroai"
    echo "2. Click 'Custom domains' tab"
    echo "3. Add custom domain: painel.clubemkt.digital"
    echo "4. Cloudflare will automatically configure DNS"
    echo ""
    echo "For the Worker API (api.painel.clubemkt.digital):"
    echo "1. Go to Cloudflare Dashboard > Workers & Pages > painel-parceiroai-prod"
    echo "2. Click 'Settings' > 'Triggers' > 'Custom Domains'"
    echo "3. Add custom domain: api.painel.clubemkt.digital"
    echo ""
    read -p "Press enter when you've configured the custom domains..."
    echo -e "${GREEN}✓ Custom domain setup instructions provided${NC}"
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting deployment process...${NC}\n"
    
    # Check authentication
    check_cloudflare_auth
    
    # Setup infrastructure
    setup_d1_database
    setup_kv_namespace
    setup_secrets
    
    # Deploy applications
    deploy_worker
    deploy_frontend
    
    # Setup custom domain
    setup_custom_domain
    
    echo -e "\n${GREEN}=============================================="
    echo -e "✅ Deployment Complete!"
    echo -e "==============================================\n${NC}"
    
    echo -e "${BLUE}Access your application at:${NC}"
    echo -e "Frontend: ${GREEN}https://painel.clubemkt.digital${NC}"
    echo -e "API: ${GREEN}https://api.painel.clubemkt.digital${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Test the API endpoints"
    echo "2. Verify the dashboard loads correctly"
    echo "3. Configure n8n webhooks to point to your API"
    echo "4. Test Chatwoot sidebar integration"
    echo ""
    echo -e "${BLUE}For monitoring:${NC}"
    echo "wrangler tail --env production"
}

# Run main function
main
