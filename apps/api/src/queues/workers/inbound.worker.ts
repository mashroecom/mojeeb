import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { aiQueue, analyticsQueue } from '../index';
import { moveToDeadLetterQueue } from '../dlq';
import { emitToOrg, emitToConversation } from '../../websocket/index';
import { webhookService } from '../../services/webhook.service';
import type { InboundMessage } from '@mojeeb/shared-types';

interface InboundJobData {
  channelType: string;
  channelId: string;
  orgId: string;
  message: InboundMessage;
  receivedAt: string;
  conversationId?: string;
}

export const inboundWorker = new Worker(
  'inbound-messages',
  async (job) => {
    const data = job.data as InboundJobData;
    logger.info({ jobId: job.id, channelType: data.channelType }, 'Processing inbound message');

    // 1. Find or create conversation (wrapped in transaction to prevent duplicates)
    const conversationInclude = {
      channel: {
        include: { agents: { where: { isPrimary: true }, include: { agent: true } } },
      },
    };

    let isNewConversation = false;
    const conversation = await prisma.$transaction(
      async (tx) => {
        let conv = data.conversationId
          ? await tx.conversation.findUnique({
              where: { id: data.conversationId },
              include: conversationInclude,
            })
          : await tx.conversation.findFirst({
              where: {
                channelId: data.channelId,
                customerId: data.message.senderId,
                status: { in: ['ACTIVE', 'WAITING', 'HANDED_OFF'] },
              },
              include: conversationInclude,
            });

        if (!conv) {
          const channel = await tx.channel.findUnique({
            where: { id: data.channelId },
            include: { agents: { where: { isPrimary: true } } },
          });

          conv = await tx.conversation.create({
            data: {
              orgId: data.orgId,
              channelId: data.channelId,
              customerId: data.message.senderId,
              customerName: data.message.senderName,
              customerPhone: data.message.senderPhone,
              agentId: channel?.agents[0]?.agentId || null,
              status: 'ACTIVE',
            },
            include: conversationInclude,
          });
          isNewConversation = true;
        }

        return conv;
      },
      { isolationLevel: 'ReadCommitted' },
    );

    if (isNewConversation) {
      await analyticsQueue.add('track-event', {
        orgId: data.orgId,
        eventType: 'CONVERSATION_STARTED',
        data: { channelType: data.channelType, conversationId: conversation.id },
        channelType: data.channelType,
      });

      await webhookService.dispatch(data.orgId, 'conversation.created', {
        conversationId: conversation.id,
        channelId: conversation.channelId,
        customerId: conversation.customerId,
        customerName: conversation.customerName,
        customerPhone: conversation.customerPhone,
        status: conversation.status,
        createdAt: conversation.createdAt,
      });
    }

    // 2. Atomic check-and-increment subscription usage (prevents race condition)
    const updatedCount = await prisma.$executeRaw`
      UPDATE "subscriptions"
      SET "messagesUsed" = "messagesUsed" + 1, "updatedAt" = NOW()
      WHERE "orgId" = ${data.orgId} AND "messagesUsed" < "messagesLimit"
    `;

    if (updatedCount === 0) {
      logger.warn(
        { orgId: data.orgId, conversationId: conversation.id },
        'Usage limit reached, rejecting message',
      );
      return { conversationId: conversation.id, skipped: true, reason: 'limit_reached' };
    }

    // 3. Store the incoming message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'CUSTOMER',
        content: data.message.content,
        contentType: data.message.contentType || 'TEXT',
        externalId: data.message.externalMessageId,
        metadata: data.message.rawPayload as any,
      },
    });

    await webhookService.dispatch(data.orgId, 'message.received', {
      messageId: message.id,
      conversationId: conversation.id,
      role: message.role,
      content: message.content,
      contentType: message.contentType,
      createdAt: message.createdAt,
    });

    // 4. Update conversation stats
    // Only update status to ACTIVE if not currently handed off
    const convUpdateData: Record<string, unknown> = {
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
    };
    if (conversation.status !== 'HANDED_OFF') {
      convUpdateData.status = 'ACTIVE';
    }
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: convUpdateData,
    });

    // 5. Emit real-time WebSocket events for customer message
    try {
      emitToOrg(data.orgId, 'message:new', {
        messageId: message.id,
        conversationId: conversation.id,
        role: message.role,
        content: message.content,
        contentType: message.contentType,
        createdAt: message.createdAt,
      });
      emitToConversation(conversation.id, 'message:new', {
        messageId: message.id,
        conversationId: conversation.id,
        role: message.role,
        content: message.content,
        contentType: message.contentType,
        createdAt: message.createdAt,
      });
    } catch (wsErr) {
      logger.warn({ err: wsErr }, 'Failed to emit WebSocket events from inbound worker');
    }

    // 6. Track message received
    await analyticsQueue.add('track-event', {
      orgId: data.orgId,
      eventType: 'MESSAGE_RECEIVED',
      data: { conversationId: conversation.id, messageId: message.id },
      channelType: data.channelType,
    });

    // 6. If conversation is handed off to human, don't trigger AI
    if (conversation.status === 'HANDED_OFF') {
      return { conversationId: conversation.id, messageId: message.id, skipped: true };
    }

    // 7. Trigger AI processing
    const agent = conversation.channel?.agents[0]?.agent;
    if (agent) {
      await aiQueue.add('generate-response', {
        conversationId: conversation.id,
        messageId: message.id,
        agentId: agent.id,
        orgId: data.orgId,
        channelId: data.channelId,
        channelType: data.channelType,
        customerMessage: data.message.content,
        customerMessageContentType: message.contentType,
      });
    }

    return { conversationId: conversation.id, messageId: message.id };
  },
  {
    connection: redis,
    concurrency: 10,
  },
);

inboundWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Inbound message processing failed');
  moveToDeadLetterQueue('inbound-messages', job, err, 3);
});

inboundWorker.on('error', (err) => {
  logger.error({ err }, 'Inbound worker error');
});
