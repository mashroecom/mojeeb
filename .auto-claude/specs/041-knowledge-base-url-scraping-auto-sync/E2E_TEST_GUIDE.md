# End-to-End Testing Guide: Knowledge Base URL Crawling

## Overview

This guide covers comprehensive E2E testing for the URL crawling feature, including both automated script testing and manual UI verification.

## Prerequisites

Before running tests, ensure:

1. **Services Running:**
   - PostgreSQL database (port 5432)
   - Redis (port 6379)
   - API server (port 4000)
   - Worker process (for background crawl jobs)
   - Frontend (port 3000)

2. **Environment Setup:**
   - `.env` file configured with all required credentials
   - `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` set (for embeddings)
   - Database migrations applied: `pnpm db:push`

## Part 1: Automated Test Script

### Running the Test

```bash
# From project root
tsx test-crawl-e2e.ts
```

### What the Script Tests

The automated script (`test-crawl-e2e.ts`) verifies:

1. ✅ **Test Data Creation**
   - Creates test user, organization, and knowledge base

2. ✅ **Single Page Crawl**
   - Crawls https://example.com
   - Verifies document is created with extracted content
   - Checks content length and quality

3. ✅ **Chunks Generation**
   - Verifies chunks are created from the document
   - Confirms embeddings are generated for each chunk

4. ✅ **Semantic Search**
   - Performs search query: "example domain"
   - Verifies search results are relevant and indexed

5. ✅ **Robots.txt Respect**
   - Tests robots.txt parsing and validation
   - Ensures crawler respects robots.txt rules

6. ✅ **Arabic Content Support**
   - Tests HTML extraction with Arabic text
   - Verifies UTF-8 encoding and RTL text handling

### Expected Output

```
========================================
Knowledge Base URL Crawling E2E Test
========================================

✓ 1. Create Test User: Test user created
✓ 2. Create Test Organization: Test organization created
✓ 3. Create Knowledge Base: Knowledge base created
✓ 4. Crawl Single Page: Page crawled and document created
✓ 5. Verify Chunks Generated: Chunks created with embeddings
✓ 6. Semantic Search: Content is searchable and indexed
✓ 7. Robots.txt Respect: Robots.txt checked successfully
✓ 8. Arabic Content Support: Arabic content extracted correctly

========================================
Test Summary
========================================

Total Steps: 8
✓ Passed: 8
✗ Failed: 0
Success Rate: 100%

🎉 All tests passed!
```

### Troubleshooting

**Issue: "No chunks found for document"**
- Ensure worker process is running
- Check that embeddings service (OpenAI/Anthropic) is configured
- Verify Redis is running for BullMQ queue

**Issue: "No search results found"**
- Check that pgvector extension is enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- Verify embeddings were generated (check `embedding` column in `kb_chunks`)
- Ensure AI provider API key is valid

**Issue: "Failed to create document"**
- Check network connectivity to example.com
- Verify crawler service is properly configured
- Check API logs for detailed error messages

## Part 2: Manual UI Testing

### Test 1: Single Page URL Crawl

#### Steps:

1. **Start All Services**
   ```bash
   # Terminal 1: Start PostgreSQL & Redis (if using Docker)
   docker-compose up postgres redis

   # Terminal 2: Start API server
   cd apps/api
   pnpm dev

   # Terminal 3: Start worker
   cd apps/api
   pnpm worker

   # Terminal 4: Start frontend
   cd apps/web
   pnpm dev
   ```

2. **Navigate to Dashboard**
   - Open browser: http://localhost:3000
   - Login with test account
   - Go to **Knowledge Base** section

3. **Create/Select Knowledge Base**
   - Create new KB or select existing one
   - Name: "URL Test KB"

4. **Add Single Page URL**
   - Click "Add Document" button
   - Select content type: **URL**
   - Enter URL: `https://example.com`
   - Leave crawl type as: **Single Page**
   - Click "Add Document"

5. **Verify Document Creation**
   - Document should appear in KB list immediately
   - Status should show as "Processing" or "Ready"
   - Document name should be auto-extracted from page title
   - Click on document to view details

6. **Verify Content Extraction**
   - Open document details
   - Check that content preview shows extracted text
   - Verify no HTML tags in content
   - Confirm clean, readable text

7. **Verify Chunks Generated**
   - In document details, check "Chunks" section
   - Should show multiple chunks (typically 2-5 for example.com)
   - Each chunk should have:
     - Text content (100-500 characters)
     - Embedding status: ✅ Generated

8. **Test Semantic Search**
   - In KB search bar, enter: "example domain"
   - Press Enter or click Search
   - Verify search results appear
   - Top result should be from the crawled document
   - Relevance score should be > 0.5

#### Expected Results:

- ✅ Document created within 2-5 seconds
- ✅ Content extracted without HTML tags
- ✅ 2-10 chunks generated (depends on content length)
- ✅ All chunks have embeddings
- ✅ Search returns relevant results
- ✅ No console errors in browser DevTools

### Test 2: Robots.txt Verification

#### Steps:

1. **Add URL with Robots.txt**
   - Try crawling: `https://github.com`
   - System should check robots.txt first

2. **Verify Robots Check**
   - Check API logs for: "Checking robots.txt for: https://github.com"
   - Should show: "URL allowed by robots.txt" or "URL disallowed"

3. **Test Disallowed URL**
   - Try crawling a disallowed path (check target site's robots.txt)
   - Should show error: "URL is disallowed by robots.txt"

#### Expected Results:

- ✅ Robots.txt is fetched and parsed
- ✅ Allowed URLs proceed with crawl
- ✅ Disallowed URLs show clear error message
- ✅ Robots.txt is cached (check Redis TTL: 24h)

### Test 3: Arabic Content Extraction

#### Steps:

1. **Add Arabic Website**
   - Find Arabic content website (e.g., Arabic Wikipedia page)
   - Add URL to knowledge base

2. **Verify Arabic Text**
   - Check document content shows Arabic characters correctly
   - Verify no encoding issues (no � characters)
   - Confirm RTL text direction is preserved

3. **Test Arabic Search**
   - Search using Arabic query
   - Verify results are relevant

#### Expected Results:

- ✅ Arabic text extracted correctly
- ✅ UTF-8 encoding handled properly
- ✅ No character corruption or tofu (□)
- ✅ Arabic search works

### Test 4: Error Handling

#### Steps:

1. **Test Invalid URL**
   - Try adding: `https://this-domain-does-not-exist-12345.com`
   - Should show error: "Failed to fetch URL"

2. **Test Malformed URL**
   - Try adding: `not-a-valid-url`
   - Should show validation error

3. **Test Timeout**
   - Try extremely slow website
   - Should timeout gracefully after 30 seconds

#### Expected Results:

- ✅ Clear error messages for each failure type
- ✅ No silent failures
- ✅ User is notified of issue
- ✅ No document created for failed crawls

## Part 3: Performance Testing

### Test 1: Large Page Crawl

- **URL**: https://en.wikipedia.org/wiki/Artificial_intelligence
- **Expected**: 20-50 chunks, completes in < 10 seconds
- **Verify**: All content extracted, no truncation

### Test 2: Concurrent Crawls

- Add 5 URLs simultaneously
- All should process without blocking
- Worker should handle queue correctly

### Test 3: Cache Performance

- Crawl same URL twice
- Second crawl should use cached robots.txt
- Check Redis for cached entry

## Part 4: Browser Testing Checklist

Open browser DevTools (F12) and verify:

### Console Tab
- [ ] No JavaScript errors
- [ ] No React warnings
- [ ] No failed network requests

### Network Tab
- [ ] POST /api/v1/organizations/:orgId/knowledge-bases/:kbId/documents
  - Status: 201 Created
  - Response contains document with content

- [ ] GET /api/v1/organizations/:orgId/knowledge-bases/:kbId/search
  - Status: 200 OK
  - Response contains search results with scores

### Application Tab (Storage)
- [ ] JWT token stored correctly
- [ ] No expired tokens
- [ ] Organization context preserved

## Part 5: Database Verification

### Check Database Records

```sql
-- Check document was created
SELECT id, name, "contentType", created_at, updated_at
FROM kb_documents
WHERE "contentType" = 'URL'
ORDER BY created_at DESC
LIMIT 1;

-- Check chunks were generated
SELECT id, "documentId", text, embedding IS NOT NULL as has_embedding
FROM kb_chunks
WHERE "documentId" = '<document-id-from-above>';

-- Check metadata
SELECT metadata
FROM kb_documents
WHERE "contentType" = 'URL'
ORDER BY created_at DESC
LIMIT 1;

-- Verify robots.txt cache in Redis
redis-cli
> KEYS robots:*
> GET robots:https://example.com
> TTL robots:https://example.com
```

### Expected Database State

```
kb_documents:
- contentType: 'URL'
- content: (extracted text, 500-5000 chars)
- metadata: {"url": "https://example.com"}
- crawlJobId: NULL (for single page)

kb_chunks:
- Multiple records (2-10)
- Each has text (100-500 chars)
- Each has embedding (vector)

Redis:
- robots:https://example.com (TTL: 86400 seconds / 24h)
```

## Part 6: Acceptance Criteria Verification

Review implementation plan acceptance criteria:

- [x] User can add website URLs to a knowledge base from the dashboard
- [x] Crawler extracts clean text content from HTML pages
- [x] Extracted content is automatically chunked and indexed with pgvector embeddings
- [x] Arabic website content is properly extracted with correct character encoding
- [x] Robots.txt is respected during crawling

## Success Criteria

All tests pass when:

1. ✅ Automated script completes with 100% pass rate
2. ✅ Manual UI tests show expected behavior
3. ✅ No errors in browser console
4. ✅ Database records created correctly
5. ✅ Search returns relevant results
6. ✅ Robots.txt respected
7. ✅ Arabic content handled correctly
8. ✅ Error cases handled gracefully

## Next Steps

After completing this test:

1. Document any issues found in `build-progress.txt`
2. Mark subtask-7-1 as completed in `implementation_plan.json`
3. Commit changes:
   ```bash
   git add .
   git commit -m "auto-claude: subtask-7-1 - End-to-end single page crawl test"
   ```
4. Proceed to subtask-7-2: Multi-page crawl test

## Notes

- Test data is automatically cleaned up by the script
- For manual testing, clean up test data periodically
- Check API logs for detailed debugging information
- Use Redis CLI to inspect cache and queue state
- Use pgAdmin or psql to verify database state

## Support

If tests fail consistently:

1. Check `.env` configuration
2. Verify all services are running
3. Check API logs: `tail -f apps/api/logs/app.log`
4. Check worker logs: `tail -f apps/api/logs/worker.log`
5. Verify database migrations: `pnpm db:migrate`
6. Check Redis connectivity: `redis-cli ping`
