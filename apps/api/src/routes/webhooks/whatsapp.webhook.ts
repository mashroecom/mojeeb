import { Router } from 'express';
import { getChannelAdapter } from '../../channels';
import { inboundQueue } from '../../queues';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { webhookLimiter } from '../../middleware/rateLimiter';
import { parseWhatsAppStatuses } from '../../channels/whatsapp.statuses';
import { messageDeliveryService } from '../../services/messageDelivery.service';

const router: Router = Router();

router.use(webhookLimiter);

// GET /api/v1/webhooks/whatsapp - Verification challenge
router.get('/', (req, res) => {
  const adapter = getChannelAdapter('WHATSAPP');
  adapter.handleVerificationChallenge(req, res);
});

// POST /api/v1/webhooks/whatsapp - Incoming messages and delivery receipts (statuses)
router.post('/', async (req, res) => {
  // Always respond 200 immediately (Meta requirement)
  res.sendStatus(200);

  const adapter = getChannelAdapter('WHATSAPP');

  if (!adapter.verifyWebhook(req)) {
    logger.warn('Invalid WhatsApp webhook signature');
    return;
  }

  // Delivery receipts (sent / delivered / read / failed) arrive on the same, signature-verified
  // webhook. They are light DB updates, so they are applied inline; a failure here must not
  // stop the inbound messages below from being queued.
  try {
    const statuses = parseWhatsAppStatuses(req.body);
    if (statuses.length > 0) {
      await messageDeliveryService.applyWhatsAppStatuses(statuses);
    }
  } catch (err) {
    logger.error({ err }, 'Failed to process WhatsApp delivery receipts');
  }

  const messages = adapter.parseInbound(req.body);

  for (const message of messages) {
    // Find channel by phone number
    const channel = await prisma.channel.findFirst({
      where: { type: 'WHATSAPP', isActive: true },
    });

    if (!channel) {
      logger.warn({ senderId: message.senderId }, 'No active WhatsApp channel found');
      continue;
    }

    await inboundQueue.add('process-message', {
      channelType: 'WHATSAPP',
      channelId: channel.id,
      orgId: channel.orgId,
      message,
      receivedAt: new Date().toISOString(),
    });
  }
});

export default router;
