# Webchat File Upload and Access Flow - Verification Guide

This document describes how to manually verify the file upload and access control flow for webchat visitors.

## Test Scenario: Subtask 5-1

**Objective**: Verify that file access control is properly enforced for webchat file uploads.

## Prerequisites

1. Server is running (`cd apps/api && pnpm dev`)
2. At least one active webchat channel exists in the database
3. Environment variables are set (see `.env.example`)

## Manual Verification Steps

### Step 1: Upload file via webchat widget as visitor

```bash
# Discover the webchat channel
curl http://localhost:3001/api/v1/webchat/discover

# Extract channelId from response
CHANNEL_ID="<channelId from response>"

# Create a test file
echo "This is a test file" > /tmp/test-upload.txt

# Upload the file
curl -X POST http://localhost:3001/api/v1/webchat/${CHANNEL_ID}/upload \
  -F "file=@/tmp/test-upload.txt" \
  -F "visitorId=test-visitor-123" \
  -F "visitorName=Test Visitor"

# Example response:
# {
#   "success": true,
#   "data": {
#     "conversationId": "...",
#     "fileUrl": "/files/1234567890-123456.txt?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#     "contentType": "DOCUMENT",
#     "fileName": "test-upload.txt",
#     "fileSize": 19
#   }
# }
```

**Expected Result**: ✅ Upload succeeds, response contains `fileUrl` with a token parameter

### Step 2: Verify file URL contains signed token

```bash
# Extract the fileUrl from the response above
FILE_URL="<fileUrl from response>"

# Check that it contains a token parameter
echo $FILE_URL | grep "token="

# Decode the token (optional - requires jwt-cli or online tool)
# Extract token value and decode at https://jwt.io
```

**Expected Result**: ✅ URL format is `/files/{filename}?token={jwt}` and token is a valid JWT

### Step 3: Access file with token - should succeed

```bash
# Use the full file URL from the upload response
curl -i "http://localhost:3001${FILE_URL}"
```

**Expected Result**:
```
✅ HTTP 200 OK
✅ Content-Type header matches file type
✅ File content is returned
```

### Step 4: Access file without token - should return 403

```bash
# Extract filename from URL (the part between /files/ and ?)
FILENAME="1234567890-123456.txt"  # Use actual filename from Step 1

# Try to access without token
curl -i "http://localhost:3001/files/${FILENAME}"
```

**Expected Result**:
```
✅ HTTP 403 Forbidden or 401 Unauthorized
✅ Error message: "Authentication required" or similar
```

### Step 5: Access file with different visitor's token - should return 403

```bash
# Generate a token for a different visitor
# This requires using the JWT secret from your .env file

# Using Node.js (requires jsonwebtoken package):
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { visitorId: 'different-visitor-456', filename: '${FILENAME}' },
  '${JWT_SECRET}',
  { expiresIn: '7d' }
);
console.log(token);
"

# Or use the integration test script which does this automatically

# Try to access with the different visitor's token
curl -i "http://localhost:3001/files/${FILENAME}?token=<token from above>"
```

**Expected Result**:
```
✅ HTTP 403 Forbidden
✅ Error message: "Access denied to this file" or similar
```

## Automated Test

You can also run the automated integration test:

```bash
cd apps/api

# Make sure server is running in another terminal
pnpm dev

# Run the integration test
npx tsx src/tests/integration/webchat-file-access.test.ts
```

The test will automatically perform all 5 verification steps and report success/failure.

## Success Criteria

All of the following must be true:

- [x] File upload via webchat returns a signed URL with JWT token
- [x] File can be accessed with valid token (200 OK)
- [x] File cannot be accessed without token (403/401 error)
- [x] File cannot be accessed with a different visitor's token (403 error)
- [x] Token contains visitorId and filename claims
- [x] Token has expiration set (7 days)

## Troubleshooting

### Upload fails with "File type not allowed"
Use a supported file type (.txt, .pdf, .jpg, .png, etc.)

### Access fails with "File not found"
Check that the uploads directory exists and the file was actually saved

### All access attempts return 200 (even without token)
This indicates the middleware is not working. Check:
- Files route is properly registered
- validateFileAccess middleware is applied
- Routes are in correct order (files route before catch-all)

### Token validation fails
Check that JWT_SECRET environment variable matches between upload and access
