# Dashboard File Upload and Access Flow - Verification Guide

This document describes how to manually verify the file upload and access control flow for authenticated dashboard users.

## Test Scenario: Subtask 5-2

**Objective**: Verify that file access control is properly enforced for dashboard file uploads with organization-based access control.

## Prerequisites

1. Server is running (`cd apps/api && pnpm dev`)
2. Database is accessible and seeded with test data
3. Environment variables are set (see `.env.example`)

## Manual Verification Steps

### Step 1: Create test users and organizations

```bash
# Connect to your database and create test data
# Organization 1
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES ('test-org-1', 'Test Organization 1', 'test-org-1', NOW(), NOW());

# Organization 2
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES ('test-org-2', 'Test Organization 2', 'test-org-2', NOW(), NOW());

# User 1 (member of org 1)
INSERT INTO users (id, email, first_name, last_name, password, is_active, created_at, updated_at)
VALUES ('user-1', 'user1@example.com', 'User', 'One', 'hashed', true, NOW(), NOW());

# User 2 (also member of org 1)
INSERT INTO users (id, email, first_name, last_name, password, is_active, created_at, updated_at)
VALUES ('user-2', 'user2@example.com', 'User', 'Two', 'hashed', true, NOW(), NOW());

# User 3 (member of org 2)
INSERT INTO users (id, email, first_name, last_name, password, is_active, created_at, updated_at)
VALUES ('user-3', 'user3@example.com', 'User', 'Three', 'hashed', true, NOW(), NOW());

# Add memberships
INSERT INTO org_memberships (user_id, org_id, role, created_at, updated_at)
VALUES ('user-1', 'test-org-1', 'AGENT', NOW(), NOW());

INSERT INTO org_memberships (user_id, org_id, role, created_at, updated_at)
VALUES ('user-2', 'test-org-1', 'AGENT', NOW(), NOW());

INSERT INTO org_memberships (user_id, org_id, role, created_at, updated_at)
VALUES ('user-3', 'test-org-2', 'AGENT', NOW(), NOW());

# Create a conversation in org 1
INSERT INTO conversations (id, org_id, customer_id, status, created_at, updated_at)
VALUES ('test-conv-1', 'test-org-1', 'test-customer', 'OPEN', NOW(), NOW());
```

### Step 2: Generate JWT tokens for users

```bash
# Using Node.js (requires jsonwebtoken package):
node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'your-secret-key-must-be-at-least-32-characters-long-for-hs256';

const user1Token = jwt.sign(
  { userId: 'user-1', email: 'user1@example.com' },
  secret,
  { expiresIn: '7d' }
);

const user2Token = jwt.sign(
  { userId: 'user-2', email: 'user2@example.com' },
  secret,
  { expiresIn: '7d' }
);

const user3Token = jwt.sign(
  { userId: 'user-3', email: 'user3@example.com' },
  secret,
  { expiresIn: '7d' }
);

console.log('User 1 Token:', user1Token);
console.log('User 2 Token:', user2Token);
console.log('User 3 Token:', user3Token);
"

# Save these tokens for use in the following steps
USER1_TOKEN="<user1 token>"
USER2_TOKEN="<user2 token>"
USER3_TOKEN="<user3 token>"
```

### Step 3: Upload file via dashboard as authenticated agent

```bash
# Create a test file
echo "This is a test file for dashboard upload" > /tmp/test-dashboard.txt

# Upload the file as User 1
curl -X POST \
  http://localhost:4000/api/v1/organizations/test-org-1/conversations/test-conv-1/upload \
  -H "Authorization: Bearer ${USER1_TOKEN}" \
  -F "file=@/tmp/test-dashboard.txt"

# Example response:
# {
#   "success": true,
#   "data": {
#     "messageId": "...",
#     "fileUrl": "/files/1234567890-123456.txt?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#     "contentType": "DOCUMENT",
#     "fileName": "test-dashboard.txt",
#     "fileSize": 43
#   }
# }

# Extract the filename from the response
FILENAME="1234567890-123456.txt"  # Use actual filename from response
```

**Expected Result**: ✅ Upload succeeds, response contains `fileUrl` with signed format

### Step 4: Access file with Bearer token (same user) - should succeed

```bash
# User 1 accessing their own uploaded file
curl -i "http://localhost:4000/files/${FILENAME}" \
  -H "Authorization: Bearer ${USER1_TOKEN}"
```

**Expected Result**:
```
✅ HTTP 200 OK
✅ Content-Type header matches file type
✅ File content is returned
```

### Step 5: Access file from different org member - should succeed

```bash
# User 2 (same organization) accessing the file
curl -i "http://localhost:4000/files/${FILENAME}" \
  -H "Authorization: Bearer ${USER2_TOKEN}"
```

**Expected Result**:
```
✅ HTTP 200 OK
✅ File content is returned
✅ Organization members can access each other's files
```

### Step 6: Access file from non-member - should return 403

```bash
# User 3 (different organization) trying to access the file
curl -i "http://localhost:4000/files/${FILENAME}" \
  -H "Authorization: Bearer ${USER3_TOKEN}"
```

**Expected Result**:
```
✅ HTTP 403 Forbidden
✅ Error message: "Access denied to this file" or similar
✅ Users from different organizations cannot access files
```

### Step 7: Access file without token - should return 403/401

```bash
# Try to access without any authentication
curl -i "http://localhost:4000/files/${FILENAME}"
```

**Expected Result**:
```
✅ HTTP 403 Forbidden or 401 Unauthorized
✅ Error message: "Authentication required" or similar
```

## Automated Test

You can also run the automated integration test:

```bash
cd apps/api

# Make sure server is running in another terminal
pnpm dev

# Run the integration test
npx tsx src/tests/integration/dashboard-file-access.test.ts
```

The test will automatically:
- Create test organizations, users, and memberships
- Upload a file as an authenticated user
- Test access with different authentication scenarios
- Clean up all test data
- Report success/failure

## Success Criteria

All of the following must be true:

- [x] File upload via dashboard requires authentication
- [x] Uploaded file can be accessed by the uploader with Bearer token (200 OK)
- [x] File can be accessed by other members of the same organization (200 OK)
- [x] File cannot be accessed by users from different organizations (403 error)
- [x] File cannot be accessed without authentication (403/401 error)
- [x] Organization-based access control is enforced correctly

## Troubleshooting

### Upload fails with "Not a member of this organization"
Check that the user has an `OrgMembership` record for the organization

### Upload fails with "Conversation not found"
Create a conversation in the database first, or use an existing conversation ID

### All access attempts return 403 (even for valid org members)
Check:
- fileAccess.service.ts is correctly checking organization membership
- Message records have correct organizationId
- User tokens contain valid userId

### User from different org can access file (should be 403)
Check:
- fileAccess.service.ts properly validates organization membership
- getFileOwnership() returns correct organization information
- File ownership is correctly associated with conversation's organization

### Access without token returns 200 (should be 403/401)
This indicates the middleware is not working. Check:
- Files route is properly registered
- validateFileAccess middleware is applied
- Middleware checks for Bearer token presence
