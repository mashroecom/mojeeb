/**
 * Integration test for admin file upload and access flow
 *
 * This test verifies:
 * 1. Upload file via admin panel as super admin
 * 2. Upload public file (with public pattern like logo-)
 * 3. Access public file without auth - should succeed
 * 4. Access non-public admin file with super admin token - should succeed
 * 5. Access non-public admin file as regular user - should return 403
 *
 * Prerequisites:
 * - Server must be running (pnpm dev)
 * - Database must be accessible
 *
 * Usage:
 *   npx tsx src/tests/integration/admin-file-access.test.ts
 */

import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import FormData from 'form-data';
import { prisma } from '../../config/database';

const API_URL = process.env.API_URL || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-must-be-at-least-32-characters-long-for-hs256';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function log(message: string, ...args: any[]) {
  console.log(`[TEST] ${message}`, ...args);
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string) {
  console.log(`❌ ${message}`);
}

function addResult(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  if (passed) {
    logSuccess(name);
  } else {
    logError(`${name}: ${error}`);
  }
}

function generateUserToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

interface TestSetup {
  orgId: string;
  superAdmin: { id: string; email: string; token: string };
  regularUser: { id: string; email: string; token: string };
}

async function setupTestData(): Promise<TestSetup> {
  log('Setting up test data...');

  // Create a test organization
  const org = await prisma.organization.create({
    data: {
      name: `Test Admin Org - ${Date.now()}`,
      slug: `test-admin-org-${Date.now()}`,
    },
  });

  // Create a super admin user
  const superAdmin = await prisma.user.create({
    data: {
      email: `super-admin-${Date.now()}@example.com`,
      firstName: 'Super',
      lastName: 'Admin',
      password: 'hashed-password',
      isActive: true,
      isSuperAdmin: true,
    },
  });

  // Create a regular user
  const regularUser = await prisma.user.create({
    data: {
      email: `regular-user-${Date.now()}@example.com`,
      firstName: 'Regular',
      lastName: 'User',
      password: 'hashed-password',
      isActive: true,
      isSuperAdmin: false,
    },
  });

  // Add regular user to organization (but not super admin role)
  await prisma.orgMembership.create({
    data: {
      userId: regularUser.id,
      orgId: org.id,
      role: 'AGENT',
    },
  });

  log(`Created org: ${org.id}`);
  log(`Created super admin: ${superAdmin.id}`);
  log(`Created regular user: ${regularUser.id}`);

  return {
    orgId: org.id,
    superAdmin: {
      id: superAdmin.id,
      email: superAdmin.email,
      token: generateUserToken(superAdmin.id, superAdmin.email),
    },
    regularUser: {
      id: regularUser.id,
      email: regularUser.email,
      token: generateUserToken(regularUser.id, regularUser.email),
    },
  };
}

async function cleanupTestData(setup: TestSetup) {
  log('Cleaning up test data...');

  try {
    // Delete in reverse order of dependencies
    await prisma.orgMembership.deleteMany({
      where: {
        userId: { in: [setup.superAdmin.id, setup.regularUser.id] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [setup.superAdmin.id, setup.regularUser.id] },
      },
    });

    await prisma.organization.deleteMany({
      where: {
        id: setup.orgId,
      },
    });

    log('Cleanup completed');
  } catch (err) {
    logError(`Cleanup failed: ${err}`);
  }
}

async function uploadAdminFile(
  orgId: string,
  token: string,
  fileName: string,
  fileContent: string
): Promise<{ fileUrl: string; filename: string }> {
  log(`Uploading admin file: ${fileName}...`);

  // Create a test file
  const testFilePath = path.join('/tmp', fileName);
  fs.writeFileSync(testFilePath, fileContent);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(testFilePath), fileName);

  const response = await fetch(
    `${API_URL}/api/v1/organizations/${orgId}/admin/files`,
    {
      method: 'POST',
      body: formData as any,
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  // Clean up test file
  fs.unlinkSync(testFilePath);

  if (!data.success) {
    throw new Error(`Upload failed: ${data.error || JSON.stringify(data)}`);
  }

  log(`File uploaded: ${data.data.relativePath}`);
  return {
    fileUrl: data.data.relativePath,
    filename: extractFilenameFromUrl(data.data.relativePath),
  };
}

function extractFilenameFromUrl(fileUrl: string): string {
  const match = fileUrl.match(/\/files\/([^?]+)/);
  return match ? match[1] : '';
}

async function accessFileWithBearerToken(filename: string, token: string): Promise<number> {
  const fileUrl = `${API_URL}/files/${filename}`;
  log(`Accessing file with Bearer token: ${fileUrl}`);

  const response = await fetch(fileUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  log(`Response status: ${response.status}`);
  return response.status;
}

async function accessFileWithoutToken(filename: string): Promise<number> {
  const fileUrl = `${API_URL}/files/${filename}`;
  log(`Accessing file without token: ${fileUrl}`);

  const response = await fetch(fileUrl);
  log(`Response status: ${response.status}`);

  return response.status;
}

async function runTests() {
  console.log('\n=== Admin File Upload and Access Flow Test ===\n');
  console.log(`API URL: ${API_URL}\n`);

  let setup: TestSetup | null = null;
  let regularFileFilename = '';
  let publicFileFilename = '';

  try {
    // Step 1: Setup test data
    setup = await setupTestData();
    addResult('Step 1: Setup test super admin and regular user', true, undefined, {
      orgId: setup.orgId,
      superAdminId: setup.superAdmin.id,
      regularUserId: setup.regularUser.id,
    });

    // Step 2: Upload regular (non-public) file via admin panel as super admin
    const regularFile = await uploadAdminFile(
      setup.orgId,
      setup.superAdmin.token,
      'test-admin-upload.txt',
      'This is a regular admin file upload'
    );
    regularFileFilename = regularFile.filename;

    addResult('Step 2: Upload regular file via admin panel as super admin', true, undefined, {
      fileUrl: regularFile.fileUrl,
      filename: regularFile.filename,
    });

    // Step 3: Upload public file (with public pattern like logo-)
    const publicFile = await uploadAdminFile(
      setup.orgId,
      setup.superAdmin.token,
      'logo-test.png',
      'This is a public logo file'
    );
    publicFileFilename = publicFile.filename;

    addResult('Step 3: Upload public file (logo- pattern)', true, undefined, {
      fileUrl: publicFile.fileUrl,
      filename: publicFile.filename,
      note: 'File matches public pattern: logo-',
    });

    // Step 4: Access public file without auth - should succeed
    const statusPublicNoAuth = await accessFileWithoutToken(publicFileFilename);

    if (statusPublicNoAuth === 200) {
      addResult('Step 4: Access public file without auth', true, undefined, {
        expectedStatus: 200,
        actualStatus: statusPublicNoAuth,
        note: 'Public files (logo-, landing-, etc.) should be accessible without auth',
      });
    } else {
      addResult(
        'Step 4: Access public file without auth',
        false,
        `Expected 200, got ${statusPublicNoAuth}`
      );
    }

    // Step 5: Access non-public admin file with super admin token - should succeed
    const statusAdminWithAuth = await accessFileWithBearerToken(
      regularFileFilename,
      setup.superAdmin.token
    );

    if (statusAdminWithAuth === 200) {
      addResult('Step 5: Access non-public admin file with super admin token', true, undefined, {
        expectedStatus: 200,
        actualStatus: statusAdminWithAuth,
        note: 'Super admins can access admin-uploaded files',
      });
    } else {
      addResult(
        'Step 5: Access non-public admin file with super admin token',
        false,
        `Expected 200, got ${statusAdminWithAuth}`
      );
    }

    // Step 6: Access non-public admin file as regular user - should return 403
    const statusAdminRegularUser = await accessFileWithBearerToken(
      regularFileFilename,
      setup.regularUser.token
    );

    if (statusAdminRegularUser === 403) {
      addResult('Step 6: Access non-public admin file as regular user', true, undefined, {
        expectedStatus: 403,
        actualStatus: statusAdminRegularUser,
        note: 'Regular users cannot access admin-uploaded files',
      });
    } else {
      addResult(
        'Step 6: Access non-public admin file as regular user',
        false,
        `Expected 403, got ${statusAdminRegularUser}`
      );
    }

    // Step 7: Access non-public admin file without token - should return 403/401
    const statusAdminNoAuth = await accessFileWithoutToken(regularFileFilename);

    if (statusAdminNoAuth === 403 || statusAdminNoAuth === 401) {
      addResult('Step 7: Access non-public admin file without token', true, undefined, {
        expectedStatus: '403 or 401',
        actualStatus: statusAdminNoAuth,
      });
    } else {
      addResult(
        'Step 7: Access non-public admin file without token',
        false,
        `Expected 403/401, got ${statusAdminNoAuth}`
      );
    }

  } catch (err) {
    logError(`Test execution failed: ${err}`);
    addResult('Test execution', false, String(err));
  } finally {
    // Cleanup uploaded files
    if (regularFileFilename) {
      try {
        const regularFilePath = path.join(__dirname, '../../../uploads', regularFileFilename);
        if (fs.existsSync(regularFilePath)) {
          fs.unlinkSync(regularFilePath);
          log(`Deleted test file: ${regularFileFilename}`);
        }
      } catch (err) {
        log(`Failed to delete regular file: ${err}`);
      }
    }

    if (publicFileFilename) {
      try {
        const publicFilePath = path.join(__dirname, '../../../uploads', publicFileFilename);
        if (fs.existsSync(publicFilePath)) {
          fs.unlinkSync(publicFilePath);
          log(`Deleted test file: ${publicFileFilename}`);
        }
      } catch (err) {
        log(`Failed to delete public file: ${err}`);
      }
    }

    // Cleanup test data
    if (setup) {
      await cleanupTestData(setup);
    }

    // Disconnect from database
    await prisma.$disconnect();
  }

  // Print summary
  console.log('\n=== Test Summary ===\n');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${status}: ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
  });

  console.log(`\nTotal: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n✅ All tests passed! Admin file access control is working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  logError(`Unhandled error: ${err}`);
  prisma.$disconnect();
  process.exit(1);
});
