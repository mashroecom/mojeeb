-- Legacy URL Migration Verification Queries
-- Run these queries directly against the PostgreSQL database

-- ============================================================================
-- 1. CHECK FOR LEGACY URLs (/uploads/)
-- ============================================================================
-- Expected Result: 0 rows (all URLs should be migrated)

SELECT COUNT(*) as legacy_url_count
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
  AND content LIKE '%/uploads/%';

-- If this returns > 0, migration is incomplete
-- Run: npx tsx src/scripts/migrate-file-urls.ts


-- ============================================================================
-- 2. CHECK FOR NEW URLs (/files/)
-- ============================================================================
-- Expected Result: Count should equal total file messages

SELECT COUNT(*) as new_url_count
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
  AND content LIKE '%/files/%';


-- ============================================================================
-- 3. TOTAL FILE MESSAGES BY TYPE
-- ============================================================================
-- Shows distribution of file types in database

SELECT
  "contentType",
  COUNT(*) as total_count,
  SUM(CASE WHEN content LIKE '%/files/%' THEN 1 ELSE 0 END) as migrated_count,
  SUM(CASE WHEN content LIKE '%/uploads/%' THEN 1 ELSE 0 END) as legacy_count
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
GROUP BY "contentType"
ORDER BY "contentType";


-- ============================================================================
-- 4. SAMPLE LEGACY URLs (if any exist)
-- ============================================================================
-- Shows examples of messages that still need migration

SELECT
  id,
  "contentType",
  LEFT(content, 100) as content_preview,
  "conversationId",
  "createdAt"
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
  AND content LIKE '%/uploads/%'
ORDER BY "createdAt" DESC
LIMIT 10;


-- ============================================================================
-- 5. RECENT FILE MESSAGES
-- ============================================================================
-- Shows recent file messages to verify they use new format

SELECT
  id,
  "contentType",
  LEFT(content, 100) as content_preview,
  "createdAt"
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
ORDER BY "createdAt" DESC
LIMIT 10;


-- ============================================================================
-- 6. VERIFICATION SUMMARY
-- ============================================================================
-- Single query that shows overall migration status

SELECT
  COUNT(*) as total_file_messages,
  SUM(CASE WHEN content LIKE '%/files/%' THEN 1 ELSE 0 END) as migrated_to_files,
  SUM(CASE WHEN content LIKE '%/uploads/%' THEN 1 ELSE 0 END) as still_legacy,
  ROUND(
    (SUM(CASE WHEN content LIKE '%/files/%' THEN 1 ELSE 0 END)::FLOAT /
     NULLIF(COUNT(*), 0) * 100),
    2
  ) as migration_percentage
FROM "Message"
WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO');

-- Expected Result:
-- migration_percentage = 100.00
-- still_legacy = 0
