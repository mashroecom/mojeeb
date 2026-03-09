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
      throw new Error(`Channel not found: ${data.channelId}`);
    }

    // Load conversation for customer ID
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (!conversation) {
      throw new Error(`Conversation not found: ${data.conversationId}`);
    }

    // Get adapter and send
    const adapter = getChannelAdapter(data.channelType);
    const result = await adapter.sendMessage(
      channel.credentials as Record<string, string>,
      {
        recipientId: conversation.customerId,
        content: data.content,
        contentType: data.contentType as any,
      }
    );

    // Update message delivery status
    await prisma.message.update({
      where: { id: data.messageId },
      data: {
        deliveryStatus: result.success ? 'SENT' : 'FAILED',
        externalId: result.externalId,
        failureReason: result.error,
      },
    });

    // Track
    await analyticsQueue.add('track-event', {
      orgId: channel.orgId,
      eventType: 'MESSAGE_SENT',
      data: { conversationId: data.conversationId, success: result.success },
      channelType: data.channelType,
    });

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
