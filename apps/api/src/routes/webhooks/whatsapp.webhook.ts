import { Router } from 'express';
import type { Request } from 'express';
import { getChannelAdapter } from '../../channels';
import { inboundQueue } from '../../queues';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { webhookLimiter } from '../../middleware/rateLimiter';
import { parseWhatsAppStatuses } from '../../channels/whatsapp.statuses';
import {
  groupWhatsAppChangesByPhoneNumber,
  matchesVerifyToken,
  resolveWhatsAppChannel,
  verifyMetaSignature,
} from '../../channels/whatsapp.routing';
import { channelService } from '../../services/channel.service';
import { messageDeliveryService } from '../../services/messageDelivery.service';

const router: Router = Router();

router.use(webhookLimiter);

// GET /api/v1/webhooks/whatsapp - Verification challenge
// Accepts the platform verify token (env META_VERIFY_TOKEN) or the verify token of an active
// WhatsApp channel, for organizations that connect their own Meta app. Empty tokens never match.
router.get('/', async (req, res) => {
  try {
    const tokens: (string | undefined)[] = [config.meta.verifyToken];
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
      const channels = await prisma.channel.findMany({
        where: { type: 'WHATSAPP', isActive: true },
        select: { credentials: true },
      });
      for (const channel of channels) {
        tokens.push(channelService.decryptChannelCredentials(channel.credentials).verifyToken);
      }
    }

    if (
      req.query['hub.mode'] === 'subscribe' &&
      matchesVerifyToken(req.query['hub.verify_token'], tokens)
    ) {
      res.status(200).send(req.query['hub.challenge']);
    } else {
      res.sendStatus(403);
    }
  } catch (err) {
    logger.error({ err }, 'WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

// POST /api/v1/webhooks/whatsapp - Incoming messages and delivery receipts (statuses)
router.post('/', async (req, res) => {
  // Always respond 200 immediately (Meta requirement)
  res.sendStatus(200);

  try {
    await handleWebhook(req);
  } catch (err) {
    logger.error({ err }, 'Failed to process WhatsApp webhook');
  }
});

async function handleWebhook(req: Request) {
  // Use the raw body preserved by express.json verify callback for accurate signature verification.
  const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
  const signature = req.headers['x-hub-signature-256'];
  const platformSignatureValid = verifyMetaSignature(rawBody, signature, config.meta.appSecret);

  // Nothing is acted on before the signature is checked. The phone number ids are only
  // read from the (still untrusted) body to find which channel secrets may verify it.
  const groups = groupWhatsAppChangesByPhoneNumber(req.body);
  const phoneNumberIds = groups
    .map((group) => group.phoneNumberId)
    .filter((id): id is string => id !== null);

  const channels =
    signature && phoneNumberIds.length > 0
      ? await prisma.channel.findMany({
          where: { type: 'WHATSAPP', externalId: { in: phoneNumberIds } },
          select: {
            id: true,
            orgId: true,
            isActive: true,
            createdAt: true,
            externalId: true,
            credentials: true,
          },
        })
      : [];
  const candidates = channels.map((channel) => ({
    id: channel.id,
    orgId: channel.orgId,
    isActive: channel.isActive,
    createdAt: channel.createdAt,
    externalId: channel.externalId,
    appSecret: channelService.decryptChannelCredentials(channel.credentials).appSecret,
  }));

  if (groups.length === 0 && !platformSignatureValid) {
    logger.warn('Invalid WhatsApp webhook signature');
    return;
  }

  const adapter = getChannelAdapter('WHATSAPP');

  for (const group of groups) {
    // Route strictly by the business phone number the event is for — never fall back to
    // "any WhatsApp channel", that would deliver one tenant's messages to another.
    const forNumber = candidates.filter((c) => c.externalId === group.phoneNumberId);
    const resolution = resolveWhatsAppChannel(forNumber, platformSignatureValid, (secret) =>
      verifyMetaSignature(rawBody, signature, secret),
    );

    if (resolution.status === 'bad_signature') {
      logger.warn({ phoneNumberId: group.phoneNumberId }, 'Invalid WhatsApp webhook signature');
      continue;
    }
    if (resolution.status === 'unknown_number') {
      logger.warn(
        { phoneNumberId: group.phoneNumberId },
        'WhatsApp webhook event for a phone number with no connected channel dropped',
      );
      continue;
    }

    const channel = resolution.channel;
    if (forNumber.length > 1) {
      logger.warn(
        { phoneNumberId: group.phoneNumberId, channelId: channel.id, claimedBy: forNumber.length },
        'Several WhatsApp channels claim the same phone number id',
      );
    }

    // Delivery receipts (sent / delivered / read / failed): light DB updates, applied inline.
    // A failure here must not stop the inbound messages below from being queued.
    try {
      const statuses = parseWhatsAppStatuses(group.payload);
      if (statuses.length > 0) {
        await messageDeliveryService.applyWhatsAppStatuses(statuses, channel.id);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process WhatsApp delivery receipts');
    }

    const messages = adapter.parseInbound(group.payload);
    if (messages.length > 0 && !channel.isActive) {
      logger.warn(
        { channelId: channel.id },
        'Inbound WhatsApp message for an inactive channel dropped',
      );
      continue;
    }

    for (const message of messages) {
      await inboundQueue.add('process-message', {
        channelType: 'WHATSAPP',
        channelId: channel.id,
        orgId: channel.orgId,
        message,
        receivedAt: new Date().toISOString(),
      });
    }
  }
}

export default router;
