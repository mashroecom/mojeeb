#!/bin/bash
# Verify that Prisma Client is in sync with the schema

set -e

echo "Verifying Prisma Client is up to date..."

# Check if source schema exists
if [ ! -f "prisma/schema.prisma" ]; then
  echo "❌ ERROR: prisma/schema.prisma not found"
  exit 1
fi

# Find generated schema (handle pnpm's symlink structure)
# Look for .prisma/client/schema.prisma which is where Prisma generates it
GENERATED_SCHEMA=$(find node_modules -name "schema.prisma" -path "*/.prisma/client/schema.prisma" 2>/dev/null | head -1)

if [ -z "$GENERATED_SCHEMA" ]; then
  echo "❌ ERROR: Prisma Client not generated"
  echo "   Run: pnpm db:generate"
  exit 1
fi

# Count lines in source schema
SOURCE_LINES=$(wc -l < prisma/schema.prisma | tr -d ' ')

# Count lines in generated schema
GENERATED_LINES=$(wc -l < "$GENERATED_SCHEMA" | tr -d ' ')

# Compare line counts
if [ "$SOURCE_LINES" != "$GENERATED_LINES" ]; then
  echo "❌ ERROR: Prisma Client is out of sync!"
  echo "   Source schema: $SOURCE_LINES lines"
  echo "   Generated schema: $GENERATED_LINES lines"
  echo ""
  echo "   Fix: Run 'pnpm db:generate' to regenerate the client"
  exit 1
fi

echo "✅ Prisma Client is up to date ($SOURCE_LINES lines)"
echo "   Source: prisma/schema.prisma"
echo "   Generated: $GENERATED_SCHEMA"
exit 0
