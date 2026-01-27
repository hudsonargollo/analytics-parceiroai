#!/bin/bash

# Webhook Testing Script
# This script tests the payment and engagement webhook endpoints
# 
# Prerequisites:
# 1. Worker must be running (npm run dev)
# 2. Set WEBHOOK_SECRET environment variable
#
# Usage:
#   export WEBHOOK_SECRET="your-secret-here"
#   ./test-webhooks.sh

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WORKER_URL="${WORKER_URL:-http://localhost:8787}"
SECRET="${WEBHOOK_SECRET:-test-secret-key}"

echo "=================================================="
echo "  Webhook Testing Script"
echo "=================================================="
echo ""
echo "Worker URL: $WORKER_URL"
echo "Using secret: ${SECRET:0:10}..."
echo ""

# Function to compute HMAC-SHA256 signature
compute_signature() {
    local payload="$1"
    local secret="$2"
    echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" | cut -d' ' -f2
}

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local endpoint="$2"
    local payload="$3"
    
    echo "Testing: $name"
    echo "Endpoint: $endpoint"
    echo "Payload: $payload"
    
    # Compute signature
    signature=$(compute_signature "$payload" "$SECRET")
    echo "Signature: ${signature:0:20}..."
    
    # Send request
    response=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL$endpoint" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Signature: $signature" \
        -d "$payload")
    
    # Extract status code and body
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    # Check result
    if [ "$http_code" = "202" ]; then
        echo -e "${GREEN}✓ PASS${NC} - HTTP $http_code"
        echo "Response: $body"
    else
        echo -e "${RED}✗ FAIL${NC} - HTTP $http_code"
        echo "Response: $body"
    fi
    
    echo ""
}

# Test 1: Health check
echo "=================================================="
echo "Test 0: Health Check"
echo "=================================================="
echo ""

health_response=$(curl -s "$WORKER_URL/")
echo "Response: $health_response"
echo ""

# Test 1: Payment webhook - 3-day notice
echo "=================================================="
echo "Test 1: Payment Webhook - 3-day Notice"
echo "=================================================="
echo ""

# Calculate date 3 days from now
due_date=$(date -u -v+3d +"%Y-%m-%d" 2>/dev/null || date -u -d "+3 days" +"%Y-%m-%d")
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

payload1=$(cat <<EOF
{
  "event_id": "evt_test_001",
  "customer_id": "cust_test_001",
  "invoice_id": "inv_test_001",
  "amount": 5000,
  "payment_method": "pix",
  "status": "pending",
  "due_date": "$due_date",
  "timestamp": "$timestamp"
}
EOF
)

test_endpoint "Payment - 3-day notice" "/webhooks/payment" "$payload1"

# Test 2: Payment webhook - due today
echo "=================================================="
echo "Test 2: Payment Webhook - Due Today"
echo "=================================================="
echo ""

due_date_today=$(date -u +"%Y-%m-%d")

payload2=$(cat <<EOF
{
  "event_id": "evt_test_002",
  "customer_id": "cust_test_002",
  "invoice_id": "inv_test_002",
  "amount": 3000,
  "payment_method": "boleto",
  "status": "pending",
  "due_date": "$due_date_today",
  "timestamp": "$timestamp"
}
EOF
)

test_endpoint "Payment - Due today" "/webhooks/payment" "$payload2"

# Test 3: Payment webhook - overdue
echo "=================================================="
echo "Test 3: Payment Webhook - Overdue"
echo "=================================================="
echo ""

due_date_past=$(date -u -v-5d +"%Y-%m-%d" 2>/dev/null || date -u -d "-5 days" +"%Y-%m-%d")

payload3=$(cat <<EOF
{
  "event_id": "evt_test_003",
  "customer_id": "cust_test_003",
  "invoice_id": "inv_test_003",
  "amount": 7500,
  "payment_method": "credit_card",
  "status": "pending",
  "due_date": "$due_date_past",
  "timestamp": "$timestamp"
}
EOF
)

test_endpoint "Payment - Overdue" "/webhooks/payment" "$payload3"

# Test 4: Engagement webhook - delivered
echo "=================================================="
echo "Test 4: Engagement Webhook - Delivered"
echo "=================================================="
echo ""

payload4=$(cat <<EOF
{
  "message_id": "msg_test_001",
  "customer_id": "cust_test_001",
  "status": "delivered",
  "timestamp": "$timestamp"
}
EOF
)

test_endpoint "Engagement - Delivered" "/webhooks/engagement" "$payload4"

# Test 5: Engagement webhook - read
echo "=================================================="
echo "Test 5: Engagement Webhook - Read"
echo "=================================================="
echo ""

payload5=$(cat <<EOF
{
  "message_id": "msg_test_002",
  "customer_id": "cust_test_002",
  "status": "read",
  "timestamp": "$timestamp"
}
EOF
)

test_endpoint "Engagement - Read" "/webhooks/engagement" "$payload5"

# Test 6: Invalid signature (should fail)
echo "=================================================="
echo "Test 6: Invalid Signature (Should Fail)"
echo "=================================================="
echo ""

echo "Testing: Invalid signature"
echo "Endpoint: /webhooks/payment"

response=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/webhooks/payment" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Signature: invalid-signature-12345" \
    -d "$payload1")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "401" ]; then
    echo -e "${GREEN}✓ PASS${NC} - HTTP $http_code (correctly rejected)"
    echo "Response: $body"
else
    echo -e "${RED}✗ FAIL${NC} - HTTP $http_code (should be 401)"
    echo "Response: $body"
fi

echo ""

# Test 7: Duplicate event (should fail)
echo "=================================================="
echo "Test 7: Duplicate Event (Should Fail)"
echo "=================================================="
echo ""

echo "Sending same event_id twice..."
test_endpoint "Duplicate - First attempt" "/webhooks/payment" "$payload1"

echo "Second attempt (should fail with 409):"
signature=$(compute_signature "$payload1" "$SECRET")
response=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/webhooks/payment" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Signature: $signature" \
    -d "$payload1")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "409" ]; then
    echo -e "${GREEN}✓ PASS${NC} - HTTP $http_code (correctly rejected duplicate)"
    echo "Response: $body"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - HTTP $http_code (expected 409 for duplicate)"
    echo "Response: $body"
fi

echo ""

# Summary
echo "=================================================="
echo "  Test Summary"
echo "=================================================="
echo ""
echo "All webhook tests completed!"
echo ""
echo "Next steps:"
echo "1. Check the worker logs for any errors"
echo "2. Query the D1 database to verify data was stored:"
echo "   wrangler d1 execute recovery_analytics --command \"SELECT * FROM payment_events\""
echo "   wrangler d1 execute recovery_analytics --command \"SELECT * FROM engagement_events\""
echo ""
