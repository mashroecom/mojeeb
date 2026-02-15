import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { webhookQueue } from '../queues';

const VALID_EVENTS = [
  'conversation.created',
  'conversation.closed',
  'message.received',
  'message.sent',
  'lead.created',
  'lead.updated',
] as const;

/** Block webhook URLs pointing to private/internal networks (SSRF prevention). */
function isPrivateUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname;
    // Block localhost, loopback, link-local, and private IP ranges
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      // AWS/cloud metadata endpoints
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal'
    ) {
      return true;
    }
    return false;
  } catch {
    return true; // Reject malformed URLs
  }
}

export class WebhookService {
  async list(orgId: string) {
    return prisma.webhook.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(orgId: string, webhookId: string) {
    const webhook = await prisma.webhook.findFirst({
      where: { id: webhookId, orgId },
    });
    if (!webhook) throw new NotFoundError('Webhook not found');
    return webhook;
  }

  async create(orgId: string, data: { url: string; events: string[] }) {
    if (!data.url || !data.url.startsWith('https://')) {
      throw new BadRequestError('Webhook URL must use HTTPS');
    }

    if (isPrivateUrl(data.url)) {
      throw new BadRequestError('Webhook URL cannot point to private or internal networks');
    }

    const invalidEvents = data.events.filter(
      (e) => !(VALID_EVENTS as readonly string[]).includes(e),
    );
    if (invalidEvents.length > 0) {
      throw new BadRequestError(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        orgId,
        url: data.url,
        secret,
        events: data.events,
        isActive: true,
      },
    });

    logger.info({ orgId, webhookId: webhook.id }, 'Webhook created');
    return webhook;
  }

  async update(
    orgId: string,
    webhookId: string,
    data: { url?: string; events?: string[]; isActive?: boolean },
  ) {
    await this.getById(orgId, webhookId);

    if (data.url && !data.url.startsWith('https://')) {
      throw new BadRequestError('Webhook URL must use HTTPS');
    }

    if (data.url && isPrivateUrl(data.url)) {
      throw new BadRequestError('Webhook URL cannot point to private or internal networks');
    }

    if (data.events) {
      const invalidEvents = data.events.filter(
        (e) => !(VALID_EVENTS as readonly string[]).includes(e),
      );
      if (invalidEvents.length > 0) {
        throw new BadRequestError(`Invalid events: ${invalidEvents.join(', ')}`);
      }
    }

    return prisma.webhook.update({
      where: { id: webhookId },
      data,
    });
  }

  async delete(orgId: string, webhookId: string) {
    await this.getById(orgId, webhookId);
    await prisma.webhook.delete({ where: { id: webhookId } });
    logger.info({ orgId, webhookId }, 'Webhook deleted');
  }

  async regenerateSecret(orgId: string, webhookId: string) {
    await this.getById(orgId, webhookId);
    const secret = crypto.randomBytes(32).toString('hex');
    return prisma.webhook.update({
      where: { id: webhookId },
      data: { secret },
    });
  }

  /**
   * Dispatch an event to all active webhooks subscribed to it.
   * Each webhook delivery is enqueued as a BullMQ job with automatic
   * retry (5 attempts, exponential backoff: 5s → 10s → 20s → 40s → 80s).
   */
  async dispatch(orgId: string, event: string, payload: unknown) {
    const webhooks = await prisma.webhook.findMany({
      where: { orgId, isActive: true, events: { has: event } },
    });

    if (webhooks.length === 0) return;

    const jobs = webhooks.map((webhook) => ({
      name: `${event}:${webhook.id}`,
      data: { webhookId: webhook.id, event, payload },
    }));

    await webhookQueue.addBulk(jobs);

    logger.info(
      { orgId, event, count: webhooks.length },
      'Webhook dispatch jobs enqueued',
    );
  }
}

export const webhookService = new WebhookService();
