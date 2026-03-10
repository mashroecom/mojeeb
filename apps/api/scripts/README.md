# Manual Testing Scripts for CSV Export Streaming

This directory contains scripts for manual performance testing of the CSV export streaming implementation.

## Overview

The CSV export endpoints have been refactored from synchronous string building to streaming implementation. These scripts help verify that the streaming implementation works correctly with large datasets (10K records).

## Scripts

### 1. `seed-10k-conversations.ts`

Seeds the database with 10,000 test conversations for performance testing.

**Usage:**
```bash
cd apps/api
pnpm tsx scripts/seed-10k-conversations.ts
```

**What it does:**
- Creates or finds test organization (`test-org-10k`)
- Creates or finds test WhatsApp channel
- Seeds 10,000 conversations in batches of 1,000
- Provides progress feedback
- Skips seeding if 10K records already exist

**Output:**
- Organization ID
- Channel ID
- Total conversations created
- Total time taken

---

### 2. `test-export-streaming.ts`

Automated performance test for CSV export streaming.

**Usage:**
```bash
cd apps/api
ORG_ID=test-org-10k pnpm tsx scripts/test-export-streaming.ts
```

**Environment Variables:**
- `API_URL`: API base URL (default: `http://localhost:3000`)
- `ORG_ID`: Organization ID to test (default: `test-org-10k`)

**What it tests:**
1. **Export Functionality**
   - Downloads CSV export of 10K conversations
   - Measures download time
   - Verifies CSV structure and headers
   - Calculates throughput (rows/sec)

2. **Server Responsiveness**
   - Starts export in background
   - Makes 3 concurrent health check requests
   - Measures response times during export
   - Detects event loop blocking

**Success Criteria:**
- ✅ CSV exports 10,000+ rows
- ✅ Export completes in <3 seconds
- ✅ Health checks respond in <500ms during export
- ✅ All concurrent requests succeed

**Output:**
```
✅ CSV Download: 10,000 rows in 850ms
✅ Server Responsiveness: PASS
✅ Memory Usage: Constant (streaming implementation)
✅ Event Loop: Not blocked
```

---

### 3. `run-manual-test.sh`

Bash script that orchestrates the complete manual testing process.

**Usage:**
```bash
cd apps/api
bash scripts/run-manual-test.sh
```

**What it does:**
1. Checks prerequisites (pnpm, node, database)
2. Seeds 10K conversations
3. Verifies dev server is running
4. Runs streaming performance test
5. Displays summary report

**Requirements:**
- PostgreSQL database running
- DATABASE_URL environment variable set
- Dev server running on port 3000 (or API_URL set)

---

## Quick Start

### Option 1: Automated (Recommended)

```bash
# Terminal 1: Start dev server
cd apps/api
pnpm dev

# Terminal 2: Run all tests
cd apps/api
bash scripts/run-manual-test.sh
```

### Option 2: Manual Steps

```bash
# Step 1: Seed data
cd apps/api
pnpm tsx scripts/seed-10k-conversations.ts

# Step 2: Start server (separate terminal)
cd apps/api
pnpm dev

# Step 3: Run performance test
cd apps/api
ORG_ID=test-org-10k pnpm tsx scripts/test-export-streaming.ts
```

---

## Documentation

- **MANUAL_TEST_GUIDE.md**: Comprehensive testing guide with troubleshooting
- **README.md**: This file

---

## Performance Baseline

| Metric | Value |
|--------|-------|
| Records | 10,000 |
| File Size | 1-3 MB |
| Export Time | 500-2,000 ms |
| Throughput | 5,000-20,000 rows/sec |
| Memory | Constant (streaming) |
| Event Loop | Not blocked |

---

## Cleanup

After testing, remove test data:

```sql
DELETE FROM "Conversation" WHERE "orgId" = 'test-org-10k';
DELETE FROM "Channel" WHERE "orgId" = 'test-org-10k';
DELETE FROM "Organization" WHERE id = 'test-org-10k';
```

---

## Troubleshooting

### Database connection error
- Check `DATABASE_URL` environment variable
- Ensure PostgreSQL is running

### Server not running
- Start dev server: `pnpm dev`
- Check port 3000 is available

### Tests timeout
- Increase timeout in test script
- Check database performance
- Verify sufficient server resources

See `MANUAL_TEST_GUIDE.md` for detailed troubleshooting.

---

## Integration with CI/CD

These scripts are designed for manual verification. For automated CI/CD:
- Use existing unit tests: `pnpm test export.routes.test.ts`
- These manual tests verify real-world performance with large datasets
