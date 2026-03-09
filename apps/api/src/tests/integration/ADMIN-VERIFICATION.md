# Admin File Upload and Access Verification Guide

This guide provides step-by-step instructions for manually testing the admin file upload and access control flow.

## Prerequisites

1. Server must be running: `cd apps/api && pnpm dev`
2. You need access to the database to create a super admin user
3. You have an API client (Postman, curl, or browser DevTools)

## Test Setup

### 1. Create Test Users

```sql
-- Create a super admin user
INSERT INTO "User" (id, email, "firstName", "lastName", password, "isSuperAdmin", "isActive")
VALUES (
  'test-super-admin-id',
  'superadmin@example.com',
  'Super',
  'Admin',
  '$2b$10$somehashedpassword', -- Use a bcrypt hashed password
  true,
  true
);

-- Create a regular user
INSERT INTO "User" (id, email, "firstName", "lastName", password, "isSuperAdmin", "isActive")
VALUES (
  'test-regular-user-id',
  'regularuser@example.com',
  'Regular',
  'User',
  '$2b$10$somehashedpassword',
  false,
  true
);

-- Create an organization
INSERT INTO "Organization" (id, name, slug)
VALUES ('test-org-id', 'Test Organization', 'test-org');

-- Add regular user to organization
INSERT INTO "OrgMembership" ("userId", "orgId", role)
VALUES ('test-regular-user-id', 'test-org-id', 'AGENT');
```

### 2. Get Authentication Tokens

Login as each user to get their JWT tokens:

```bash
# Login as super admin
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@example.com",
    "password": "your-password"
  }'

# Save the returned token as SUPER_ADMIN_TOKEN

# Login as regular user
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "regularuser@example.com",
    "password": "your-password"
  }'

# Save the returned token as REGULAR_USER_TOKEN
```

## Test Scenarios

### Test 1: Upload Regular File as Super Admin

```bash
# Create a test file
echo "This is a regular admin file" > test-admin-file.txt

# Upload via admin panel
curl -X POST http://localhost:4000/api/v1/organizations/test-org-id/admin/files \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -F "file=@test-admin-file.txt"

# Expected response:
# {
#   "success": true,
#   "data": {
#     "name": "test-admin-file.txt",
#     "relativePath": "/files/1234567890-123456.txt",
#     "size": 30,
#     "mimeType": "text/plain"
#   }
# }

# Save the filename (e.g., "1234567890-123456.txt") as REGULAR_FILE
```

**Expected:** ✅ File uploaded successfully, returns file path `/files/{filename}`

### Test 2: Upload Public File (Logo)

```bash
# Create a logo file
echo "Logo content" > logo-test.png

# Upload via admin panel
curl -X POST http://localhost:4000/api/v1/organizations/test-org-id/admin/files \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -F "file=@logo-test.png"

# Save the filename as PUBLIC_FILE
```

**Expected:** ✅ File uploaded successfully with public pattern name

### Test 3: Access Public File Without Auth

```bash
# Access the logo file without authentication
curl http://localhost:4000/files/$PUBLIC_FILE
```

**Expected:** ✅ 200 OK - File content is returned (public files accessible to everyone)

### Test 4: Access Non-Public Admin File with Super Admin Token

```bash
# Access the regular admin file with super admin token
curl -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  http://localhost:4000/files/$REGULAR_FILE
```

**Expected:** ✅ 200 OK - File content is returned (super admins can access admin files)

### Test 5: Access Non-Public Admin File as Regular User

```bash
# Try to access the admin file with regular user token
curl -H "Authorization: Bearer $REGULAR_USER_TOKEN" \
  http://localhost:4000/files/$REGULAR_FILE
```

**Expected:** ✅ 403 Forbidden - Regular users cannot access admin-uploaded files

**Response:**
```json
{
  "success": false,
  "error": "File not found or access denied"
}
```

### Test 6: Access Non-Public Admin File Without Token

```bash
# Try to access the admin file without authentication
curl http://localhost:4000/files/$REGULAR_FILE
```

**Expected:** ✅ 403 Forbidden or 401 Unauthorized - Authentication required

## Cleanup

```bash
# Delete test files from uploads directory
rm -f apps/api/uploads/$REGULAR_FILE
rm -f apps/api/uploads/$PUBLIC_FILE

# Delete test data from database
DELETE FROM "OrgMembership" WHERE "orgId" = 'test-org-id';
DELETE FROM "User" WHERE id IN ('test-super-admin-id', 'test-regular-user-id');
DELETE FROM "Organization" WHERE id = 'test-org-id';
```

## Success Criteria

All of the following must be true:

- [x] Super admin can upload files via admin panel
- [x] Public files (logo-, landing-, etc.) are accessible without authentication
- [x] Super admin can access non-public admin files with Bearer token
- [x] Regular users cannot access non-public admin files (403 Forbidden)
- [x] Unauthenticated requests to non-public admin files are rejected (403/401)

## Troubleshooting

### Issue: Cannot upload file (401 Unauthorized)

**Cause:** Token expired or user is not super admin

**Solution:**
1. Verify user has `isSuperAdmin = true` in database
2. Get a fresh token by logging in again
3. Check that the token is included in the Authorization header

### Issue: Public file returns 403

**Cause:** Filename doesn't match public patterns

**Solution:** Use filenames that start with:
- `logo-`
- `favicon-`
- `og-image-`
- `landing-`
- `hero-`
- `feature-`

### Issue: Regular user can access admin file

**Cause:** Bug in access control logic

**Solution:** Check `fileAccess.service.ts` - admin files (not in database) should require super admin access

## Notes

- Admin files are uploaded to the `/uploads` directory
- They are not associated with any conversation or message in the database
- The `fileAccess.service.ts` detects these as admin files when not found in the messages table
- Access is granted only to super admins (unless file matches public pattern)
