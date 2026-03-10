# Integration Tests

This directory contains end-to-end integration tests for the Mojeeb API.

## AI Conversation Billing E2E Test

**File:** `ai-conversation-billing.e2e.test.ts`

This test verifies the complete AI conversation billing flow including:
- AI conversation usage tracking
- Usage alert notifications (80% and 100% thresholds)
- Overage charge accrual
- Spending cap enforcement
- API data retrieval

### Prerequisites

Before running this test, ensure:

1. **Database migration is applied:**
   ```bash
   cd apps/api
   npx prisma migrate deploy
   # OR for development
   npx prisma migrate dev
   ```

2. **Prisma client is generated:**
   ```bash
   cd apps/api
   npx prisma generate
   ```

3. **Environment variables are set:**
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - JWT signing secret (min 32 characters)
   - `API_URL` - API server URL (default: http://localhost:4000)

4. **Database is accessible:**
   - PostgreSQL server is running
   - Database exists and is accessible

### Running the Test

#### Option 1: Using tsx (TypeScript execution)

```bash
cd apps/api
npx tsx src/tests/integration/ai-conversation-billing.e2e.test.ts
```

#### Option 2: Using npm/pnpm scripts

Add to `package.json`:
```json
{
  "scripts": {
    "test:e2e:billing": "tsx src/tests/integration/ai-conversation-billing.e2e.test.ts"
  }
}
```

Then run:
```bash
cd apps/api
pnpm run test:e2e:billing
```

### Test Scenarios

The test executes the following scenarios in order:

1. **Setup** - Creates test organization with FREE plan (100 AI conversations limit)
2. **Simulate 81% usage** - Increments AI conversations to 81
3. **Verify 80% alert** - Checks USAGE_WARNING notification was sent
4. **Verify dashboard data** - Confirms subscription shows 81/100 usage
5. **Simulate 100% usage** - Increments to 100 conversations
6. **Verify 100% alert** - Checks USAGE_LIMIT notification was sent
7. **Test overage** - Exceeds limit and verifies overage tracking
8. **Enable spending cap** - Sets $1.00 spending cap
9. **Test hard limit** - Verifies AI responses are blocked when cap is exceeded
10. **Verify API access** - Confirms data is retrievable via REST API

### Expected Output

```
=== AI Conversation Billing E2E Test ===

[TEST] Setting up test data...
[TEST] Created org: cly...
[TEST] Created user: cly...
[TEST] Created subscription: cly...
✅ Step 1: Create test organization with FREE plan
[TEST] Simulating 81 AI conversations...
✅ Step 2: Simulate 81 AI conversations
✅ Step 3: Verify 80% usage alert sent
✅ Step 4: Verify subscription shows 81% usage
✅ Step 5: Simulate 19 more AI conversations to reach 100%
✅ Step 6: Verify 100% usage alert sent
✅ Step 7: Verify overage conversation tracked
✅ Step 8a: Enable spending cap
✅ Step 8b: Verify spending cap blocks AI responses
✅ Step 9: Verify usage statistics accuracy
✅ Step 10: Verify usage data via API

=== Test Summary ===

Total: 11/11 tests passed

✅ All tests passed! AI conversation billing flow is working correctly.
```

### Cleanup

The test automatically cleans up all test data (organizations, users, subscriptions, notifications) after execution, regardless of success or failure.

### Troubleshooting

**Error: "Subscription not found"**
- Ensure database migration is applied
- Check DATABASE_URL is correct

**Error: "Property 'aiConversationsUsed' does not exist"**
- Run `npx prisma generate` to regenerate Prisma client
- Ensure migration 20260310_add_ai_conversation_billing is applied

**Error: "Cannot connect to database"**
- Verify PostgreSQL is running
- Check DATABASE_URL environment variable
- Ensure database exists

**Test fails on API call**
- Ensure API server is running on the expected URL
- Check API_URL environment variable
- Verify JWT_SECRET matches between test and server

### Notes

- This is a standalone test that does NOT require the API server to be running (except for Step 10)
- The test uses direct service calls for most operations for speed and reliability
- All test data is isolated with unique timestamps to avoid conflicts
- The test is safe to run in development but should NOT be run in production
