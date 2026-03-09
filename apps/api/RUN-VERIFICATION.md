# How to Run Legacy URL Migration Verification

This guide provides step-by-step instructions to verify the legacy URL migration from `/uploads/` to `/files/`.

## Quick Verification (Recommended)

### Option 1: Using the Automated Verification Script

```bash
# Ensure you're in the API directory
cd apps/api  # or wherever your API code is located

# Make sure DATABASE_URL is set (check .env file or parent .env)
# The script will load it automatically

# Run the verification
npx tsx src/scripts/verify-url-migration.ts
```

**Expected Output (Success):**
```
✅ VERIFICATION PASSED: All URLs migrated successfully
Legacy URLs (/uploads/): 0
New URLs (/files/): 150
```

**Expected Output (Needs Migration):**
```
⚠️  Found 25 messages with legacy /uploads/ URLs
❌ VERIFICATION FAILED: Migration incomplete
   Run: npx tsx src/scripts/migrate-file-urls.ts
```

### Option 2: Using Direct SQL Queries

```bash
# Connect to the database using psql
psql $DATABASE_URL

# Run the verification SQL file
\i verify-migration.sql

# Or run individual queries from MIGRATION-VERIFICATION.md
```

### Option 3: Using the pg-based Verification Script

```bash
# First, ensure pg is installed (if not already)
pnpm add pg

# Run the verification
npx tsx src/scripts/run-verification-queries.ts
```

## If Migration is Needed

### Step 1: Dry Run (Preview Changes)

```bash
# See what would be updated without making changes
npx tsx src/scripts/migrate-file-urls.ts --dry-run
```

Review the output to ensure the migration will affect the correct messages.

### Step 2: Run the Migration

```bash
# Execute the actual migration
npx tsx src/scripts/migrate-file-urls.ts
```

**Expected Output:**
```
=== MIGRATION COMPLETE ===
Messages scanned: 150
Messages updated: 150
Errors: 0
```

### Step 3: Verify Migration Success

```bash
# Run verification again
npx tsx src/scripts/verify-url-migration.ts
```

Should now show 0 legacy URLs.

## Manual Testing

### Test 1: View Old Conversation

1. Open the dashboard
2. Navigate to a conversation that had file attachments
3. Verify files display correctly
4. Open browser DevTools → Network tab
5. Confirm file requests go to `/files/` endpoint (not `/uploads/`)
6. Confirm Authorization headers are present in file requests

### Test 2: Upload and Access New Files

**Via Webchat:**
1. Open webchat widget
2. Upload a file (image, document, etc.)
3. Note the returned URL format: `/files/{filename}?token={jwt}`
4. Verify the file displays in the chat
5. Try accessing the URL directly → Should work with token
6. Try accessing without token → Should get 403 Forbidden

**Via Dashboard:**
1. Log in to dashboard
2. Open a conversation
3. Upload a file
4. Verify file displays correctly
5. Check Network tab → Should use Bearer token for authentication

## Troubleshooting

### Problem: Cannot find DATABASE_URL

**Solution:** The DATABASE_URL should be in your `.env` file. Check:
- `/d/mojeeb/.env` (parent project)
- `./env` (current directory)
- Or export it: `export DATABASE_URL="postgresql://..."`

### Problem: Prisma client errors

**Solution:** Generate Prisma client:
```bash
# From parent project root
cd /d/mojeeb
npx prisma generate

# Or from apps/api
cd apps/api
npx prisma generate
```

### Problem: Module not found errors

**Solution:** Install dependencies:
```bash
pnpm install
```

### Problem: Permission denied errors

**Solution:** Check database connection string has correct credentials:
```
DATABASE_URL="postgresql://username:password@host:port/database"
```

## Verification Checklist

Use this checklist to confirm all verification steps are complete:

- [ ] Run verification script → 0 legacy URLs
- [ ] Check database directly → No /uploads/ URLs found
- [ ] Test old conversation → Files display correctly
- [ ] Test new upload via webchat → Uses /files/ with token
- [ ] Test new upload via dashboard → Uses /files/ endpoint
- [ ] Test unauthorized access → Returns 403
- [ ] Test authenticated access → Returns 200
- [ ] Check no express.static route exists in app.ts
- [ ] Verify all /files routes have validateFileAccess middleware

## Success Criteria

✅ **Migration is successful when:**
1. Database query returns 0 messages with `/uploads/` URLs
2. All file messages use `/files/` prefix
3. Old conversations display files correctly
4. New file uploads work with authentication
5. Unauthorized file access is blocked (403)
6. No static file serving route exists

## Files Created for Verification

1. `src/scripts/verify-url-migration.ts` - Automated verification using Prisma
2. `src/scripts/run-verification-queries.ts` - Direct SQL verification using pg
3. `verify-migration.sql` - SQL queries for manual verification
4. `MIGRATION-VERIFICATION.md` - Comprehensive verification documentation
5. `RUN-VERIFICATION.md` (this file) - Step-by-step execution guide

## Need Help?

If verification fails or you encounter issues:

1. Check the logs in `src/scripts/migrate-file-urls.ts` output
2. Review `MIGRATION-VERIFICATION.md` for detailed troubleshooting
3. Run queries from `verify-migration.sql` manually to investigate
4. Check that the file access middleware is properly configured
