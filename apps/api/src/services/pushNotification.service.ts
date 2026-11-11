import type { Prisma } from '@prisma/client';
import webpush from 'web-push';
import { config } from '../config';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError, BadRequestError, NotFoundError } from '../utils/errors';
import { assertPublicUrl } from '../utils/safeFetch';

/**
 * Web Push (VAPID) notifications for the PWA.
 *
 * Subscriptions are created by the browser (`pushManager.subscribe`) and stored
 * one row per browser install, keyed by the push service endpoint. Sending is
 * best effort: nothing in the send path throws into its caller, so a push
 * service outage can never break message handling.
 */

/** Error code returned (HTTP 503) when the server has no VAPID keys. */
export const PUSH_NOT_CONFIGURED = 'PUSH_NOT_CONFIGURED';

/** Subscription as produced by `PushSubscription.toJSON()` in the browser. */
export interface WebPushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export type PushNotificationType = 'handoff' | 'escalation' | 'csat_alert' | 'new_message';

/**
 * What is delivered to the service worker. Kept deliberately small (push
 * services cap payloads at ~4 KB) and free of conversation content: the
 * notification only says that something needs attention and where to look.
 */
export interface PushNotificationPayload {
  title: string;
  body: string;
  /** Same-origin path the service worker opens when the notification is clicked. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag: string;
  type?: PushNotificationType;
  conversationId?: string;
  requireInteraction?: boolean;
}

export interface PushSendResult {
  /** Subscriptions the push service accepted the message for. */
  sent: number;
  /** Subscriptions the push service reported gone (404/410); deleted. */
  removed: number;
  /** Other failures; logged, subscription kept. */
  failed: number;
}

interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface VapidDetails {
  subject: string;
  publicKey: string;
  privateKey: string;
}

const NOTHING_SENT: PushSendResult = { sent: 0, removed: 0, failed: 0 };

/** How long the push service keeps an undelivered message for an offline device. */
const PUSH_TTL_SECONDS = 60 * 60;
/** Upper bound for one request to a push service. */
const PUSH_TIMEOUT_MS = 10_000;
const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 160;
const MAX_NAME_LENGTH = 40;
const MAX_COMMENT_PREVIEW_LENGTH = 50;
const MAX_DEVICE_INFO_LENGTH = 255;
/** Subscriptions neither refreshed by the app nor successfully pushed to for this long are dropped. */
const DEFAULT_STALE_AFTER_DAYS = 90;

function decodedLength(base64url: string): number {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(base64url)) return -1;
  return Buffer.from(base64url, 'base64url').length;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'invalid-endpoint';
  }
}

/**
 * The VAPID details, or null when push is not (correctly) configured.
 * Keys are generated with `npx web-push generate-vapid-keys`.
 */
function getVapidDetails(): VapidDetails | null {
  const { vapidPublicKey, vapidPrivateKey, vapidSubject } = config.push;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return null;
  // An uncompressed P-256 public key is 65 bytes, the private key 32 bytes.
  if (decodedLength(vapidPublicKey) !== 65 || decodedLength(vapidPrivateKey) !== 32) return null;
  if (!/^(mailto:.+@.+|https:\/\/.+)/.test(vapidSubject)) return null;
  return { subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey };
}

type Lang = 'ar' | 'en';

const TEXT = {
  en: {
    customer: 'Customer',
    handoffTitle: 'New handoff request',
    handoffBody: (name: string) => `Conversation with ${name} needs attention`,
    escalationUrgentTitle: 'Urgent escalation',
    escalationHighTitle: 'High-priority escalation',
    escalationBody: (name: string) => `Conversation with ${name} requires immediate attention`,
    csatTitle: 'Low CSAT alert',
    csatBody: (name: string, rating: number) => `${name} rated ${rating}/5`,
    messageTitle: 'New message',
    messageBody: (name: string) => `New message from ${name}`,
  },
  ar: {
    customer: 'عميل',
    handoffTitle: 'طلب تحويل جديد',
    handoffBody: (name: string) => `المحادثة مع ${name} تحتاج إلى متابعة`,
    escalationUrgentTitle: 'تصعيد عاجل',
    escalationHighTitle: 'تصعيد ذو أولوية عالية',
    escalationBody: (name: string) => `المحادثة مع ${name} تتطلب متابعة فورية`,
    csatTitle: 'تنبيه: تقييم رضا منخفض',
    csatBody: (name: string, rating: number) => `${name} أعطى تقييم ${rating}/5`,
    messageTitle: 'رسالة جديدة',
    messageBody: (name: string) => `رسالة جديدة من ${name}`,
  },
} as const;

export class PushNotificationService {
  private warnedNotConfigured = false;

  /** True when VAPID keys are present and well-formed. */
  isConfigured(): boolean {
    return getVapidDetails() !== null;
  }

  /**
   * What the browser needs to subscribe: the VAPID public key (not a secret).
   * `publicKey` is null when push is not configured on this server.
   */
  getClientConfig(): { configured: boolean; publicKey: string | null } {
    const vapid = getVapidDetails();
    return { configured: vapid !== null, publicKey: vapid?.publicKey ?? null };
  }

  /**
   * Store a browser's push subscription for a user in an organization.
   *
   * Upserts by endpoint: re-subscribing the same browser updates the existing
   * row, and an endpoint that was registered by somebody else (shared device,
   * different login) is re-assigned to the caller rather than left delivering
   * the previous user's notifications.
   */
  async subscribe(data: {
    userId: string;
    orgId: string;
    subscription: WebPushSubscriptionInput;
    deviceInfo?: {
      userAgent?: string;
      platform?: string;
    };
  }) {
    if (!this.isConfigured()) {
      throw new AppError(
        'Push notifications are not configured on this server',
        503,
        PUSH_NOT_CONFIGURED,
      );
    }

    const { endpoint, keys } = data.subscription;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new BadRequestError('Invalid subscription format');
    }
    // The browser's P-256 public key (65 bytes, uncompressed) and 16-byte auth secret.
    if (decodedLength(keys.p256dh) !== 65 || decodedLength(keys.auth) !== 16) {
      throw new BadRequestError('Invalid subscription keys');
    }
    await this.assertAllowedEndpoint(endpoint);

    const fields = {
      userId: data.userId,
      orgId: data.orgId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: data.deviceInfo?.userAgent?.slice(0, MAX_DEVICE_INFO_LENGTH) ?? null,
      platform: data.deviceInfo?.platform?.slice(0, MAX_DEVICE_INFO_LENGTH) ?? null,
    };

    const saved = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, ...fields, lastUsedAt: new Date() },
      update: { ...fields, lastUsedAt: new Date() },
      select: { id: true, createdAt: true },
    });

    return { subscribed: true, id: saved.id, createdAt: saved.createdAt };
  }

  /**
   * Remove one of the caller's own subscriptions. Idempotent: an endpoint that
   * is unknown, or belongs to another user, removes nothing.
   */
  async unsubscribe(userId: string, endpoint: string): Promise<{ removed: number }> {
    if (!endpoint) {
      throw new BadRequestError('Endpoint is required');
    }
    const { count } = await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    return { removed: count };
  }

  /**
   * A user's subscriptions in an organization. Never includes the key material.
   */
  async getUserSubscriptions(userId: string, orgId: string) {
    return prisma.pushSubscription.findMany({
      where: { userId, orgId },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        platform: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Send to every subscription a user has in an organization (the user must
   * still be a member). Never throws.
   */
  async sendToUser(
    userId: string,
    orgId: string,
    payload: PushNotificationPayload,
  ): Promise<PushSendResult> {
    return this.sendWhere({ userId, orgId, user: { memberships: { some: { orgId } } } }, payload, {
      userId,
      orgId,
    });
  }

  /**
   * Send to every subscription of every current member of an organization.
   * Never throws.
   */
  async sendToOrgMembers(orgId: string, payload: PushNotificationPayload): Promise<PushSendResult> {
    return this.sendWhere({ orgId, user: { memberships: { some: { orgId } } } }, payload, {
      orgId,
    });
  }

  /**
   * Notify about a conversation handed off to a human: the targeted agent, or
   * every member when nobody specific is targeted.
   */
  async notifyHandoff(data: {
    orgId: string;
    conversationId: string;
    fromAgentId?: string;
    toAgentId?: string;
  }): Promise<void> {
    const { name, text } = await this.conversationContext(data.conversationId);
    const payload: PushNotificationPayload = {
      title: text.handoffTitle,
      body: text.handoffBody(name),
      url: this.conversationUrl(data.conversationId),
      tag: `handoff-${data.conversationId}`,
      type: 'handoff',
      conversationId: data.conversationId,
      requireInteraction: true,
    };

    if (data.toAgentId) {
      await this.sendToUser(data.toAgentId, data.orgId, payload);
    } else {
      await this.sendToOrgMembers(data.orgId, payload);
    }
  }

  /** Notify every member about an escalated conversation. */
  async notifyEscalation(data: {
    orgId: string;
    conversationId: string;
    priority: 'high' | 'urgent';
  }): Promise<void> {
    const { name, text } = await this.conversationContext(data.conversationId);
    await this.sendToOrgMembers(data.orgId, {
      title: data.priority === 'urgent' ? text.escalationUrgentTitle : text.escalationHighTitle,
      body: text.escalationBody(name),
      url: this.conversationUrl(data.conversationId),
      tag: `escalation-${data.conversationId}`,
      type: 'escalation',
      conversationId: data.conversationId,
      requireInteraction: true,
    });
  }

  /** Notify every member about a low CSAT rating (with a short preview of the comment). */
  async notifyCSATAlert(data: {
    orgId: string;
    conversationId: string;
    rating: number;
    comment?: string;
  }): Promise<void> {
    const { name, text } = await this.conversationContext(data.conversationId);
    const preview = data.comment ? truncate(data.comment, MAX_COMMENT_PREVIEW_LENGTH) : '';
    await this.sendToOrgMembers(data.orgId, {
      title: text.csatTitle,
      body: `${text.csatBody(name, data.rating)}${preview ? `: ${preview}` : ''}`,
      url: this.conversationUrl(data.conversationId),
      tag: `csat-${data.conversationId}`,
      type: 'csat_alert',
      conversationId: data.conversationId,
      requireInteraction: false,
    });
  }

  /**
   * Notify about a new customer message: the assigned agent, or every member
   * when the conversation is unassigned. The message text itself is not sent.
   */
  async notifyNewMessage(data: {
    orgId: string;
    conversationId: string;
    assignedAgentId?: string;
  }): Promise<void> {
    const { name, text } = await this.conversationContext(data.conversationId);
    const payload: PushNotificationPayload = {
      title: text.messageTitle,
      body: text.messageBody(name),
      url: this.conversationUrl(data.conversationId),
      tag: `message-${data.conversationId}`,
      type: 'new_message',
      conversationId: data.conversationId,
      requireInteraction: false,
    };

    if (data.assignedAgentId) {
      await this.sendToUser(data.assignedAgentId, data.orgId, payload);
    } else {
      await this.sendToOrgMembers(data.orgId, payload);
    }
  }

  /**
   * Delete subscriptions that have neither been refreshed by the app nor
   * successfully pushed to within `olderThanDays` (subscriptions the push
   * service reports gone are removed immediately at send time). Returns the
   * number of rows deleted.
   */
  async cleanupExpiredSubscriptions(olderThanDays: number = DEFAULT_STALE_AFTER_DAYS) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const { count } = await prisma.pushSubscription.deleteMany({
      where: {
        OR: [{ lastUsedAt: { lt: cutoff } }, { lastUsedAt: null, createdAt: { lt: cutoff } }],
      },
    });
    if (count > 0) {
      logger.info({ count, olderThanDays }, 'Removed stale push subscriptions');
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private conversationUrl(conversationId: string): string {
    return `/conversations?id=${encodeURIComponent(conversationId)}`;
  }

  /** Customer display name and the notification texts in the organization's language. */
  private async conversationContext(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        customerName: true,
        org: { select: { defaultLanguage: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const lang: Lang = conversation.org?.defaultLanguage === 'en' ? 'en' : 'ar';
    const text = TEXT[lang];
    const name = conversation.customerName
      ? truncate(conversation.customerName, MAX_NAME_LENGTH)
      : text.customer;
    return { name, text };
  }

  /**
   * Push endpoints are URLs supplied by the client that this server later
   * POSTs to, so they get the same treatment as webhook URLs: never a
   * private/internal address. Push services are https only.
   */
  private async assertAllowedEndpoint(endpoint: string): Promise<void> {
    const url = await assertPublicUrl(endpoint);
    if (url.protocol !== 'https:') {
      throw new BadRequestError('Push endpoint must use https');
    }
  }

  private async sendWhere(
    where: Prisma.PushSubscriptionWhereInput,
    payload: PushNotificationPayload,
    logContext: Record<string, unknown>,
  ): Promise<PushSendResult> {
    try {
      const vapid = getVapidDetails();
      if (!vapid) {
        if (!this.warnedNotConfigured) {
          this.warnedNotConfigured = true;
          logger.warn(
            'Push notifications are not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT); skipping push sends',
          );
        }
        return { ...NOTHING_SENT };
      }

      const subscriptions: StoredSubscription[] = await prisma.pushSubscription.findMany({
        where,
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
      if (subscriptions.length === 0) return { ...NOTHING_SENT };

      const body = JSON.stringify({
        ...payload,
        title: truncate(payload.title, MAX_TITLE_LENGTH),
        body: truncate(payload.body, MAX_BODY_LENGTH),
      });

      const outcomes = await Promise.all(
        subscriptions.map((subscription) => this.sendOne(subscription, body, vapid, payload)),
      );

      const delivered = subscriptions.filter((_, i) => outcomes[i] === 'sent').map((s) => s.id);
      const gone = subscriptions.filter((_, i) => outcomes[i] === 'gone').map((s) => s.id);
      const failed = outcomes.filter((o) => o === 'failed').length;

      if (gone.length > 0) {
        await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
      }
      if (delivered.length > 0) {
        await prisma.pushSubscription.updateMany({
          where: { id: { in: delivered } },
          data: { lastUsedAt: new Date() },
        });
      }

      const result = { sent: delivered.length, removed: gone.length, failed };
      logger.debug({ ...logContext, ...result, tag: payload.tag }, 'Push notification sent');
      return result;
    } catch (err) {
      logger.warn({ err, ...logContext, tag: payload.tag }, 'Failed to send push notification');
      return { ...NOTHING_SENT };
    }
  }

  /** Deliver to one subscription. Resolves to an outcome; never rejects. */
  private async sendOne(
    subscription: StoredSubscription,
    body: string,
    vapid: VapidDetails,
    payload: PushNotificationPayload,
  ): Promise<'sent' | 'gone' | 'failed'> {
    try {
      await this.assertAllowedEndpoint(subscription.endpoint);
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
        {
          vapidDetails: vapid,
          TTL: PUSH_TTL_SECONDS,
          urgency: payload.requireInteraction ? 'high' : 'normal',
          timeout: PUSH_TIMEOUT_MS,
        },
      );
      return 'sent';
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 404/410: the browser unsubscribed or the subscription expired for good.
      if (statusCode === 404 || statusCode === 410) return 'gone';
      logger.warn(
        {
          statusCode,
          host: endpointHost(subscription.endpoint),
          subscriptionId: subscription.id,
          message: err instanceof Error ? err.message : String(err),
        },
        'Push delivery failed',
      );
      return 'failed';
    }
  }
}

export const pushNotificationService = new PushNotificationService();
