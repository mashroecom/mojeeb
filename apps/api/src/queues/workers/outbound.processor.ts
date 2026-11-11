import type { MessageContentType } from '@mojeeb/shared-types';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { analyticsQueue } from '../index';
import { getChannelAdapter } from '../../channels';
import { channelService } from '../../services/channel.service';
import { webhookService } from '../../services/webhook.service';
import { messageDeliveryService } from '../../services/messageDelivery.service';

export interface OutboundJobData {
  conversationId: string;
  messageId: string;
  channelType: string;
  channelId: string;
  content: string;
  contentType: string;
}

export interface OutboundSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

/**
 * Hand one message to its channel provider and record the outcome. A provider rejection is
 * a result (the message becomes FAILED), not an exception, so a message is attempted once
 * and never re-sent by queue retries.
 */
export async function processOutboundJob(
  data: OutboundJobData,
  jobId?: string,
): Promise<OutboundSendResult> {
  logger.info({ jobId, channelType: data.channelType }, 'Sending outbound message');

  // Load channel credentials
  const channel = await prisma.channel.findUnique({
    where: { id: data.channelId },
  });

  if (!channel) {
    // BUG FIX: return instead of throw — throwing causes infinite retries for deleted channels
    logger.warn({ channelId: data.channelId }, 'Channel not found, skipping outbound message');
    const result = { success: false, error: 'Channel not found' };
    await recordResult(data.messageId, result);
    return result;
  }

  // Load conversation for customer ID
  const conversation = await prisma.conversation.findUnique({
    where: { id: data.conversationId },
  });

  if (!conversation) {
    // BUG FIX: return instead of throw — throwing causes infinite retries for deleted conversations
    logger.warn(
      { conversationId: data.conversationId },
      'Conversation not found, skipping outbound message',
    );
    return { success: false, error: 'Conversation not found' };
  }

  // Get adapter and send. Credentials are stored encrypted; the adapter needs the plaintext.
  let result: OutboundSendResult;
  try {
    const adapter = getChannelAdapter(data.channelType);
    result = await adapter.sendMessage(
      channelService.decryptChannelCredentials(channel.credentials),
      {
        recipientId: conversation.customerId,
        content: data.content,
        contentType: data.contentType as MessageContentType,
      },
    );
  } catch (adapterErr) {
    logger.error(
      { err: adapterErr, channelType: data.channelType, messageId: data.messageId },
      'Channel adapter error',
    );
    result = { success: false, error: (adapterErr as Error).message };
  }

  // Update message delivery status. The provider id is what delivery receipts are matched
  // on; the status goes through the forward-only state machine because a receipt can
  // arrive before this write (it must not be reset to SENT).
  await recordResult(data.messageId, result);

  // Track
  try {
    await analyticsQueue.add('track-event', {
      orgId: channel.orgId,
      eventType: 'MESSAGE_SENT',
      data: { conversationId: data.conversationId, success: result.success },
      channelType: data.channelType,
    });
  } catch (analyticsErr) {
    logger.warn(
      { err: analyticsErr, conversationId: data.conversationId },
      'Failed to queue outbound analytics',
    );
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
}

async function recordResult(messageId: string, result: OutboundSendResult) {
  try {
    await messageDeliveryService.recordSendResult(messageId, result);
  } catch (dbErr) {
    logger.error({ err: dbErr, messageId }, 'Failed to update message delivery status');
  }
}
