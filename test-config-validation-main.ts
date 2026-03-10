#!/usr/bin/env tsx

/**
 * Main test runner - spawns separate processes for each test
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
const backupPath = path.join(__dirname, '.env.backup-test');

// Backup current .env
console.log('📦 Backing up current .env...\n');
fs.copyFileSync(envPath, backupPath);

// Read base .env content
const baseEnv = fs.readFileSync(envPath, 'utf-8');

interface TestResult {
  name: string;
  passed: boolean;
}

function testValidation(
  testName: string,
  envOverrides: Record<string, string>,
  shouldPass: boolean
): TestResult {
  console.log(`${'='.repeat(60)}`);
  console.log(`🧪 TEST: ${testName}`);
  console.log(`${'='.repeat(60)}`);

  // Create test .env
  let testEnv = baseEnv;
  for (const [key, value] of Object.entries(envOverrides)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (testEnv.match(regex)) {
      testEnv = testEnv.replace(regex, `${key}=${value}`);
    } else {
      testEnv += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, testEnv);

  try {
    // Run validation in a separate process
    const result = execSync('npx tsx ./test-validation-runner.ts 2>&1', {
      cwd: __dirname,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    if (shouldPass) {
      console.log('✅ RESULT: Validation passed (as expected)\n');
      return { name: testName, passed: true };
    } else {
      console.log('❌ RESULT: Validation passed but should have failed!');
      console.log('Output:', result.trim(), '\n');
      return { name: testName, passed: false };
    }
  } catch (error: any) {
    // Get the actual error output
    const stderr = (error.stderr || '').toString();
    const stdout = (error.stdout || '').toString();
    const output = (stdout + stderr).replace(/npm warn.*/g, '').trim();

    if (!shouldPass) {
      console.log('✅ RESULT: Validation failed (as expected)');
      const errorMsg = output.match(/VALIDATION_FAILED: (.*)/)?.[1] || output;
      console.log('Error:', errorMsg.trim(), '\n');
      return { name: testName, passed: true };
    } else {
      console.log('❌ RESULT: Validation failed but should have passed!');
      const errorMsg = output.match(/VALIDATION_FAILED: (.*)/)?.[1] || output;
      console.log('Error:', errorMsg.trim(), '\n');
      return { name: testName, passed: false };
    }
  }
}

// Run tests
const results: TestResult[] = [];

console.log('='.repeat(60));
console.log('CONFIG VALIDATION SECURITY TESTS');
console.log('='.repeat(60), '\n');

// Test 1: Weak JWT_SECRET (placeholder)
results.push(
  testValidation(
    'Test 1: Weak JWT_SECRET (placeholder)',
    { JWT_SECRET: 'your-jwt-secret-change-in-production' },
    false
  )
);

// Test 2: Short JWT_SECRET (less than 32 chars)
results.push(
  testValidation('Test 2: Short JWT_SECRET (< 32 chars)', { JWT_SECRET: 'tooshort' }, false)
);

// Test 3: JWT_SECRET with placeholder word "secret"
results.push(
  testValidation(
    'Test 3: JWT_SECRET with word "secret"',
    { JWT_SECRET: 'this-is-my-secret-key-for-jwt-tokens-abc123' },
    false
  )
);

// Test 4: Example ENCRYPTION_KEY
const currentJWT = baseEnv.match(/^JWT_SECRET=(.*)$/m)?.[1] || '';
results.push(
  testValidation(
    'Test 4: Example ENCRYPTION_KEY',
    {
      JWT_SECRET: currentJWT, // Use current JWT
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
    false
  )
);

// Test 5: Invalid ENCRYPTION_KEY (wrong length)
results.push(
  testValidation(
    'Test 5: Invalid ENCRYPTION_KEY (wrong length)',
    {
      JWT_SECRET: currentJWT,
      ENCRYPTION_KEY: 'abc123',
    },
    false
  )
);

// Test 6: Invalid ENCRYPTION_KEY (non-hex characters)
results.push(
  testValidation(
    'Test 6: Invalid ENCRYPTION_KEY (non-hex)',
    {
      JWT_SECRET: currentJWT,
      ENCRYPTION_KEY: 'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg',
    },
    false
  )
);

// Test 7: Proper secrets (should pass)
const strongJWT = crypto.randomBytes(48).toString('base64');
const strongEncKey = crypto.randomBytes(32).toString('hex');

// Get current DATABASE_URL and REDIS_URL from base env
const currentDB = baseEnv.match(/^DATABASE_URL=(.*)$/m)?.[1] || 'postgresql://mojeeb:password@localhost:5432/mojeeb';
const currentRedis = baseEnv.match(/^REDIS_URL=(.*)$/m)?.[1] || 'redis://localhost:6379';

results.push(
  testValidation(
    'Test 7: Proper secrets (should PASS)',
    {
      JWT_SECRET: strongJWT,
      ENCRYPTION_KEY: strongEncKey,
      DATABASE_URL: currentDB,
      REDIS_URL: currentRedis,
    },
    true
  )
);

// Restore original .env
console.log(`${'='.repeat(60)}`);
console.log('🔄 Restoring original .env...\n');
fs.copyFileSync(backupPath, envPath);
fs.unlinkSync(backupPath);

// Print summary
console.log('='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));

let allPassed = true;
results.forEach((result) => {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${result.name}`);
  if (!result.passed) allPassed = false;
});

console.log(`\n${'='.repeat(60)}`);
if (allPassed) {
  console.log('✅ ALL TESTS PASSED - Config validation is working correctly!');
  console.log('='.repeat(60));
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED - Config validation has issues!');
  console.log('='.repeat(60));
  process.exit(1);
}
