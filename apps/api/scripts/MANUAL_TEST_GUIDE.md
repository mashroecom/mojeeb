# Manual Testing Guide: CSV Export Streaming (10K Conversations)

## Overview

This guide provides step-by-step instructions for manually testing the CSV export streaming implementation with 10,000 conversations.

## Prerequisites

- Node.js and pnpm installed
- PostgreSQL database running and accessible
- DATABASE_URL environment variable configured

## Test Steps

### 1. Seed Test Data

Create 10,000 test conversations:

```bash
cd apps/api
pnpm tsx scripts/seed-10k-conversations.ts
```

**Expected Output:**
- Organization created/found
- Channel created/found
- 10,000 conversations created in batches
- Total time: ~5-15 seconds

**Verify:**
- Check console output for "✅ Seed complete!"
- Note the Organization ID (needed for testing)

### 2. Start Development Server

In a separate terminal, start the API server:

```bash
cd apps/api
pnpm dev
```

**Expected Output:**
- Server starts on http://localhost:3000
- No errors in console
- Database connection established

**Verify:**
- Server is running and responsive
- Can access http://localhost:3000/health

### 3. Run Streaming Performance Test

Run the automated performance test:

```bash
cd apps/api
ORG_ID=test-org-10k pnpm tsx scripts/test-export-streaming.ts
```

**Expected Output:**
```
✅ CSV Download: 10,000 rows in ~500-2000ms
✅ Server Responsiveness: PASS
✅ Memory Usage: Constant (streaming implementation)
✅ Event Loop: Not blocked
```

**Verify:**
- CSV downloads correctly (10,000+ rows)
- Download completes in reasonable time (<3 seconds)
- Server remains responsive during export
- Concurrent health checks succeed
- No event loop blocking

### 4. Manual Browser Test (Optional)

1. Get an authentication token:
   ```bash
   # Create a test user and get token (adjust as needed for your auth setup)
   ```

2. Open browser and navigate to:
   ```
   http://localhost:3000/api/v1/organizations/test-org-10k/export/conversations
   ```

3. Add authentication header (via browser extension or curl):
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/v1/organizations/test-org-10k/export/conversations \
     -o test-export.csv
   ```

**Verify:**
- CSV file downloads
- File size is ~1-3 MB
- Contains 10,001 lines (header + 10,000 rows)
- CSV is well-formatted with proper headers
- Special characters are escaped (CSV sanitization working)

### 5. Concurrent Export Test

Test multiple concurrent exports to verify no blocking:

```bash
# Terminal 1
curl http://localhost:3000/api/v1/organizations/test-org-10k/export/conversations > export1.csv &

# Terminal 2
curl http://localhost:3000/api/v1/organizations/test-org-10k/export/conversations > export2.csv &

# Terminal 3
curl http://localhost:3000/api/v1/organizations/test-org-10k/export/conversations > export3.csv &

# Verify health endpoint responds quickly during exports
curl http://localhost:3000/health
```

**Verify:**
- All three exports complete successfully
- Health endpoint responds in <100ms even during exports
- Server logs show no errors
- CPU usage is reasonable (not maxed out)

## Success Criteria

✅ **CSV Download**: Successfully downloads 10,000 rows as CSV
✅ **Server Responsiveness**: Health checks succeed during export (avg <500ms)
✅ **Memory Usage**: Constant memory usage (no 5MB string allocation)
✅ **Event Loop**: Not blocked (concurrent requests process normally)
✅ **Data Integrity**: CSV contains correct headers and data
✅ **CSV Sanitization**: Formula injection protection works (=, +, -, @ prefixes escaped)

## Troubleshooting

### Issue: Database connection error

**Solution:**
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Ensure PostgreSQL is running
# For local Docker: docker-compose up -d postgres
```

### Issue: Organization not found

**Solution:**
```bash
# Re-run seed script to create test org
pnpm tsx scripts/seed-10k-conversations.ts
```

### Issue: Port 3000 already in use

**Solution:**
```bash
# Kill existing process or use different port
PORT=3001 pnpm dev
```

### Issue: Test script timeout

**Solution:**
- Increase timeout in test script (default 30s)
- Check database performance
- Ensure sufficient server resources

## Cleanup

After testing, you can remove test data:

```bash
# Connect to your database and run:
DELETE FROM "Conversation" WHERE "orgId" = 'test-org-10k';
DELETE FROM "Channel" WHERE "orgId" = 'test-org-10k';
DELETE FROM "Organization" WHERE id = 'test-org-10k';
```

## Performance Baseline

| Metric | Before (Synchronous) | After (Streaming) |
|--------|---------------------|-------------------|
| Memory allocation | ~5 MB string | Constant (chunks) |
| Event loop blocking | 100-500ms | None (streaming) |
| Concurrent capacity | Limited | High |
| Download time | ~500ms | ~500ms (same) |
| Server responsiveness | Blocked | Responsive |
