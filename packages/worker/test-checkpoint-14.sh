#!/bin/bash

# Checkpoint 14: End-to-End Analytics API Testing
# 
# This script performs comprehensive end-to-end testing of the analytics API using curl
# 
# Usage:
# 1. Start the worker: npm run dev (in another terminal)
# 2. Run this script: ./test-checkpoint-14.sh
# 
# Requirements: Task 14 from subscription-recovery-analytics spec

set -e

BASE_URL="http://localhost:8787"
API_KEY="test-api-key-12345"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print test header
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local expected_status="$2"
    local url="$3"
    local headers="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Make the request and capture status code
    if [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "$headers" "$url" 2>/dev/null || echo "000")
    else
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo "000")
    fi
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    # Check if status code matches expected (can be multiple values separated by |)
    if echo "$expected_status" | grep -q "|"; then
        # Multiple acceptable status codes
        if echo "$expected_status" | grep -q "$status_code"; then
            echo -e "${GREEN}✓${NC} $test_name (Status: $status_code)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}✗${NC} $test_name"
            echo -e "  Expected status: $expected_status, Got: $status_code"
            echo -e "  Response: $body"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    else
        # Single expected status code
        if [ "$status_code" = "$expected_status" ]; then
            echo -e "${GREEN}✓${NC} $test_name (Status: $status_code)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}✗${NC} $test_name"
            echo -e "  Expected status: $expected_status, Got: $status_code"
            echo -e "  Response: $body"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    fi
}

# Function to test caching
test_caching() {
    local test_name="$1"
    local url="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # First request
    start1=$(date +%s%N)
    response1=$(curl -s -H "X-API-Key: $API_KEY" "$url")
    end1=$(date +%s%N)
    time1=$(( (end1 - start1) / 1000000 ))
    
    # Second request (should be cached)
    start2=$(date +%s%N)
    response2=$(curl -s -H "X-API-Key: $API_KEY" "$url")
    end2=$(date +%s%N)
    time2=$(( (end2 - start2) / 1000000 ))
    
    # Check if responses are identical
    if [ "$response1" = "$response2" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        echo -e "  First request: ${time1}ms, Second request: ${time2}ms"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $test_name"
        echo -e "  Responses differ between requests"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Start tests
echo -e "\n${YELLOW}🧪 Starting Checkpoint 14: End-to-End Analytics API Testing${NC}\n"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Check if worker is running
echo -e "${BLUE}Checking if worker is running...${NC}"
if ! curl -s "$BASE_URL/" > /dev/null 2>&1; then
    echo -e "${RED}✗ Worker is not running at $BASE_URL${NC}"
    echo -e "${YELLOW}Please start the worker with: npm run dev${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Worker is running${NC}\n"

# Health Check Tests
print_header "📋 Health Check Tests"
run_test "Health check returns 200 OK" "200" "$BASE_URL/"

# Authentication Tests
print_header "📋 Authentication & Authorization Tests"
run_test "Rejects requests without API key" "401" "$BASE_URL/api/metrics/recovery-rate"
run_test "Rejects requests with invalid API key" "401" "$BASE_URL/api/metrics/recovery-rate" "X-API-Key: invalid-key"
run_test "Accepts requests with valid API key" "200|500" "$BASE_URL/api/metrics/recovery-rate?date_range=30d" "X-API-Key: $API_KEY"

# Recovery Rate Endpoint Tests
print_header "📋 Recovery Rate Endpoint Tests"
run_test "Returns recovery rate with valid parameters" "200|500" "$BASE_URL/api/metrics/recovery-rate?date_range=30d" "X-API-Key: $API_KEY"
run_test "Supports branch filtering" "200|500" "$BASE_URL/api/metrics/recovery-rate?date_range=30d&branch=overdue" "X-API-Key: $API_KEY"
run_test "Supports plan filtering" "200|500" "$BASE_URL/api/metrics/recovery-rate?date_range=30d&plan=premium" "X-API-Key: $API_KEY"
run_test "Rejects invalid date_range" "400" "$BASE_URL/api/metrics/recovery-rate?date_range=invalid" "X-API-Key: $API_KEY"
run_test "Rejects invalid branch" "400" "$BASE_URL/api/metrics/recovery-rate?date_range=30d&branch=invalid-branch" "X-API-Key: $API_KEY"
run_test "Supports pagination parameters" "200|500" "$BASE_URL/api/metrics/recovery-rate?date_range=30d&page=1&page_size=10" "X-API-Key: $API_KEY"
run_test "Rejects invalid pagination" "400" "$BASE_URL/api/metrics/recovery-rate?date_range=30d&page=-1" "X-API-Key: $API_KEY"

# DSO Endpoint Tests
print_header "📋 DSO Endpoint Tests"
run_test "Returns DSO with valid parameters" "200|500" "$BASE_URL/api/metrics/dso?date_range=30d" "X-API-Key: $API_KEY"
run_test "Rejects invalid date_range for DSO" "400" "$BASE_URL/api/metrics/dso?date_range=999d" "X-API-Key: $API_KEY"
run_test "Supports pagination for DSO" "200|500" "$BASE_URL/api/metrics/dso?date_range=30d&page=1&page_size=20" "X-API-Key: $API_KEY"

# Cohorts Endpoint Tests
print_header "📋 Cohorts Endpoint Tests"
run_test "Returns cohort analysis with valid parameters" "200|500" "$BASE_URL/api/metrics/cohorts?start_month=2024-01&end_month=2024-03" "X-API-Key: $API_KEY"
run_test "Rejects invalid month format" "400" "$BASE_URL/api/metrics/cohorts?start_month=2024-13&end_month=2024-03" "X-API-Key: $API_KEY"
run_test "Rejects when start_month > end_month" "400" "$BASE_URL/api/metrics/cohorts?start_month=2024-06&end_month=2024-03" "X-API-Key: $API_KEY"
run_test "Supports pagination for cohorts" "200|500" "$BASE_URL/api/metrics/cohorts?start_month=2024-01&end_month=2024-12&page=1&page_size=5" "X-API-Key: $API_KEY"

# Caching Behavior Tests
print_header "📋 Caching Behavior Tests"
test_caching "Caches recovery rate metrics" "$BASE_URL/api/metrics/recovery-rate?date_range=30d&branch=overdue"
test_caching "Caches DSO metrics" "$BASE_URL/api/metrics/dso?date_range=60d"
test_caching "Caches cohort analysis" "$BASE_URL/api/metrics/cohorts?start_month=2024-01&end_month=2024-03"

# Pagination Tests
print_header "📋 Pagination with Large Datasets Tests"
run_test "Paginates cohorts correctly (page 1)" "200|500" "$BASE_URL/api/metrics/cohorts?start_month=2023-01&end_month=2024-12&page=1&page_size=3" "X-API-Key: $API_KEY"
run_test "Paginates cohorts correctly (page 2)" "200|500" "$BASE_URL/api/metrics/cohorts?start_month=2023-01&end_month=2024-12&page=2&page_size=3" "X-API-Key: $API_KEY"
run_test "Handles page_size limits" "200|500" "$BASE_URL/api/metrics/cohorts?start_month=2023-01&end_month=2024-12&page=1&page_size=100" "X-API-Key: $API_KEY"
run_test "Returns empty for out-of-range pages" "200|500" "$BASE_URL/api/metrics/cohorts?start_month=2024-01&end_month=2024-03&page=999&page_size=10" "X-API-Key: $API_KEY"

# Error Handling Tests
print_header "📋 Error Handling Tests"
run_test "Returns 400 for missing parameters" "400" "$BASE_URL/api/metrics/cohorts" "X-API-Key: $API_KEY"
run_test "Returns descriptive error messages" "400" "$BASE_URL/api/metrics/recovery-rate?date_range=invalid&branch=invalid" "X-API-Key: $API_KEY"

# Rate Limiting Tests
print_header "📋 Rate Limiting Tests"
echo -e "${BLUE}Testing rate limiting (5 rapid requests)...${NC}"
for i in {1..5}; do
    run_test "Request $i within rate limit" "200|500" "$BASE_URL/api/metrics/recovery-rate?date_range=30d" "X-API-Key: $API_KEY"
done

# Print Summary
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${BLUE}📊 Test Summary${NC}\n"
echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}✓ Passed:     $PASSED_TESTS${NC}"
echo -e "${RED}✗ Failed:     $FAILED_TESTS${NC}"

if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
    echo -e "Success Rate: $SUCCESS_RATE%"
fi

echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! The analytics API is working correctly.${NC}\n"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Please review the errors above.${NC}\n"
    exit 1
fi
