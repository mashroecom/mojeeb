#!/bin/bash
##
# Load Test Runner Script
#
# This script provides an easy way to run load tests with different configurations.
# It handles prerequisites, environment setup, and provides helpful output.
#
# Usage:
#   ./scripts/run-load-test.sh [scenario]
#
# Scenarios:
#   baseline    - 1,000 connections (quick verification)
#   standard    - 10,000 connections (acceptance criteria)
#   stress      - 20,000 connections (find limits)
#   spike       - 10,000 connections with rapid ramp-up
#   custom      - Custom parameters (uses CLI args)
##

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print colored message
log() {
  echo -e "${2}${1}${NC}"
}

log_success() {
  log "✓ $1" "$GREEN"
}

log_error() {
  log "✗ $1" "$RED"
}

log_warning() {
  log "⚠ $1" "$YELLOW"
}

log_info() {
  log "ℹ $1" "$CYAN"
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  # Check Node.js
  if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Please install Node.js 20+"
    exit 1
  fi
  log_success "Node.js $(node --version)"

  # Check pnpm
  if ! command -v pnpm &> /dev/null; then
    log_error "pnpm not found. Please install pnpm"
    exit 1
  fi
  log_success "pnpm $(pnpm --version)"

  # Check if .env exists
  if [ ! -f .env ]; then
    log_warning ".env file not found"
    log_info "Creating .env from .env.example..."
    cp .env.example .env
    log_warning "Please update TEST_USER_EMAIL and TEST_USER_PASSWORD in .env"
  fi

  # Check if API is running
  log_info "Checking if API is running..."
  API_URL="${API_URL:-http://localhost:80}"

  if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    log_success "API is running at $API_URL"
  else
    log_error "API is not running at $API_URL"
    log_info "Start the services first:"
    log_info "  docker-compose -f docker-compose.scale-test.yml up -d --scale api=3"
    exit 1
  fi

  # Check dependencies
  if [ ! -d "node_modules" ]; then
    log_info "Installing dependencies..."
    pnpm install
  fi

  log_success "All prerequisites met"
  echo ""
}

# Run load test with specified parameters
run_test() {
  local scenario=$1
  shift
  local extra_args="$@"

  log_info "Running $scenario load test..."
  echo ""

  # Source .env if it exists
  if [ -f .env ]; then
    export $(cat .env | grep -E '^(TEST_USER_EMAIL|TEST_USER_PASSWORD|TEST_ORG_ID|API_URL)=' | xargs)
  fi

  # Run the test
  pnpm tsx scripts/load-test.ts $extra_args
}

# Main script
main() {
  local scenario="${1:-standard}"

  echo ""
  log "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  log "${BLUE}  Mojeeb Platform - Load Test Runner${NC}"
  log "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo ""

  check_prerequisites

  case "$scenario" in
    baseline)
      log_info "Scenario: Baseline Test (1,000 connections)"
      log_info "Purpose: Quick verification that system works before scaling"
      echo ""
      run_test "baseline" --connections 1000 --ramp-up 30 --duration 60
      ;;

    standard)
      log_info "Scenario: Standard Test (10,000 connections)"
      log_info "Purpose: Main acceptance criteria test"
      echo ""
      run_test "standard" --connections 10000 --ramp-up 60 --duration 300
      ;;

    stress)
      log_info "Scenario: Stress Test (20,000 connections)"
      log_info "Purpose: Find system breaking point"
      echo ""
      run_test "stress" --connections 20000 --ramp-up 120 --duration 600
      ;;

    spike)
      log_info "Scenario: Spike Test (10,000 connections, rapid ramp-up)"
      log_info "Purpose: Test sudden traffic spike handling"
      echo ""
      run_test "spike" --connections 10000 --ramp-up 10 --duration 300
      ;;

    custom)
      log_info "Scenario: Custom Test"
      log_info "Using command-line arguments"
      echo ""
      shift
      run_test "custom" "$@"
      ;;

    help|--help|-h)
      echo "Usage: $0 [scenario] [options]"
      echo ""
      echo "Scenarios:"
      echo "  baseline    - 1,000 connections (30s ramp-up, 60s duration)"
      echo "  standard    - 10,000 connections (60s ramp-up, 300s duration)"
      echo "  stress      - 20,000 connections (120s ramp-up, 600s duration)"
      echo "  spike       - 10,000 connections (10s ramp-up, 300s duration)"
      echo "  custom      - Custom parameters (pass options after 'custom')"
      echo ""
      echo "Custom Options:"
      echo "  --connections <number>   Number of concurrent connections"
      echo "  --ramp-up <seconds>      Ramp-up time to reach target"
      echo "  --duration <seconds>     Test duration after ramp-up"
      echo "  --api-url <url>          API URL"
      echo "  --batch-size <number>    Connections per batch"
      echo "  --message-interval <ms>  Message send interval"
      echo ""
      echo "Examples:"
      echo "  $0 baseline"
      echo "  $0 standard"
      echo "  $0 custom --connections 5000 --ramp-up 30 --duration 120"
      echo ""
      exit 0
      ;;

    *)
      log_error "Unknown scenario: $scenario"
      echo ""
      echo "Available scenarios: baseline, standard, stress, spike, custom, help"
      echo "Run '$0 help' for more information"
      exit 1
      ;;
  esac

  local exit_code=$?
  echo ""

  if [ $exit_code -eq 0 ]; then
    log_success "Load test completed successfully!"
  else
    log_error "Load test failed (exit code: $exit_code)"
  fi

  exit $exit_code
}

# Run main
main "$@"
