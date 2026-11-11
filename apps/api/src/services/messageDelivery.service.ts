import { DeliveryStatus, MessageRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emitToOrg } from '../websocket/index';
import { allowedPreviousStatuses, buildTransition } from './deliveryStatus';
import type { DeliveryTransitionInput } from './deliveryStatus';
import type { WhatsAppStatusUpdate } from '../channels/whatsapp.statuses';

// Delivery status only applies to messages the platform sends to the customer.
const OUTBOUND_ROLES: MessageRole[] = [MessageRole.AI_AGENT, MessageRole.HUMAN_AGENT];

/** Upper bound on messages touched by one receipt (a webchat receipt lists message ids). */
const MAX_MESSAGES_PER_UPDATE = 100;

export interface AppliedDeliveryUpdate {
  messageId: string;
  conversationId: string;
  orgId: string;
  deliveryStatus: DeliveryStatus;
  deliveredAt: Date | null;
  readAt: Date | null;
  failureReason: string | null;
}

export interface DeliveryUpdateResult {
  /** Outbound messages the scope matched (0 = unknown id / not ours). */
  matched: number;
  /** Messages whose status actually advanced. */
  applied: AppliedDeliveryUpdate[];
}

export class MessageDeliveryService {
  /**
   * Move the outbound messages matched by `scope` to `input.status`, forward only.
   *
   * `scope` is what keeps a receipt inside its tenant: callers must constrain it to the
   * channel / conversation the receipt was authenticated for. Each row is updated with a
   * compare-and-set on its current status, so concurrent and repeated receipts cannot move
   * a message backwards.
   */
  async applyUpdate(
    scope: Prisma.MessageWhereInput,
    input: DeliveryTransitionInput,
  ): Promise<DeliveryUpdateResult> {
    const allowedPrevious = allowedPreviousStatuses(input.status);
    if (allowedPrevious.length === 0) return { matched: 0, applied: [] };

    const candidates = await prisma.message.findMany({
      where: { AND: [scope, { role: { in: OUTBOUND_ROLES } }] },
      select: {
        id: true,
        conversationId: true,
        deliveryStatus: true,
        createdAt: true,
        deliveredAt: true,
        readAt: true,
        failureReason: true,
        conversation: { select: { orgId: true } },
      },
      take: MAX_MESSAGES_PER_UPDATE,
    });

    const applied: AppliedDeliveryUpdate[] = [];
    const now = new Date();

    for (const message of candidates) {
      const data = buildTransition(message, input, now);
      if (!data) continue;

      const { count } = await prisma.message.updateMany({
        where: { id: message.id, deliveryStatus: { in: allowedPrevious } },
        data,
      });
      if (count === 0) continue; // lost a race with a newer receipt

      const update: AppliedDeliveryUpdate = {
        messageId: message.id,
        conversationId: message.conversationId,
        orgId: message.conversation.orgId,
        deliveryStatus: data.deliveryStatus,
        deliveredAt: data.deliveredAt ?? message.deliveredAt,
        readAt: data.readAt ?? message.readAt,
        failureReason: data.failureReason ?? message.failureReason,
      };
      applied.push(update);
      this.notifyDashboard(update);
    }

    return { matched: candidates.length, applied };
  }

  /**
   * Apply WhatsApp delivery receipts. A receipt is only applied to a message that was sent
   * through the WhatsApp channel the webhook was authenticated for (`channelId`) and that is
   * registered for the receipt's own phone number id, so a receipt can never touch another
   * organization's (or another number's) message.
   */
  async applyWhatsAppStatuses(
    updates: WhatsAppStatusUpdate[],
    channelId?: string,
  ): Promise<AppliedDeliveryUpdate[]> {
    const applied: AppliedDeliveryUpdate[] = [];

    for (const update of updates) {
      try {
        const result = await this.applyUpdate(
          {
            externalId: update.externalMessageId,
            conversation: {
              ...(channelId ? { channelId } : {}),
              channel: { type: 'WHATSAPP', externalId: update.phoneNumberId },
            },
          },
          { status: update.status, at: update.timestamp, failureReason: update.failureReason },
        );
        if (result.matched === 0) {
          logger.debug(
            { externalId: update.externalMessageId, status: update.status },
            'WhatsApp receipt for unknown message ignored',
          );
        }
        applied.push(...result.applied);
      } catch (err) {
        logger.error(
          { err, externalId: update.externalMessageId, status: update.status },
          'Failed to apply WhatsApp delivery receipt',
        );
      }
    }

    return applied;
  }

  /**
   * Record the outcome of handing a message to the channel provider. The provider id is
   * always stored (receipts are matched on it), but the status goes through the state
   * machine: a receipt that raced ahead of this write must not be overwritten with SENT.
   */
  async recordSendResult(
    messageId: string,
    result: { success: boolean; externalId?: string; error?: string },
  ): Promise<void> {
    if (result.externalId) {
      await prisma.message.updateMany({
        where: { id: messageId },
        data: { externalId: result.externalId },
      });
    }

    await this.applyUpdate(
      { id: messageId },
      result.success
        ? { status: DeliveryStatus.SENT }
        : { status: DeliveryStatus.FAILED, failureReason: result.error },
    );
  }

  /** Same channel the dashboard already listens on for message:new / conversation:updated. */
  private notifyDashboard(update: AppliedDeliveryUpdate) {
    try {
      emitToOrg(update.orgId, 'message:status', {
        messageId: update.messageId,
        conversationId: update.conversationId,
        deliveryStatus: update.deliveryStatus,
        deliveredAt: update.deliveredAt,
        readAt: update.readAt,
        failureReason: update.failureReason,
      });
    } catch (err) {
      logger.warn({ err, messageId: update.messageId }, 'Failed to emit message:status');
    }
  }
}

export const messageDeliveryService = new MessageDeliveryService();
