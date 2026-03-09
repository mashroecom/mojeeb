/**
 * Integration test for webchat file upload and access flow
 *
 * This test verifies:
 * 1. Upload file via webchat widget as visitor
 * 2. Verify file URL returned contains signed token
 * 3. Access file with token - should succeed
 * 4. Access file without token - should return 403
 * 5. Access file with different visitor's token - should return 403
 *
 * Prerequisites:
 * - Server must be running (pnpm dev)
 * - Database must be seeded with at least one active webchat channel
 *
 * Usage:
 *   npx tsx src/tests/integration/webchat-file-access.test.ts
 */

import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import FormData from 'form-data';

const API_URL = process.env.API_URL || 'http://localhost:3001';
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

async function discoverWebchatChannel(): Promise<string> {
  log('Discovering webchat channel...');

  const response = await fetch(`${API_URL}/api/v1/webchat/discover`);
  const data = await response.json();

  if (!data.success || !data.data.channelId) {
    throw new Error('No active webchat channel found. Please create one first.');
  }

  log(`Found channel: ${data.data.channelId}`);
  return data.data.channelId;
}

async function uploadFileAsVisitor(
  channelId: string,
  visitorId: string,
  visitorName: string
): Promise<{ fileUrl: string; conversationId: string }> {
  log(`Uploading file as visitor ${visitorId}...`);

  // Create a test file
  const testFilePath = path.join('/tmp', 'test-upload.txt');
  fs.writeFileSync(testFilePath, 'This is a test file for webchat upload verification');

  const formData = new FormData();
  formData.append('file', fs.createReadStream(testFilePath));
  formData.append('visitorId', visitorId);
  formData.append('visitorName', visitorName);

  const response = await fetch(`${API_URL}/api/v1/webchat/${channelId}/upload`, {
    method: 'POST',
    body: formData as any,
    headers: formData.getHeaders(),
  });

  const data = await response.json();

  // Clean up test file
  fs.unlinkSync(testFilePath);

  if (!data.success) {
    throw new Error(`Upload failed: ${data.error}`);
  }

  log(`File uploaded: ${data.data.fileUrl}`);
  return {
    fileUrl: data.data.fileUrl,
    conversationId: data.data.conversationId,
  };
}

function extractTokenFromUrl(fileUrl: string): string | null {
  const match = fileUrl.match(/\?token=([^&]+)/);
  return match ? match[1] : null;
}

function extractFilenameFromUrl(fileUrl: string): string {
  const match = fileUrl.match(/\/files\/([^?]+)/);
  return match ? match[1] : '';
}

async function accessFileWithToken(fileUrl: string): Promise<boolean> {
  log(`Accessing file with token: ${fileUrl}`);

  const response = await fetch(`${API_URL}${fileUrl}`);

  if (response.status === 200) {
    const content = await response.text();
    log(`File accessed successfully, content length: ${content.length}`);
    return true;
  }

  log(`Access failed with status: ${response.status}`);
  return false;
}

async function accessFileWithoutToken(filename: string): Promise<number> {
  const fileUrl = `${API_URL}/files/${filename}`;
  log(`Accessing file without token: ${fileUrl}`);

  const response = await fetch(fileUrl);
  log(`Response status: ${response.status}`);

  return response.status;
}

async function accessFileWithDifferentToken(filename: string, differentVisitorId: string): Promise<number> {
  const payload = {
    visitorId: differentVisitorId,
    filename,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const fileUrl = `${API_URL}/files/${filename}?token=${token}`;

  log(`Accessing file with different visitor's token: ${fileUrl}`);

  const response = await fetch(fileUrl);
  log(`Response status: ${response.status}`);

  return response.status;
}

async function runTests() {
  console.log('\n=== Webchat File Upload and Access Flow Test ===\n');
  console.log(`API URL: ${API_URL}\n`);

  try {
    // Step 1: Discover webchat channel
    const channelId = await discoverWebchatChannel();
    addResult('Step 1: Discover webchat channel', true, undefined, { channelId });

    // Step 2: Upload file as visitor
    const visitor1Id = `test-visitor-${Date.now()}`;
    const visitor1Name = 'Test Visitor 1';

    const { fileUrl, conversationId } = await uploadFileAsVisitor(
      channelId,
      visitor1Id,
      visitor1Name
    );

    addResult('Step 2: Upload file via webchat widget', true, undefined, {
      fileUrl,
      conversationId,
      visitorId: visitor1Id,
    });

    // Step 3: Verify file URL contains signed token
    const token = extractTokenFromUrl(fileUrl);
    if (!token) {
      addResult('Step 3: Verify file URL contains signed token', false, 'No token found in URL');
    } else {
      // Verify token is valid JWT
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const hasVisitorId = !!decoded.visitorId;
        const hasFilename = !!decoded.filename;
        const hasExpiration = !!decoded.exp;

        if (hasVisitorId && hasFilename && hasExpiration) {
          addResult('Step 3: Verify file URL contains signed token', true, undefined, {
            token: token.substring(0, 20) + '...',
            decoded: { visitorId: decoded.visitorId, filename: decoded.filename },
          });
        } else {
          addResult(
            'Step 3: Verify file URL contains signed token',
            false,
            'Token missing required fields',
            { decoded }
          );
        }
      } catch (err) {
        addResult('Step 3: Verify file URL contains signed token', false, `Invalid JWT: ${err}`);
      }
    }

    // Step 4: Access file with token - should succeed
    const accessWithTokenSuccess = await accessFileWithToken(fileUrl);
    if (accessWithTokenSuccess) {
      addResult('Step 4: Access file with token', true);
    } else {
      addResult('Step 4: Access file with token', false, 'Expected 200, got non-200 status');
    }

    // Step 5: Access file without token - should return 403
    const filename = extractFilenameFromUrl(fileUrl);
    const statusWithoutToken = await accessFileWithoutToken(filename);

    if (statusWithoutToken === 403 || statusWithoutToken === 401) {
      addResult('Step 5: Access file without token', true, undefined, {
        expectedStatus: '403 or 401',
        actualStatus: statusWithoutToken,
      });
    } else {
      addResult(
        'Step 5: Access file without token',
        false,
        `Expected 403/401, got ${statusWithoutToken}`
      );
    }

    // Step 6: Access file with different visitor's token - should return 403
    const visitor2Id = `test-visitor-different-${Date.now()}`;
    const statusWithDifferentToken = await accessFileWithDifferentToken(filename, visitor2Id);

    if (statusWithDifferentToken === 403) {
      addResult('Step 6: Access file with different visitor token', true, undefined, {
        expectedStatus: 403,
        actualStatus: statusWithDifferentToken,
      });
    } else {
      addResult(
        'Step 6: Access file with different visitor token',
        false,
        `Expected 403, got ${statusWithDifferentToken}`
      );
    }

  } catch (err) {
    logError(`Test execution failed: ${err}`);
    addResult('Test execution', false, String(err));
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
    console.log('\n✅ All tests passed! File access control is working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  logError(`Unhandled error: ${err}`);
  process.exit(1);
});
