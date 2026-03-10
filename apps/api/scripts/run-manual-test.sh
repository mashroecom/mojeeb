#!/bin/bash

# Manual Test Runner for CSV Export Streaming
# This script automates the manual testing process

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CSV Export Streaming - Manual Test Runner                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not found. Please install pnpm first.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Prerequisites check passed"
echo ""

# Check if database is accessible
echo "🔍 Checking database connection..."
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set. Using .env file if available.${NC}"
fi

# Step 1: Seed test data
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Seeding 10K test conversations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

pnpm tsx scripts/seed-10k-conversations.ts

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Seed failed. Cannot proceed with testing.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Seed completed successfully${NC}"
echo ""

# Step 2: Check if dev server is running
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Checking dev server status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

API_URL="${API_URL:-http://localhost:3000}"

if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Dev server is running at $API_URL"
else
    echo -e "${YELLOW}⚠️  Dev server not detected at $API_URL${NC}"
    echo ""
    echo "Please start the dev server in a separate terminal:"
    echo "  cd apps/api && pnpm dev"
    echo ""
    echo "Press Enter when server is ready, or Ctrl+C to cancel..."
    read

    # Check again
    if ! curl -s -f "$API_URL/health" > /dev/null 2>&1; then
        echo -e "${RED}❌ Server still not accessible. Please start the server first.${NC}"
        exit 1
    fi
fi

echo ""

# Step 3: Run automated performance test
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Running streaming performance test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ORG_ID=test-org-10k API_URL=$API_URL pnpm tsx scripts/test-export-streaming.ts

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ Performance test failed. See details above.${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All manual tests completed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test Summary:"
echo "  ✅ 10K conversations seeded"
echo "  ✅ CSV export streaming verified"
echo "  ✅ Server responsiveness confirmed"
echo "  ✅ No event loop blocking detected"
echo ""
echo "For detailed manual testing steps, see:"
echo "  apps/api/scripts/MANUAL_TEST_GUIDE.md"
echo ""
