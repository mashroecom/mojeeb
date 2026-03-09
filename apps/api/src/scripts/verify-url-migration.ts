#!/usr/bin/env node
/**
 * Verification script to check legacy URL migration status
 *
 * This script verifies that all file URLs have been migrated from /uploads/ to /files/
 *
 * Usage:
 *   npx tsx src/scripts/verify-url-migration.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VerificationResult {
  totalMessages: number;
  legacyUrlCount: number;
  newUrlCount: number;
  sampleLegacyUrls: string[];
  passed: boolean;
}

async function verifyUrlMigration(): Promise<VerificationResult> {
  console.log('🔍 Starting URL migration verification...\n');

  // Count all messages with file content types
  const totalMessages = await prisma.message.count({
    where: {
      contentType: {
        in: ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'],
      },
    },
  });

  console.log(`📊 Total file messages in database: ${totalMessages}`);

  // Find messages with legacy /uploads/ URLs
  const legacyMessages = await prisma.message.findMany({
    where: {
      AND: [
        {
          contentType: {
            in: ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'],
          },
        },
        {
          content: {
            contains: '/uploads/',
            mode: 'insensitive',
          },
        },
      ],
    },
    select: {
      id: true,
      content: true,
      contentType: true,
      conversationId: true,
      createdAt: true,
    },
    take: 10, // Sample first 10
  });

  // Find messages with new /files/ URLs
  const newMessages = await prisma.message.count({
    where: {
      AND: [
        {
          contentType: {
            in: ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'],
          },
        },
        {
          content: {
            contains: '/files/',
            mode: 'insensitive',
          },
        },
      ],
    },
  });

  const result: VerificationResult = {
    totalMessages,
    legacyUrlCount: legacyMessages.length,
    newUrlCount: newMessages,
    sampleLegacyUrls: legacyMessages.map((m) => m.content),
    passed: legacyMessages.length === 0,
  };

  // Print results
  console.log(`\n📋 Verification Results:`);
  console.log(`   Legacy URLs (/uploads/): ${result.legacyUrlCount}`);
  console.log(`   New URLs (/files/): ${result.newUrlCount}`);

  if (result.legacyUrlCount > 0) {
    console.log(`\n⚠️  Found ${result.legacyUrlCount} messages with legacy /uploads/ URLs:`);
    legacyMessages.forEach((msg, i) => {
      console.log(`\n   ${i + 1}. Message ID: ${msg.id}`);
      console.log(`      Type: ${msg.contentType}`);
      console.log(`      Content: ${msg.content.substring(0, 100)}...`);
      console.log(`      Created: ${msg.createdAt.toISOString()}`);
    });
    console.log(`\n❌ VERIFICATION FAILED: Migration incomplete`);
    console.log(`   Run: npx tsx src/scripts/migrate-file-urls.ts`);
  } else {
    console.log(`\n✅ VERIFICATION PASSED: All URLs migrated successfully`);
  }

  return result;
}

async function main() {
  try {
    const result = await verifyUrlMigration();
    await prisma.$disconnect();
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error('❌ Verification failed with error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { verifyUrlMigration };
