import { DeliveryStatus } from '@prisma/client';
import { logger } from '../config/logger';
import { outboundQueue } from '../queues';
import { messageDeliveryService } from './messageDelivery.service';
import { channelNeedsOutboundSend, outboundJobId } from './outboundDispatch';

interface DispatchableMessage {
  id: string;
  conversationId: string;
  content: string;
  contentType: string;
}

export class OutboundDispatchService {
  /**
   * Queue a stored message for delivery through its channel provider, exactly once.
   * No-op for web chat. Returns whether a send was queued. If the queue is unavailable the
   * message is marked FAILED so the agent sees that it did not go out.
   */
  async dispatch(
    message: DispatchableMessage,
    channel: { id: string; type: string },
  ): Promise<boolean> {
    if (!channelNeedsOutboundSend(channel.type)) return false;

    try {
      await outboundQueue.add(
        'send-message',
        {
          conversationId: message.conversationId,
          messageId: message.id,
          channelType: channel.type,
          channelId: channel.id,
          content: message.content,
          contentType: message.contentType,
        },
        { jobId: outboundJobId(message.id) },
      );
      return true;
    } catch (err) {
      logger.error({ err, messageId: message.id }, 'Failed to queue outbound message');
      try {
        await messageDeliveryService.applyUpdate(
          { id: message.id },
          { status: DeliveryStatus.FAILED, failureReason: 'Could not queue message for sending' },
        );
      } catch (statusErr) {
        logger.error({ err: statusErr, messageId: message.id }, 'Failed to mark message FAILED');
      }
      return false;
    }
  }
}

export const outboundDispatchService = new OutboundDispatchService();
