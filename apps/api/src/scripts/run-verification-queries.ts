#!/usr/bin/env node
/**
 * Direct SQL verification for URL migration
 * Uses pg directly to avoid Prisma client issues in worktree
 */

import * as fs from 'fs';
import * as path from 'path';

// Try to load pg if available
let pg: any;
try {
  pg = require('pg');
} catch (e) {
  console.error('❌ pg module not found. Install with: pnpm add pg');
  process.exit(1);
}

const { Pool } = pg;

async function runVerificationQueries() {
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    console.error('   Set it in .env file or export it:');
    console.error('   export DATABASE_URL="postgresql://user:password@localhost:5432/database"');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    console.log('🔍 Running URL Migration Verification Queries...\n');

    // Query 1: Count legacy URLs
    console.log('1️⃣  Checking for legacy URLs (/uploads/)...');
    const legacyResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM "Message"
      WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
        AND content LIKE '%/uploads/%'
    `);
    const legacyCount = parseInt(legacyResult.rows[0].count);
    console.log(`   Found: ${legacyCount} messages with /uploads/ URLs`);

    if (legacyCount > 0) {
      console.log('   ⚠️  Migration incomplete!\n');
    } else {
      console.log('   ✅ No legacy URLs found\n');
    }

    // Query 2: Count new URLs
    console.log('2️⃣  Checking for new URLs (/files/)...');
    const newResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM "Message"
      WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
        AND content LIKE '%/files/%'
    `);
    const newCount = parseInt(newResult.rows[0].count);
    console.log(`   Found: ${newCount} messages with /files/ URLs`);
    console.log('   ✅ New URLs present\n');

    // Query 3: Summary by content type
    console.log('3️⃣  Summary by content type:');
    const summaryResult = await pool.query(`
      SELECT
        "contentType",
        COUNT(*) as total,
        SUM(CASE WHEN content LIKE '%/files/%' THEN 1 ELSE 0 END) as migrated,
        SUM(CASE WHEN content LIKE '%/uploads/%' THEN 1 ELSE 0 END) as legacy
      FROM "Message"
      WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
      GROUP BY "contentType"
      ORDER BY "contentType"
    `);

    console.log('   Type        Total  Migrated  Legacy');
    console.log('   ----------------------------------------');
    summaryResult.rows.forEach(row => {
      console.log(
        `   ${row.contentType.padEnd(12)} ${String(row.total).padStart(5)}  ${String(row.migrated).padStart(8)}  ${String(row.legacy).padStart(6)}`
      );
    });
    console.log('');

    // Query 4: Overall verification
    console.log('4️⃣  Overall Migration Status:');
    const overallResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN content LIKE '%/files/%' THEN 1 ELSE 0 END) as migrated,
        SUM(CASE WHEN content LIKE '%/uploads/%' THEN 1 ELSE 0 END) as legacy,
        ROUND(
          (SUM(CASE WHEN content LIKE '%/files/%' THEN 1 ELSE 0 END)::FLOAT /
           NULLIF(COUNT(*), 0) * 100),
          2
        ) as percentage
      FROM "Message"
      WHERE "contentType" IN ('IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO')
    `);

    const overall = overallResult.rows[0];
    console.log(`   Total file messages: ${overall.total}`);
    console.log(`   Migrated: ${overall.migrated} (${overall.percentage}%)`);
    console.log(`   Legacy: ${overall.legacy}`);
    console.log('');

    // Final verdict
    if (legacyCount === 0 && newCount > 0) {
      console.log('✅ VERIFICATION PASSED');
      console.log('   All file URLs have been migrated to /files/ format');
      console.log('   No legacy /uploads/ URLs found');
      await pool.end();
      process.exit(0);
    } else if (legacyCount > 0) {
      console.log('❌ VERIFICATION FAILED');
      console.log('   Legacy /uploads/ URLs still exist');
      console.log('\n   To fix, run:');
      console.log('   npx tsx src/scripts/migrate-file-urls.ts');
      await pool.end();
      process.exit(1);
    } else if (newCount === 0) {
      console.log('⚠️  WARNING');
      console.log('   No file messages found in database');
      await pool.end();
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Error running verification queries:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runVerificationQueries();
}

export { runVerificationQueries };
