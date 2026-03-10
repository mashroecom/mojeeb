# Testing Guide

## Quick Reference

```bash
# Unit tests
pnpm test

# Type checking
pnpm tsc --noEmit

# E2E tests (requires services running)
tsx test-crawl-e2e.ts
tsx test-crawl-multipage-e2e.ts
tsx test-crawl-scheduled-e2e.ts

# Verify Prisma client is up to date
bash ./scripts/verify-prisma-client.sh
```

---

## End-to-End Testing

### Prerequisites

Before running E2E tests, you must start all required services.

### Step 1: Start Infrastructure Services

```bash
# Start PostgreSQL and Redis using Docker
docker-compose up -d postgres redis

# Verify services are healthy
docker ps
# Should show both postgres and redis as "Up" and "healthy"
```

### Step 2: Start Application Services

Open **three separate terminal windows** and run:

**Terminal 1 - API Server:**
```bash
cd apps/api
pnpm dev
```

Wait for: `✓ API server listening on http://localhost:4000`

**Terminal 2 - Background Worker:**
```bash
cd apps/api
pnpm worker
```

Wait for: `✓ Worker started and listening for jobs`

**Terminal 3 - Frontend (optional, for visual testing):**
```bash
cd apps/web
pnpm dev
```

Wait for: `Ready on http://localhost:3000`

### Step 3: Run E2E Test Scripts

In a **fourth terminal window**, run the test scripts:

```bash
# Test 1: Single page crawl
tsx test-crawl-e2e.ts

# Test 2: Multi-page crawl with depth limits
tsx test-crawl-multipage-e2e.ts

# Test 3: Scheduled re-crawl
tsx test-crawl-scheduled-e2e.ts
```

### Expected Results

Each test should output:

```
========================================
Test Summary
========================================

Total Steps: 8
✓ Passed: 8
✗ Failed: 0
Success Rate: 100%

🎉 All tests passed!
```

### Troubleshooting E2E Tests

#### Issue: "ECONNREFUSED localhost:4000"
**Cause**: API server is not running
**Fix**: Start the API server in a separate terminal (`cd apps/api && pnpm dev`)

#### Issue: "No chunks found for document"
**Cause**: Worker is not running or embeddings service is not configured
**Fix**:
1. Start the worker: `cd apps/api && pnpm worker`
2. Verify `.env` has `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` configured

#### Issue: "Database connection failed"
**Cause**: PostgreSQL is not running
**Fix**: Start Docker services: `docker-compose up -d postgres redis`

#### Issue: "Job stuck in PENDING status"
**Cause**: Worker is not processing the queue
**Fix**:
1. Check worker logs for errors
2. Verify Redis is running: `docker ps | grep redis`
3. Restart worker if needed

---

## Visual Verification (UI Testing)

### When to Perform Visual Verification

Visual verification is **required** when:
- UI components are created or modified
- API endpoints that affect the UI are changed
- Any changes to the frontend codebase

### Manual Visual Verification Steps

#### 1. Start the Application

```bash
# Terminal 1: Infrastructure
docker-compose up -d postgres redis

# Terminal 2: API & Worker
cd apps/api && pnpm dev &
cd apps/api && pnpm worker &

# Terminal 3: Frontend
cd apps/web && pnpm dev
```

#### 2. Navigate to Knowledge Base Page

1. Open browser: http://localhost:3000
2. Login with test account
3. Navigate to **Knowledge Base** section

#### 3. Test Crawl Configuration Form

**Test Case 1: Single Page Crawl**
- [ ] Form renders without errors
- [ ] URL input accepts valid URLs
- [ ] "Single Page" crawl type is default
- [ ] "Add Document" button is enabled
- [ ] Submit creates document successfully
- [ ] Success toast notification appears

**Test Case 2: Multi-Page Crawl**
- [ ] Switch to "Multi-Page Crawl" option
- [ ] Max depth slider appears (1-5)
- [ ] URL pattern filter input appears
- [ ] Advanced options are collapsible
- [ ] Submit creates crawl job
- [ ] Redirects to job progress view

#### 4. Test Crawl Progress View

**After starting a multi-page crawl:**
- [ ] Progress view renders immediately
- [ ] Status badge shows "PENDING" or "RUNNING"
- [ ] Progress bar animates during crawl
- [ ] Pages crawled counter updates in real-time (polls every 2 seconds)
- [ ] Completion percentage is accurate
- [ ] Final status shows "COMPLETED" or "FAILED"
- [ ] Error messages display if job fails

#### 5. Test Schedule UI

**In KBDetailView component:**
- [ ] Schedule section is visible
- [ ] Enable/Disable toggle switch works
- [ ] Frequency selector (Daily/Weekly/Monthly) renders
- [ ] Active frequency is highlighted
- [ ] Last crawled timestamp displays correctly
- [ ] Next scheduled crawl time shows when enabled
- [ ] Save button triggers API call
- [ ] Success/error toasts appear

#### 6. Browser Console Verification

**Critical Check:**
- [ ] Press F12 to open Developer Tools
- [ ] Go to Console tab
- [ ] **Should have ZERO errors**
- [ ] No React warnings
- [ ] No network errors (4xx/5xx)

#### 7. Responsive Design Check

Test on different screen sizes:
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

All UI components should:
- [ ] Render correctly without overflow
- [ ] Be fully functional
- [ ] Have proper spacing and alignment

#### 8. RTL (Arabic) Language Test

1. Switch language to Arabic in settings
2. Verify:
   - [ ] Text direction is right-to-left
   - [ ] Form layouts mirror correctly
   - [ ] All translations are present
   - [ ] No UI breaking or overlapping

---

## Automated Visual Verification (Future)

**Note**: For automated visual verification, consider setting up:

1. **Playwright** for browser automation
   ```bash
   npm install -D @playwright/test
   ```

2. **Visual regression testing** with Playwright snapshots
   ```typescript
   await expect(page).toHaveScreenshot('crawl-config-form.png');
   ```

3. **CI/CD integration** to run visual tests on every PR

---

## Test Coverage Guidelines

### Required Tests Before Merging

- [ ] Unit tests pass: `pnpm test`
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Prisma client in sync: `bash ./scripts/verify-prisma-client.sh`
- [ ] E2E tests pass: All 3 crawl test scripts
- [ ] Visual verification: Manual UI check (documented in screenshots or video)
- [ ] Browser console: Zero errors
- [ ] Database migrations applied: `npx prisma migrate status`

### CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Verify Prisma Client
  run: bash ./scripts/verify-prisma-client.sh

- name: Run E2E Tests
  run: |
    docker-compose up -d postgres redis
    cd apps/api && pnpm dev &
    cd apps/api && pnpm worker &
    sleep 10
    tsx test-crawl-e2e.ts
    tsx test-crawl-multipage-e2e.ts
    tsx test-crawl-scheduled-e2e.ts
```

---

## Database Verification

### After Schema Changes

```bash
# Check migration status
npx prisma migrate status

# Verify schema is valid
npx prisma validate

# Regenerate client
pnpm db:generate

# Verify client is in sync
bash ./scripts/verify-prisma-client.sh
```

### Database Inspection

```sql
-- Check crawl jobs table
SELECT * FROM crawl_jobs ORDER BY "createdAt" DESC LIMIT 10;

-- Check crawl configs
SELECT * FROM crawl_configs WHERE enabled = true;

-- Check documents created by crawl jobs
SELECT d.*, cj.status, cj.url
FROM kb_documents d
JOIN crawl_jobs cj ON d."crawlJobId" = cj.id
ORDER BY d."createdAt" DESC
LIMIT 20;
```

---

## Performance Testing

### Load Testing Crawl Jobs

```bash
# Start 10 concurrent crawl jobs
for i in {1..10}; do
  tsx test-crawl-e2e.ts &
done
wait

# Monitor:
# - Worker throughput
# - Redis queue depth
# - Database connection pool usage
# - Memory consumption
```

### Expected Performance

- Single page crawl: < 3 seconds
- Multi-page crawl (depth 2, ~10 pages): < 30 seconds
- Scheduled job trigger: < 1 second
- Real-time progress update: < 2 second latency

---

## Security Testing

### Verify Security Measures

- [ ] robots.txt is respected (test with disallowed URL)
- [ ] No hardcoded API keys in code
- [ ] Rate limiting prevents abuse (max 2 concurrent crawls)
- [ ] User can only access their own organization's crawl jobs
- [ ] SQL injection prevented (Prisma parameterized queries)
- [ ] XSS prevented (React escapes all user input)

---

## Test Data Cleanup

After testing, clean up test data:

```bash
# Using Prisma Studio
npx prisma studio
# Navigate to tables and delete test records

# Or using SQL
psql -h localhost -U mojeeb -d mojeeb
DELETE FROM crawl_jobs WHERE "orgId" = 'test-crawl-org';
DELETE FROM knowledge_bases WHERE "orgId" = 'test-crawl-org';
DELETE FROM organizations WHERE id = 'test-crawl-org';
```

---

## Continuous Monitoring

### Production Health Checks

Monitor these metrics in production:

1. **Crawl Job Success Rate**: Should be > 95%
2. **Average Crawl Duration**: Track over time
3. **Worker Queue Depth**: Should not grow unbounded
4. **Failed Jobs**: Investigate failures immediately
5. **robots.txt Cache Hit Rate**: Should be > 90%

---

## Need Help?

- Check [E2E_TEST_GUIDE.md](./.auto-claude/specs/041-knowledge-base-url-scraping-auto-sync/E2E_TEST_GUIDE.md) for detailed test procedures
- Review [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow
- Open an issue with test failure logs and environment details
