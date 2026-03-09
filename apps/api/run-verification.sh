#!/bin/bash

# Script to run URL migration verification
# This script loads the DATABASE_URL from parent .env and runs verification

set -e

echo "🔍 Legacy URL Migration Verification"
echo "===================================="
echo ""

# Check if parent .env exists
if [ -f "/d/mojeeb/.env" ]; then
    echo "✓ Found parent .env file"
    # Source the .env file
    set -a
    source /d/mojeeb/.env
    set +a
else
    echo "❌ .env file not found at /d/mojeeb/.env"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in environment"
    exit 1
fi

echo "✓ DATABASE_URL is configured"
echo ""

# Run the verification script
echo "Running verification script..."
echo ""

npx tsx src/scripts/verify-url-migration.ts

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ Verification completed successfully"
else
    echo ""
    echo "❌ Verification failed (exit code: $exit_code)"
fi

exit $exit_code
