import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { analyticsQueue } from '../index';
import { moveToDeadLetterQueue } from '../dlq';
import { getChannelAdapter } from '../../channels';
import { webhookService } from '../../services/webhook.service';

interface OutboundJobData {
  conversationId: string;
  messageId: string;
  channelType: string;
  channelId: string;
  content: string;
  contentType: string;
}

export const outboundWorker = new Worker(
  'outbound-messages',
  async (job) => {
    const data = job.data as OutboundJobData;
    logger.info({ jobId: job.id, channelType: data.channelType }, 'Sending outbound message');

    // Load channel credentials
    const channel = await prisma.channel.findUnique({
      where: { id: data.channelId },
    });

    if (!channel) {
      // BUG FIX: return instead of throw — throwing causes infinite retries for deleted channels
      logger.warn({ channelId: data.channelId }, 'Channel not found, skipping outbound message');
      return { success: false, error: 'Channel not found' };
    }

    // Load conversation for customer ID
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (!conversation) {
      // BUG FIX: return instead of throw — throwing causes infinite retries for deleted conversations
      logger.warn({ conversationId: data.conversationId }, 'Conversation not found, skipping outbound message');
      return { success: false, error: 'Conversation not found' };
    }

    // Get adapter and send
    const adapter = getChannelAdapter(data.channelType);
    let result: { success: boolean; externalId?: string; error?: string };
    try {
      result = await adapter.sendMessage(
        channel.credentials as Record<string, string>,
        {
          recipientId: conversation.customerId,
          content: data.content,
          contentType: data.contentType as any,
        }
      );
    } catch (adapterErr) {
      logger.error({ err: adapterErr, channelType: data.channelType, messageId: data.messageId }, 'Channel adapter error');
      result = { success: false, error: (adapterErr as Error).message };
    }

    // Update message delivery status
    try {
      await prisma.message.update({
        where: { id: data.messageId },
        data: {
          deliveryStatus: result.success ? 'SENT' : 'FAILED',
          externalId: result.externalId,
          failureReason: result.error,
        },
      });
    } catch (dbErr) {
      logger.error({ err: dbErr, messageId: data.messageId }, 'Failed to update message delivery status');
    }

    // Track
    try {
      await analyticsQueue.add('track-event', {
        orgId: channel.orgId,
        eventType: 'MESSAGE_SENT',
        data: { conversationId: data.conversationId, success: result.success },
        channelType: data.channelType,
      });
    } catch (analyticsErr) {
      logger.warn({ err: analyticsErr, conversationId: data.conversationId }, 'Failed to queue outbound analytics');
    }

    // Dispatch webhook event for successfully sent messages
    if (result.success) {
      const message = await prisma.message.findUnique({
        where: { id: data.messageId },
      });

      await webhookService.dispatch(channel.orgId, 'message.sent', {
        messageId: data.messageId,
        conversationId: data.conversationId,
        channelType: data.channelType,
        content: data.content,
        contentType: data.contentType,
        deliveryStatus: message?.deliveryStatus,
        externalId: message?.externalId,
        sentAt: message?.createdAt,
      });
    }

    return result;
  },
  {
    connection: redis,
    concurrency: 10,
  }
);

outboundWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Outbound message sending failed');
  moveToDeadLetterQueue('outbound-messages', job, err, 3);
});

outboundWorker.on('error', (err) => {
  logger.error({ err }, 'Outbound worker error');
});
