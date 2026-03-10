import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting to seed 10K conversations...');

  const startTime = Date.now();

  // Find or create an organization
  let org = await prisma.organization.findFirst();
  if (!org) {
    console.log('Creating test organization...');
    org = await prisma.organization.create({
      data: {
        id: 'test-org-10k',
        name: 'Test Organization for 10K Export',
        plan: 'ENTERPRISE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
  console.log(`✓ Using organization: ${org.id}`);

  // Find or create a channel
  let channel = await prisma.channel.findFirst({
    where: { orgId: org.id },
  });
  if (!channel) {
    console.log('Creating test channel...');
    channel = await prisma.channel.create({
      data: {
        orgId: org.id,
        type: 'WHATSAPP',
        name: 'Test WhatsApp Channel',
        isActive: true,
        credentials: {},
      },
    });
  }
  console.log(`✓ Using channel: ${channel.id}`);

  // Count existing conversations
  const existingCount = await prisma.conversation.count({
    where: { orgId: org.id },
  });
  console.log(`✓ Existing conversations: ${existingCount}`);

  const targetCount = 10000;
  const toCreate = targetCount - existingCount;

  if (toCreate <= 0) {
    console.log(`✓ Already have ${existingCount} conversations (target: ${targetCount})`);
    console.log('✅ Seed complete!');
    return;
  }

  console.log(`Creating ${toCreate} conversations in batches of 1000...`);

  const batchSize = 1000;
  const batches = Math.ceil(toCreate / batchSize);

  for (let batch = 0; batch < batches; batch++) {
    const batchStart = Date.now();
    const recordsInBatch = Math.min(batchSize, toCreate - batch * batchSize);

    const conversations = Array.from({ length: recordsInBatch }, (_, i) => {
      const index = batch * batchSize + i;
      const statuses = ['ACTIVE', 'RESOLVED', 'ARCHIVED'] as const;
      const status = statuses[index % 3];

      return {
        orgId: org.id,
        channelId: channel.id,
        customerId: `customer-${index}`,
        customerName: `Test Customer ${index}`,
        customerPhone: `+1-555-${String(index).padStart(7, '0')}`,
        customerEmail: `customer${index}@test.com`,
        status,
        messageCount: Math.floor(Math.random() * 50) + 1,
        firstMessageAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        lastMessageAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
        createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      };
    });

    await prisma.conversation.createMany({
      data: conversations,
      skipDuplicates: true,
    });

    const batchDuration = Date.now() - batchStart;
    console.log(`  Batch ${batch + 1}/${batches}: Created ${recordsInBatch} conversations (${batchDuration}ms)`);
  }

  const finalCount = await prisma.conversation.count({
    where: { orgId: org.id },
  });

  const totalDuration = Date.now() - startTime;
  console.log(`✅ Seed complete! Total conversations: ${finalCount} (${totalDuration}ms)`);
  console.log(`📊 Organization ID: ${org.id}`);
  console.log(`📊 Channel ID: ${channel.id}`);
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
