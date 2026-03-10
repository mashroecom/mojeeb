#!/usr/bin/env tsx
/**
 * Load Test Script for Agent Performance Endpoint
 *
 * This script:
 * 1. Seeds realistic test data (10+ agents with conversations and messages)
 * 2. Enables Prisma query logging to count database queries
 * 3. Measures query count and response time
 * 4. Tests both cold (cache miss) and warm (cache hit) scenarios
 * 5. Generates a detailed performance report
 *
 * Usage:
 *   cd apps/api
 *   npx tsx src/scripts/load-test-agent-performance.ts
 */

import { PrismaClient } from '@prisma/client';
import { redis } from '../config/redis';
import { AnalyticsService } from '../services/analytics.service';

// Global query counter for Prisma logging
let queryCount = 0;
const queries: string[] = [];

// Enhanced Prisma client with query logging
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
});

// Listen to query events
prisma.$on('query' as never, (e: any) => {
  queryCount++;
  queries.push(e.query);
});

interface TestResults {
  scenario: string;
  queryCount: number;
  responseTimeMs: number;
  cacheStatus: 'cold' | 'warm';
  agentCount: number;
  conversationCount: number;
  messageCount: number;
}

const results: TestResults[] = [];

async function seedTestData(orgId: string, agentCount: number = 12) {
  console.log(`\n📊 Seeding test data for org: ${orgId}`);
  console.log(`   Creating ${agentCount} agents with conversations and messages...\n`);

  // Create organization
  const org = await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId,
      name: 'Load Test Organization',
      slug: 'load-test-org',
    },
  });

  console.log(`   ✓ Organization created: ${org.name}`);

  // Create channel
  const channel = await prisma.channel.upsert({
    where: { id: 'load-test-channel' },
    update: {},
    create: {
      id: 'load-test-channel',
      orgId,
      name: 'Load Test Channel',
      type: 'WEBCHAT',
      credentials: {},
      isActive: true,
    },
  });

  console.log(`   ✓ Channel created: ${channel.name}`);

  // Create agents
  const agents = [];
  for (let i = 1; i <= agentCount; i++) {
    const agent = await prisma.agent.upsert({
      where: { id: `agent-${i}` },
      update: {},
      create: {
        id: `agent-${i}`,
        orgId,
        name: `Agent ${i}`,
        aiProvider: 'OPENAI',
        aiModel: 'gpt-4o',
        systemPrompt: `You are Agent ${i}, a helpful customer service assistant.`,
        isActive: true,
      },
    });
    agents.push(agent);
  }

  console.log(`   ✓ Created ${agents.length} agents`);

  // Create conversations and messages for each agent
  let totalConversations = 0;
  let totalMessages = 0;
  let totalResolved = 0;

  for (const agent of agents) {
    // Each agent gets 5-15 conversations
    const conversationCount = Math.floor(Math.random() * 11) + 5;

    for (let c = 0; c < conversationCount; c++) {
      const conversationId = `conv-${agent.id}-${c}`;
      const isResolved = Math.random() > 0.5;

      const conversation = await prisma.conversation.upsert({
        where: { id: conversationId },
        update: {},
        create: {
          id: conversationId,
          orgId,
          channelId: channel.id,
          agentId: agent.id,
          customerId: `customer-${agent.id}-${c}`,
          customerEmail: `customer${c}@example.com`,
          status: isResolved ? 'RESOLVED' : 'ACTIVE',
          resolvedAt: isResolved ? new Date() : null,
        },
      });

      totalConversations++;
      if (isResolved) totalResolved++;

      // Each conversation gets 3-20 messages
      const messageCount = Math.floor(Math.random() * 18) + 3;

      for (let m = 0; m < messageCount; m++) {
        const isAiMessage = m % 2 === 1;

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: isAiMessage ? 'AI_AGENT' : 'CUSTOMER',
            content: `Message ${m} in conversation ${c}`,
            contentType: 'TEXT',
            latencyMs: isAiMessage ? Math.floor(Math.random() * 1000) + 100 : null,
          },
        });

        totalMessages++;
      }
    }
  }

  console.log(`   ✓ Created ${totalConversations} conversations (${totalResolved} resolved)`);
  console.log(`   ✓ Created ${totalMessages} messages`);
  console.log(`\n✅ Test data seeding complete!\n`);

  return {
    agentCount,
    conversationCount: totalConversations,
    messageCount: totalMessages,
  };
}

async function clearCache(orgId: string) {
  const cacheKey = `analytics:agent-perf:${orgId}`;
  await redis.del(cacheKey);
  console.log(`   ✓ Cache cleared for key: ${cacheKey}`);
}

async function runLoadTest(orgId: string, scenario: string, cacheStatus: 'cold' | 'warm') {
  console.log(`\n🔬 Running test: ${scenario} (${cacheStatus} cache)`);

  // Reset query counter
  queryCount = 0;
  queries.length = 0;

  // Create analytics service instance
  const analyticsService = new AnalyticsService();

  // Measure response time
  const startTime = Date.now();

  try {
    const result = await analyticsService.getAgentPerformance(orgId);

    const endTime = Date.now();
    const responseTimeMs = endTime - startTime;

    console.log(`   ✓ Response time: ${responseTimeMs}ms`);
    console.log(`   ✓ Query count: ${queryCount}`);
    console.log(`   ✓ Agents returned: ${result.length}`);

    // Show sample data
    if (result.length > 0) {
      const sample = result[0];
      console.log(`   ✓ Sample agent: ${sample.agentName}`);
      console.log(`     - Conversations: ${sample.totalConversations}`);
      console.log(`     - Messages: ${sample.totalMessages}`);
      console.log(`     - Avg Response Time: ${sample.avgResponseTimeMs}ms`);
      console.log(`     - Resolved: ${sample.resolvedCount}`);
    }

    return {
      scenario,
      queryCount,
      responseTimeMs,
      cacheStatus,
      agentCount: result.length,
      conversationCount: 0, // Will be filled later
      messageCount: 0, // Will be filled later
    };
  } catch (error) {
    console.error(`   ❌ Error during test: ${error}`);
    throw error;
  }
}

async function printDetailedQueries() {
  console.log(`\n📝 Detailed Query Analysis:`);
  console.log(`   Total queries executed: ${queries.length}\n`);

  if (queries.length > 0) {
    queries.forEach((query, index) => {
      // Truncate long queries for readability
      const truncated = query.length > 100
        ? query.substring(0, 100) + '...'
        : query;
      console.log(`   ${index + 1}. ${truncated}`);
    });
  }
}

async function generateReport(testData: { agentCount: number; conversationCount: number; messageCount: number }) {
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`LOAD TEST PERFORMANCE REPORT`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`📊 Test Data Statistics:`);
  console.log(`   Agents: ${testData.agentCount}`);
  console.log(`   Conversations: ${testData.conversationCount}`);
  console.log(`   Messages: ${testData.messageCount}`);
  console.log(`\n${'─'.repeat(80)}\n`);

  // Calculate expected baseline (old N+1 pattern)
  const expectedOldQueries = 1 + (4 * testData.agentCount);
  const expectedNewQueries = 6; // Fixed number of queries in optimized version

  console.log(`📈 Performance Results:\n`);
  console.log(`   Scenario                    | Queries | Time (ms) | Cache   | Status`);
  console.log(`   ${'-'.repeat(76)}`);

  results.forEach((result) => {
    const status = result.queryCount <= expectedNewQueries ? '✅ PASS' : '❌ FAIL';
    console.log(
      `   ${result.scenario.padEnd(27)} | ${String(result.queryCount).padStart(7)} | ${String(result.responseTimeMs).padStart(9)} | ${result.cacheStatus.padEnd(7)} | ${status}`
    );
  });

  console.log(`\n${'─'.repeat(80)}\n`);

  // Find cold cache result for comparison
  const coldCacheResult = results.find(r => r.cacheStatus === 'cold');

  if (coldCacheResult) {
    console.log(`🎯 Performance Targets:\n`);
    console.log(`   Expected Query Count (OLD N+1 pattern): ${expectedOldQueries} queries`);
    console.log(`   Expected Query Count (NEW optimized):   ${expectedNewQueries} queries`);
    console.log(`   Actual Query Count:                     ${coldCacheResult.queryCount} queries`);
    console.log(`\n   Query Reduction: ${expectedOldQueries - coldCacheResult.queryCount} queries eliminated`);
    console.log(`   Improvement:     ${Math.round(((expectedOldQueries - coldCacheResult.queryCount) / expectedOldQueries) * 100)}%`);

    console.log(`\n   Target Response Time (cold cache):      <50ms`);
    console.log(`   Actual Response Time (cold cache):      ${coldCacheResult.responseTimeMs}ms`);

    const responseTimeStatus = coldCacheResult.responseTimeMs < 50 ? '✅ PASS' : '⚠️  NEEDS IMPROVEMENT';
    console.log(`   Status:                                 ${responseTimeStatus}`);
  }

  console.log(`\n${'─'.repeat(80)}\n`);

  // Acceptance criteria
  console.log(`✓ Acceptance Criteria:\n`);
  console.log(`   [ ${coldCacheResult && coldCacheResult.queryCount <= expectedNewQueries ? '✅' : '❌'} ] Query count reduced to ~${expectedNewQueries} (was ${expectedOldQueries})`);
  console.log(`   [ ${coldCacheResult && coldCacheResult.responseTimeMs < 100 ? '✅' : '❌'} ] Response time <100ms for realistic data`);
  console.log(`   [ ${coldCacheResult && coldCacheResult.queryCount <= expectedNewQueries ? '✅' : '❌'} ] No N+1 query pattern`);

  const warmCacheResult = results.find(r => r.cacheStatus === 'warm');
  console.log(`   [ ${warmCacheResult && warmCacheResult.queryCount === 0 ? '✅' : '❌'} ] Cache working correctly (0 queries on warm cache)`);

  console.log(`\n${'='.repeat(80)}\n`);
}

async function main() {
  const orgId = 'load-test-org-001';

  console.log(`\n${'='.repeat(80)}`);
  console.log(`AGENT PERFORMANCE ENDPOINT - LOAD TEST`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Step 1: Seed test data
    const testData = await seedTestData(orgId, 12);

    // Step 2: Clear cache for cold cache test
    await clearCache(orgId);

    // Step 3: Run cold cache test (cache miss - should hit database)
    const coldResult = await runLoadTest(orgId, 'Cold Cache (Cache Miss)', 'cold');
    coldResult.conversationCount = testData.conversationCount;
    coldResult.messageCount = testData.messageCount;
    results.push(coldResult);

    // Print detailed queries for cold cache test
    printDetailedQueries();

    // Step 4: Run warm cache test (cache hit - should NOT hit database)
    const warmResult = await runLoadTest(orgId, 'Warm Cache (Cache Hit)', 'warm');
    warmResult.conversationCount = testData.conversationCount;
    warmResult.messageCount = testData.messageCount;
    results.push(warmResult);

    // Step 5: Clear cache again
    await clearCache(orgId);

    // Step 6: Run another cold cache test to verify consistency
    const coldResult2 = await runLoadTest(orgId, 'Cold Cache (Repeat)', 'cold');
    coldResult2.conversationCount = testData.conversationCount;
    coldResult2.messageCount = testData.messageCount;
    results.push(coldResult2);

    // Step 7: Generate comprehensive report
    await generateReport(testData);

    // Cleanup
    console.log(`🧹 Cleaning up test data...`);

    // Delete in reverse order due to foreign key constraints
    await prisma.message.deleteMany({ where: { conversation: { orgId } } });
    await prisma.conversation.deleteMany({ where: { orgId } });
    await prisma.agent.deleteMany({ where: { orgId } });
    await prisma.channel.deleteMany({ where: { orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await clearCache(orgId);

    console.log(`   ✓ Test data cleaned up\n`);

    // Disconnect
    await prisma.$disconnect();
    await redis.quit();

    console.log(`✅ Load test completed successfully!\n`);
    process.exit(0);

  } catch (error) {
    console.error(`\n❌ Load test failed:`, error);

    // Cleanup on error
    try {
      await prisma.message.deleteMany({ where: { conversation: { orgId } } });
      await prisma.conversation.deleteMany({ where: { orgId } });
      await prisma.agent.deleteMany({ where: { orgId } });
      await prisma.channel.deleteMany({ where: { orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await clearCache(orgId);
    } catch (cleanupError) {
      console.error(`Error during cleanup:`, cleanupError);
    }

    await prisma.$disconnect();
    await redis.quit();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main as runLoadTest };
