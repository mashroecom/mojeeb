#!/bin/bash

# Horizontal Scaling Test Script
# This script starts docker-compose with scaled API instances and runs tests

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Use local test configuration (no SSL)
COMPOSE_FILE="docker-compose.scale-test.yml"

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Horizontal Scaling Test - Docker Compose${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n"

# Check if .env file exists (optional for this test)
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo -e "${YELLOW}Using default values from docker-compose.scale-test.yml${NC}\n"
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    docker-compose -f $COMPOSE_FILE down
}

trap cleanup EXIT INT TERM

# Check if services are already running
RUNNING=$(docker-compose -f $COMPOSE_FILE ps --services --filter "status=running" 2>/dev/null || echo "")

if [ -n "$RUNNING" ]; then
    echo -e "${YELLOW}Services are already running. Stopping them first...${NC}"
    docker-compose -f $COMPOSE_FILE down
fi

# Build images if needed
echo -e "${BLUE}Building Docker images...${NC}"
docker-compose -f $COMPOSE_FILE build

# Start services with scaled API instances
echo -e "\n${BLUE}Starting services with 3 API instances...${NC}"
docker-compose -f $COMPOSE_FILE up -d --scale api=3

# Wait for services to be healthy
echo -e "\n${BLUE}Waiting for services to be healthy...${NC}"
sleep 10

# Check service status
echo -e "\n${BLUE}Service Status:${NC}"
docker-compose -f $COMPOSE_FILE ps

# Check API instances
echo -e "\n${BLUE}Checking API instances...${NC}"
API_COUNT=$(docker-compose -f $COMPOSE_FILE ps api | grep -c "Up" || echo "0")
echo -e "API instances running: ${GREEN}${API_COUNT}${NC}"

if [ "$API_COUNT" -ne 3 ]; then
    echo -e "${RED}Error: Expected 3 API instances, found ${API_COUNT}${NC}"
    exit 1
fi

# Check worker service
echo -e "\n${BLUE}Checking worker service...${NC}"
WORKER_RUNNING=$(docker-compose -f $COMPOSE_FILE ps worker | grep -c "Up" || echo "0")
if [ "$WORKER_RUNNING" -eq 1 ]; then
    echo -e "${GREEN}✓ Worker service is running${NC}"
else
    echo -e "${RED}✗ Worker service is not running${NC}"
fi

# Check Redis
echo -e "\n${BLUE}Checking Redis...${NC}"
REDIS_RUNNING=$(docker-compose -f $COMPOSE_FILE ps redis | grep -c "Up" || echo "0")
if [ "$REDIS_RUNNING" -eq 1 ]; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis is not running${NC}"
fi

# Test health endpoints
echo -e "\n${BLUE}Testing health endpoints...${NC}"
for i in 1 2 3; do
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || echo "000")
    if [ "$HEALTH_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ Health check passed (attempt $i)${NC}"
        break
    else
        if [ $i -eq 3 ]; then
            echo -e "${RED}✗ Health check failed after 3 attempts${NC}"
        else
            echo -e "${YELLOW}Waiting for services to be ready...${NC}"
            sleep 5
        fi
    fi
done

# Manual tests
echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Manual Verification Steps${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n"

echo "1. Check API instances are responding:"
echo "   curl http://localhost/health"
echo ""
echo "2. Check Redis connections:"
echo "   docker-compose -f $COMPOSE_FILE logs api | grep 'Redis'"
echo ""
echo "3. Check Socket.IO adapter:"
echo "   docker-compose -f $COMPOSE_FILE logs api | grep 'Socket.IO'"
echo ""
echo "4. Check worker is processing jobs:"
echo "   docker-compose -f $COMPOSE_FILE logs worker"
echo ""
echo "5. View all logs:"
echo "   docker-compose -f $COMPOSE_FILE logs -f"
echo ""
echo "6. Stop all services:"
echo "   docker-compose -f $COMPOSE_FILE down"
echo ""

# Run automated tests if available
if [ -f "scripts/test-horizontal-scaling.ts" ]; then
    echo -e "\n${BLUE}Running automated tests...${NC}"
    pnpm tsx scripts/test-horizontal-scaling.ts || true
fi

echo -e "\n${GREEN}Services are running. Press Ctrl+C to stop and cleanup.${NC}"
echo -e "${YELLOW}Note: Services will be stopped automatically on exit.${NC}\n"

# Keep script running
wait
