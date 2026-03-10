#!/usr/bin/env tsx
/**
 * End-to-End Test for Knowledge Base URL Crawling
 *
 * This script tests the complete single page crawl flow:
 * 1. Create a test organization with knowledge base
 * 2. Crawl a single page URL (example.com)
 * 3. Verify document is created with extracted content
 * 4. Verify chunks are generated with embeddings
 * 5. Perform semantic search to confirm content is indexed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function log(step: string, status: 'PASS' | 'FAIL', message: string, data?: any) {
  results.push({ step, status, message, data });
  const icon = status === 'PASS' ? '✓' : '✗';
  console.log(`${icon} ${step}: ${message}`);
  if (data) {
    console.log('  Data:', JSON.stringify(data, null, 2));
  }
}

async function cleanup() {
  // Clean up test data
  try {
    await prisma.kBChunk.deleteMany({
      where: {
        document: {
          knowledgeBase: {
            orgId: 'test-crawl-org'
          }
        }
      }
    });
    await prisma.kBDocument.deleteMany({
      where: {
        knowledgeBase: {
          orgId: 'test-crawl-org'
        }
      }
    });
    await prisma.knowledgeBase.deleteMany({
      where: { orgId: 'test-crawl-org' }
    });
    await prisma.organization.deleteMany({
      where: { id: 'test-crawl-org' }
    });
    await prisma.user.deleteMany({
      where: { email: 'crawl-test@mojeeb.test' }
    });
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function createTestUser() {
  try {
    const user = await prisma.user.create({
      data: {
        id: 'test-crawl-user',
        email: 'crawl-test@mojeeb.test',
        firstName: 'Crawl',
        lastName: 'Test',
        passwordHash: 'not-used',
        emailVerified: true,
      }
    });
    await log('1. Create Test User', 'PASS', 'Test user created', { userId: user.id });
    return user;
  } catch (error: any) {
    await log('1. Create Test User', 'FAIL', error.message);
    throw error;
  }
}

async function createTestOrganization(userId: string) {
  try {
    const org = await prisma.organization.create({
      data: {
        id: 'test-crawl-org',
        name: 'Crawl Test Organization',
        slug: 'crawl-test-org',
        timezone: 'UTC',
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          }
        }
      }
    });
    await log('2. Create Test Organization', 'PASS', 'Test organization created', { orgId: org.id });
    return org;
  } catch (error: any) {
    await log('2. Create Test Organization', 'FAIL', error.message);
    throw error;
  }
}

async function createTestKnowledgeBase(orgId: string) {
  try {
    const kb = await prisma.knowledgeBase.create({
      data: {
        orgId,
        name: 'Test Knowledge Base',
        description: 'Knowledge base for testing URL crawling',
      }
    });
    await log('3. Create Knowledge Base', 'PASS', 'Knowledge base created', { kbId: kb.id });
    return kb;
  } catch (error: any) {
    await log('3. Create Knowledge Base', 'FAIL', error.message);
    throw error;
  }
}

async function testCrawlSinglePage(kbId: string, orgId: string) {
  try {
    // Import services
    const { knowledgeBaseService } = await import('./apps/api/src/services/knowledgeBase.service');

    // Crawl a simple, reliable URL (example.com is guaranteed to be up and has simple HTML)
    const testUrl = 'https://example.com';

    console.log(`  Crawling ${testUrl}...`);

    // Add URL document (which triggers crawling)
    const document = await knowledgeBaseService.addDocument({
      knowledgeBaseId: kbId,
      orgId,
      name: 'Example.com Homepage',
      contentType: 'URL',
      metadata: {
        url: testUrl,
      },
    });

    if (!document || !document.id) {
      await log('4. Crawl Single Page', 'FAIL', 'Failed to create document');
      return null;
    }

    // Verify document has content extracted
    if (!document.content || document.content.length < 10) {
      await log('4. Crawl Single Page', 'FAIL', 'No content extracted from URL', {
        documentId: document.id,
        contentLength: document.content?.length || 0
      });
      return null;
    }

    await log('4. Crawl Single Page', 'PASS', 'Page crawled and document created', {
      documentId: document.id,
      url: testUrl,
      contentLength: document.content.length,
      contentPreview: document.content.substring(0, 100) + '...'
    });

    return document;
  } catch (error: any) {
    await log('4. Crawl Single Page', 'FAIL', error.message);
    return null;
  }
}

async function verifyChunksGenerated(documentId: string) {
  try {
    // Wait for chunks to be generated (async processing)
    console.log('  Waiting for chunks to be generated...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const chunks = await prisma.kBChunk.findMany({
      where: { documentId }
    });

    if (chunks.length === 0) {
      await log('5. Verify Chunks Generated', 'FAIL', 'No chunks found for document', { documentId });
      return false;
    }

    // Verify chunks have embeddings
    const chunksWithEmbeddings = chunks.filter(chunk => chunk.embedding !== null);

    if (chunksWithEmbeddings.length === 0) {
      await log('5. Verify Chunks Generated', 'FAIL', 'Chunks found but no embeddings', {
        totalChunks: chunks.length,
        chunksWithEmbeddings: 0
      });
      return false;
    }

    await log('5. Verify Chunks Generated', 'PASS', 'Chunks created with embeddings', {
      totalChunks: chunks.length,
      chunksWithEmbeddings: chunksWithEmbeddings.length,
      sampleChunkText: chunks[0].text.substring(0, 100) + '...',
      hasEmbedding: chunks[0].embedding !== null
    });

    return true;
  } catch (error: any) {
    await log('5. Verify Chunks Generated', 'FAIL', error.message);
    return false;
  }
}

async function testSemanticSearch(kbId: string, orgId: string) {
  try {
    const { knowledgeBaseService } = await import('./apps/api/src/services/knowledgeBase.service');

    // Search for content that should be in example.com
    const query = 'example domain';

    console.log(`  Searching for: "${query}"...`);

    const searchResults = await knowledgeBaseService.search({
      knowledgeBaseId: kbId,
      query,
      orgId,
      limit: 5,
    });

    if (!searchResults || searchResults.length === 0) {
      await log('6. Semantic Search', 'FAIL', 'No search results found', { query });
      return false;
    }

    // Verify results are relevant
    const hasRelevantResults = searchResults.some(result =>
      result.score > 0.5 || // Good similarity score
      result.text.toLowerCase().includes('example')
    );

    if (!hasRelevantResults) {
      await log('6. Semantic Search', 'FAIL', 'Search results not relevant', {
        query,
        resultCount: searchResults.length,
        topScore: searchResults[0]?.score
      });
      return false;
    }

    await log('6. Semantic Search', 'PASS', 'Content is searchable and indexed', {
      query,
      resultCount: searchResults.length,
      topScore: searchResults[0].score,
      topResultPreview: searchResults[0].text.substring(0, 100) + '...'
    });

    return true;
  } catch (error: any) {
    await log('6. Semantic Search', 'FAIL', error.message);
    return false;
  }
}

async function testRobotsTxtRespect() {
  try {
    const { robotsTxtService } = await import('./apps/api/src/services/robotsTxt.service');

    // Test with a URL that has robots.txt
    const testUrl = 'https://example.com/test-path';

    const isAllowed = await robotsTxtService.isAllowed(testUrl, 'MojeebBot');

    await log('7. Robots.txt Respect', 'PASS', 'Robots.txt checked successfully', {
      url: testUrl,
      isAllowed,
      userAgent: 'MojeebBot'
    });

    return true;
  } catch (error: any) {
    await log('7. Robots.txt Respect', 'FAIL', error.message);
    return false;
  }
}

async function testArabicContent(kbId: string, orgId: string) {
  try {
    const { crawlerService } = await import('./apps/api/src/services/crawler.service');

    // Create a simple HTML with Arabic content to test
    const arabicTestHtml = `
      <!DOCTYPE html>
      <html lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>اختبار المحتوى العربي</title>
      </head>
      <body>
        <h1>مرحباً بك</h1>
        <p>هذا محتوى تجريبي باللغة العربية لاختبار استخراج النص.</p>
      </body>
      </html>
    `;

    // Test HTML cleaning with Arabic content
    const cleanedText = crawlerService.cleanHtmlContent(arabicTestHtml);

    const hasArabicContent = /[\u0600-\u06FF]/.test(cleanedText);

    if (!hasArabicContent) {
      await log('8. Arabic Content Support', 'FAIL', 'Arabic text not preserved', {
        cleanedText
      });
      return false;
    }

    await log('8. Arabic Content Support', 'PASS', 'Arabic content extracted correctly', {
      hasArabicText: hasArabicContent,
      contentPreview: cleanedText.substring(0, 100)
    });

    return true;
  } catch (error: any) {
    await log('8. Arabic Content Support', 'FAIL', error.message);
    return false;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('Knowledge Base URL Crawling E2E Test');
  console.log('========================================\n');

  try {
    // Cleanup before test
    await cleanup();

    // Create test data
    const user = await createTestUser();
    const org = await createTestOrganization(user.id);
    const kb = await createTestKnowledgeBase(org.id);

    // Test crawling
    const document = await testCrawlSinglePage(kb.id, org.id);

    if (document) {
      // Verify chunks and search
      await verifyChunksGenerated(document.id);
      await testSemanticSearch(kb.id, org.id);
    }

    // Test robots.txt
    await testRobotsTxtRespect();

    // Test Arabic content support
    await testArabicContent(kb.id, org.id);

    // Print summary
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log(`Total Steps: ${results.length}`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round((passed / results.length) * 100)}%\n`);

    if (failed === 0) {
      console.log('🎉 All tests passed!\n');
      console.log('✅ Single page crawl works correctly');
      console.log('✅ Content extraction with cheerio successful');
      console.log('✅ Chunks generated with embeddings');
      console.log('✅ Semantic search works');
      console.log('✅ Robots.txt is checked');
      console.log('✅ Arabic content support verified\n');
    } else {
      console.log('❌ Some tests failed. See details above.\n');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup after test
    await cleanup();
    await prisma.$disconnect();
  }
}

main();
