# Legacy URL Migration Verification

This document outlines the verification steps for the file URL migration from `/uploads/` to `/files/`.

## Overview

The migration updates all file URLs in the database from the old static route (`/uploads/`) to the new authenticated endpoint (`/files/`). This affects all messages with file attachments.

## Verification Steps

### 1. Database Query Verification

Run these SQL queries directly against the database to verify the migration:

#### Check for Legacy URLs

```sql
-- Should return 0 after migration is complete
SELECT COUNT(*) as legacy_url_count
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
  AND content LIKE '%/uploads/%';
```

**Expected Result:** `legacy_url_count = 0`

#### Check for New URLs

```sql
-- Should return all file messages after migration
SELECT COUNT(*) as new_url_count
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
  AND content LIKE '%/files/%';
```

**Expected Result:** `new_url_count > 0` (equal to total file messages)

#### Sample Legacy URLs (if any exist)

```sql
-- Find examples of messages that still need migration
SELECT
  id,
  "contentType",
  content,
  "conversationId",
  "createdAt"
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
  AND content LIKE '%/uploads/%'
ORDER BY "createdAt" DESC
LIMIT 10;
```

**Expected Result:** No rows returned after migration

#### Total File Messages

```sql
-- Get total count of all file messages
SELECT
  "contentType",
  COUNT(*) as count
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
GROUP BY "contentType";
```

### 2. Run Migration Script

If legacy URLs are found, run the migration script:

```bash
# Dry run to see what would be updated
npx tsx src/scripts/migrate-file-urls.ts --dry-run

# Run the actual migration
npx tsx src/scripts/migrate-file-urls.ts
```

### 3. Run Verification Script

After migration, verify using the automated script:

```bash
npx tsx src/scripts/verify-url-migration.ts
```

**Expected Output:**
```
✅ VERIFICATION PASSED: All URLs migrated successfully
Legacy URLs (/uploads/): 0
New URLs (/files/): [count of file messages]
```

### 4. Manual Testing

#### Test Scenario 1: View Old Conversation with Migrated Files

1. Find a conversation that had file attachments before the migration
2. Open the conversation in the dashboard
3. Verify that all file attachments (images, documents, PDFs) display correctly
4. Check browser network tab to confirm files are being served from `/files/` endpoint
5. Verify that authentication headers are being sent with file requests

#### Test Scenario 2: Access File with Authentication

1. Get a file URL from a message: `/files/{filename}?token={jwt}`
2. Try to access the file with a valid token → **Should succeed (200)**
3. Try to access the file without token → **Should fail (401/403)**
4. Try to access the file with expired token → **Should fail (401)**

#### Test Scenario 3: Visitor File Access

1. As a visitor, upload a file through the webchat widget
2. Verify the returned URL uses `/files/` prefix with signed token
3. Access the file using the signed token → **Should succeed (200)**
4. Try to access another visitor's file → **Should fail (403)**

### 5. Security Verification

Run these checks to ensure the migration improved security:

#### No Static File Route

```bash
# Should output "OK" - no static route should exist
grep -q 'express.static.*uploads' src/app.ts && echo 'ERROR: Static route still exists' || echo 'OK'
```

**Expected Result:** `OK`

#### All File Routes Protected

```bash
# Verify all /files routes use authentication middleware
grep -A5 '/files' src/routes/index.ts src/routes/files.routes.ts
```

**Expected Result:** All routes should have `validateFileAccess` middleware

### 6. Performance Testing

Test that file serving still works efficiently:

1. Upload a large file (> 10MB)
2. Verify download works with proper Content-Type headers
3. Test video/audio streaming with range requests
4. Check response times are acceptable (< 500ms for initial request)

## Success Criteria

✅ All checks must pass:

- [ ] Database query shows 0 legacy URLs
- [ ] Database query shows all file messages use `/files/` prefix
- [ ] Verification script exits with code 0
- [ ] Old conversations display files correctly
- [ ] File access requires authentication or valid token
- [ ] No static file serving route exists in `app.ts`
- [ ] All file routes are protected by `validateFileAccess` middleware
- [ ] File serving performance is acceptable

## Rollback Procedure

If issues are found after migration:

1. The migration is reversible - URLs can be updated back:
   ```sql
   UPDATE "Message"
   SET content = REPLACE(content, '/files/', '/uploads/')
   WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
     AND content LIKE '%/files/%';
   ```

2. Re-enable static file serving in `app.ts` (not recommended for security)

## Notes

- The migration is idempotent - safe to run multiple times
- Signed tokens expire after 7 days for visitor files
- Authenticated users can access files using Bearer tokens
- Public files (logo-, favicon-, landing- prefixes) don't require authentication
- Organization members can access files from their org's conversations

## Troubleshooting

### Issue: Migration script fails with Prisma errors

**Solution:** Ensure database connection is configured in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/database"
```

### Issue: Files return 403 after migration

**Solution:** Check that:
1. User has valid authentication token
2. User has access to the conversation containing the file
3. Token hasn't expired (7 days for visitor tokens)

### Issue: Some URLs still show /uploads/

**Solution:** Run the migration script again - it's idempotent and will catch any missed URLs.
