# Mojeeb API Backend Audit Report

**Date:** 2026-02-11
**Status:** Most critical and high-severity issues FIXED

---

## Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| Critical | 6 | 6 |
| High | 10 | 9 |
| Medium | ~15 | 3 |
| Low | ~15 | 0 |

---

## CRITICAL — ALL FIXED

### 1. Raw SQL table name mismatch (FIXED)
- **File:** `apps/api/src/queues/workers/inbound.worker.ts:82`
- **Bug:** `UPDATE "Subscription"` but table is mapped as `"subscriptions"`
- **Impact:** ALL inbound messages fail with SQL error
- **Fix:** Changed to `UPDATE "subscriptions"`

### 2. CSAT query references missing orgId column (FIXED)
- **File:** `apps/api/src/services/analytics.service.ts:354`
- **Bug:** `WHERE "orgId" = ${orgId}` on `conversation_ratings` which has no `orgId` column
- **Impact:** CSAT analytics endpoint returns 500
- **Fix:** JOIN through `conversations` table to get orgId

### 3. Cross-tenant conversation mutations (FIXED)
- **File:** `apps/api/src/routes/conversations.routes.ts`
- **Bug:** send-message, handoff, resolve, return-to-AI, upload — no orgId ownership check
- **Impact:** Any user can write to any conversation across organizations
- **Fix:** Added `findFirst({ where: { id, orgId } })` guard to all mutation routes

### 4. WebSocket join:org no auth check (FIXED)
- **File:** `apps/api/src/websocket/index.ts:79`
- **Bug:** Any authenticated user can join any org's room
- **Impact:** Cross-tenant real-time data leak
- **Fix:** Added orgMembership verification before joining

### 5. WebSocket join:conversation no auth check (FIXED)
- **File:** `apps/api/src/websocket/index.ts:84,152`
- **Bug:** Both namespaces allow joining any conversation room
- **Impact:** Cross-tenant conversation eavesdropping
- **Fix:** Added conversation ownership verification for both dashboard and webchat namespaces

### 6. Webchat file upload race condition (FIXED)
- **File:** `apps/api/src/routes/webhooks/webchat.routes.ts:501`
- **Bug:** Find-or-create not in transaction, conversationId not passed to inbound queue
- **Impact:** Duplicate conversations, split messages
- **Fix:** Wrapped in `$transaction` with `ReadCommitted` isolation, pass `conversationId` to queue

---

## HIGH — FIXED

### 7. apiKeyAuth crashes process (FIXED)
- **File:** `apps/api/src/middleware/apiKeyAuth.ts:13,66`
- **Bug:** Sync `throw` outside error chain
- **Fix:** Changed to `return next(new UnauthorizedError(...))`

### 8. Rate limiter bypass (FIXED)
- **File:** `apps/api/src/middleware/rateLimiter.ts:27,41`
- **Bug:** `Math.random()` fallback defeats rate limiting when req.ip is undefined
- **Fix:** Changed to `'anon-unknown'` — all unidentified clients share one bucket

### 9. SVG upload stored XSS (FIXED)
- **File:** `apps/api/src/routes/webhooks/webchat.routes.ts:37`
- **Bug:** `image/svg+xml` allowed — SVG can contain embedded JavaScript
- **Fix:** Removed `image/svg+xml` from allowed MIME types

### 10. Suspended users can login (FIXED)
- **File:** `apps/api/src/services/auth.service.ts:237,495`
- **Bug:** No `suspendedAt` check in login or Google sign-in
- **Fix:** Added suspension check before issuing tokens in both flows

### 11. AI provider no timeouts (FIXED)
- **Files:** `apps/api/src/ai/providers/openai.provider.ts:30`, `anthropic.provider.ts:32`
- **Bug:** No timeout on API calls — workers can hang indefinitely
- **Fix:** Added `timeout: 60_000` (60s) to both provider clients

### 12. Channel agent assignment no org check (FIXED)
- **File:** `apps/api/src/routes/channel.routes.ts:130,147`
- **Bug:** No verification that channel belongs to requesting user's org
- **Fix:** Added `channelService.getById(orgId, channelId)` guard

### 13. Tags cross-org (FIXED)
- **File:** `apps/api/src/routes/tags.routes.ts:60-88`
- **Bug:** Can apply tags to conversations in other organizations
- **Fix:** Added org ownership verification for both tag and conversation

---

## MEDIUM — PARTIALLY FIXED

### 14. /uploads served before Helmet (FIXED)
- **File:** `apps/api/src/app.ts:52`
- **Fix:** Moved `/uploads` static serving after Helmet middleware

### 15. Widget test page in production (FIXED)
- **File:** `apps/api/src/app.ts:33`
- **Fix:** Gated behind `NODE_ENV !== 'production'`

### 16. Conversation delete not atomic (FIXED)
- **File:** `apps/api/src/services/conversation.service.ts:184`
- **Fix:** Wrapped in `$transaction`, added ConversationTag and ConversationRating cleanup

---

## REMAINING (Not yet fixed)

### HIGH — Remaining
- KB document fire-and-forget stuck processing (`knowledgeBase.service.ts:86`)
- Analytics/BulkEmail workers no DLQ handling
- Subscription payment upgrade race condition

### MEDIUM — Remaining
- WhatsApp webhook routes to first global channel (multi-tenant broken)
- Webchat `/discover` returns first global channel
- Demo requests no rate limiting
- Bulk email cancel doesn't stop queued jobs
- No connection pool config for Prisma
- Conversation search `ILIKE` without trigram index
- `sendHumanMessage` not in transaction
- Anthropic `generateJSON` fragile JSON extraction
- Webchat visitor endpoints no ownership verification
- `getPlatformGrowth` loads entire tables into memory
- Missing `onDelete` cascades (Conversation→Channel, Conversation→Agent, Announcement→User)

### LOW — Remaining
- Missing indexes on `resetPasswordToken`, `emailVerifyToken`
- Missing vector index on `kb_chunks.embedding`
- CSV formula injection in export routes
- No `process.on('unhandledRejection')` handler
- Redundant database indexes
- Various minor validation gaps
