/**
 * Integration test for dashboard file upload and access flow
 *
 * This test verifies:
 * 1. Upload file via dashboard as authenticated agent
 * 2. Access file with Bearer token - should succeed
 * 3. Access file from different org member - should succeed
 * 4. Access file from non-member - should return 403
 * 5. Access file without token - should return 403
 *
 * Prerequisites:
 * - Server must be running (pnpm dev)
 * - Database must be accessible
 *
 * Usage:
 *   npx tsx src/tests/integration/dashboard-file-access.test.ts
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
  org1Id: string;
  org2Id: string;
  user1: { id: string; email: string; token: string };
  user2: { id: string; email: string; token: string };
  user3: { id: string; email: string; token: string };
  conversationId: string;
}

async function setupTestData(): Promise<TestSetup> {
  log('Setting up test data...');

  // Create two organizations
  const org1 = await prisma.organization.create({
    data: {
      name: `Test Org 1 - ${Date.now()}`,
      slug: `test-org-1-${Date.now()}`,
    },
  });

  const org2 = await prisma.organization.create({
    data: {
      name: `Test Org 2 - ${Date.now()}`,
      slug: `test-org-2-${Date.now()}`,
    },
  });

  // Create three test users
  const user1 = await prisma.user.create({
    data: {
      email: `test-user-1-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User 1',
      password: 'hashed-password',
      isActive: true,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: `test-user-2-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User 2',
      password: 'hashed-password',
      isActive: true,
    },
  });

  const user3 = await prisma.user.create({
    data: {
      email: `test-user-3-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User 3',
      password: 'hashed-password',
      isActive: true,
    },
  });

  // Add user1 and user2 to org1
  await prisma.orgMembership.create({
    data: {
      userId: user1.id,
      orgId: org1.id,
      role: 'AGENT',
    },
  });

  await prisma.orgMembership.create({
    data: {
      userId: user2.id,
      orgId: org1.id,
      role: 'AGENT',
    },
  });

  // Add user3 to org2 (different organization)
  await prisma.orgMembership.create({
    data: {
      userId: user3.id,
      orgId: org2.id,
      role: 'AGENT',
    },
  });

  // Create a conversation in org1
  const conversation = await prisma.conversation.create({
    data: {
      orgId: org1.id,
      customerId: `test-customer-${Date.now()}`,
      status: 'OPEN',
    },
  });

  log(`Created org1: ${org1.id}, org2: ${org2.id}`);
  log(`Created user1: ${user1.id}, user2: ${user2.id}, user3: ${user3.id}`);
  log(`Created conversation: ${conversation.id}`);

  return {
    org1Id: org1.id,
    org2Id: org2.id,
    user1: {
      id: user1.id,
      email: user1.email,
      token: generateUserToken(user1.id, user1.email),
    },
    user2: {
      id: user2.id,
      email: user2.email,
      token: generateUserToken(user2.id, user2.email),
    },
    user3: {
      id: user3.id,
      email: user3.email,
      token: generateUserToken(user3.id, user3.email),
    },
    conversationId: conversation.id,
  };
}

async function cleanupTestData(setup: TestSetup) {
  log('Cleaning up test data...');

  try {
    // Delete in reverse order of dependencies
    await prisma.message.deleteMany({
      where: {
        conversation: {
          orgId: { in: [setup.org1Id, setup.org2Id] },
        },
      },
    });

    await prisma.conversation.deleteMany({
      where: {
        orgId: { in: [setup.org1Id, setup.org2Id] },
      },
    });

    await prisma.orgMembership.deleteMany({
      where: {
        userId: { in: [setup.user1.id, setup.user2.id, setup.user3.id] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [setup.user1.id, setup.user2.id, setup.user3.id] },
      },
    });

    await prisma.organization.deleteMany({
      where: {
        id: { in: [setup.org1Id, setup.org2Id] },
      },
    });

    log('Cleanup completed');
  } catch (err) {
    logError(`Cleanup failed: ${err}`);
  }
}

async function uploadFileAsDashboardUser(
  orgId: string,
  conversationId: string,
  token: string
): Promise<{ fileUrl: string; filename: string }> {
  log(`Uploading file to conversation ${conversationId}...`);

  // Create a test file
  const testFilePath = path.join('/tmp', 'test-dashboard-upload.txt');
  fs.writeFileSync(testFilePath, 'This is a test file for dashboard upload verification');

  const formData = new FormData();
  formData.append('file', fs.createReadStream(testFilePath));

  const response = await fetch(
    `${API_URL}/api/v1/organizations/${orgId}/conversations/${conversationId}/upload`,
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

  log(`File uploaded: ${data.data.fileUrl}`);
  return {
    fileUrl: data.data.fileUrl,
    filename: extractFilenameFromUrl(data.data.fileUrl),
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
  console.log('\n=== Dashboard File Upload and Access Flow Test ===\n');
  console.log(`API URL: ${API_URL}\n`);

  let setup: TestSetup | null = null;

  try {
    // Step 1: Setup test data
    setup = await setupTestData();
    addResult('Step 1: Setup test organizations and users', true, undefined, {
      org1Id: setup.org1Id,
      org2Id: setup.org2Id,
      user1Id: setup.user1.id,
      user2Id: setup.user2.id,
      user3Id: setup.user3.id,
    });

    // Step 2: Upload file via dashboard as authenticated agent (user1)
    const { fileUrl, filename } = await uploadFileAsDashboardUser(
      setup.org1Id,
      setup.conversationId,
      setup.user1.token
    );

    addResult('Step 2: Upload file via dashboard as authenticated agent', true, undefined, {
      fileUrl,
      filename,
      uploadedBy: setup.user1.id,
    });

    // Step 3: Access file with Bearer token (same user) - should succeed
    const statusSameUser = await accessFileWithBearerToken(filename, setup.user1.token);

    if (statusSameUser === 200) {
      addResult('Step 3: Access file with Bearer token (same user)', true, undefined, {
        expectedStatus: 200,
        actualStatus: statusSameUser,
      });
    } else {
      addResult(
        'Step 3: Access file with Bearer token (same user)',
        false,
        `Expected 200, got ${statusSameUser}`
      );
    }

    // Step 4: Access file from different org member (user2 in same org) - should succeed
    const statusOrgMember = await accessFileWithBearerToken(filename, setup.user2.token);

    if (statusOrgMember === 200) {
      addResult('Step 4: Access file from different org member', true, undefined, {
        expectedStatus: 200,
        actualStatus: statusOrgMember,
        note: 'User2 is in same organization as User1',
      });
    } else {
      addResult(
        'Step 4: Access file from different org member',
        false,
        `Expected 200, got ${statusOrgMember}`
      );
    }

    // Step 5: Access file from non-member (user3 in different org) - should return 403
    const statusNonMember = await accessFileWithBearerToken(filename, setup.user3.token);

    if (statusNonMember === 403) {
      addResult('Step 5: Access file from non-member', true, undefined, {
        expectedStatus: 403,
        actualStatus: statusNonMember,
        note: 'User3 is in different organization',
      });
    } else {
      addResult(
        'Step 5: Access file from non-member',
        false,
        `Expected 403, got ${statusNonMember}`
      );
    }

    // Step 6: Access file without token - should return 403/401
    const statusNoToken = await accessFileWithoutToken(filename);

    if (statusNoToken === 403 || statusNoToken === 401) {
      addResult('Step 6: Access file without token', true, undefined, {
        expectedStatus: '403 or 401',
        actualStatus: statusNoToken,
      });
    } else {
      addResult(
        'Step 6: Access file without token',
        false,
        `Expected 403/401, got ${statusNoToken}`
      );
    }

  } catch (err) {
    logError(`Test execution failed: ${err}`);
    addResult('Test execution', false, String(err));
  } finally {
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
    console.log('\n✅ All tests passed! Dashboard file access control is working correctly.\n');
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
