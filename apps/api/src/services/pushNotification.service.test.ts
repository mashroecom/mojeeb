import { randomBytes } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    conversation: { findUnique: vi.fn() },
  },
  sendNotification: vi.fn(),
  assertPublicUrl: vi.fn(),
  config: {
    nodeEnv: 'test',
    push: { vapidPublicKey: '', vapidPrivateKey: '', vapidSubject: '' },
  },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/database', () => ({ prisma: mocks.prisma }));
vi.mock('../config', () => ({ config: mocks.config }));
vi.mock('../config/logger', () => ({ logger: mocks.logger }));
vi.mock('../utils/safeFetch', () => ({ assertPublicUrl: mocks.assertPublicUrl }));
vi.mock('web-push', () => ({ default: { sendNotification: mocks.sendNotification } }));

import { PushNotificationService, PUSH_NOT_CONFIGURED } from './pushNotification.service';

const b64url = (bytes: number) => randomBytes(bytes).toString('base64url');

const VAPID = {
  vapidPublicKey: b64url(65),
  vapidPrivateKey: b64url(32),
  vapidSubject: 'mailto:ops@example.com',
};

const ENDPOINT = 'https://push.example.com/send/abc';
const browserSubscription = () => ({
  endpoint: ENDPOINT,
  keys: { p256dh: b64url(65), auth: b64url(16) },
});

const stored = (id: string) => ({
  id,
  endpoint: `https://push.example.com/send/${id}`,
  p256dh: 'p256dh-key',
  auth: 'auth-secret',
});

const payload = { title: 'Title', body: 'Body', url: '/conversations?id=c1', tag: 'handoff-c1' };

function pushServiceError(statusCode: number) {
  return Object.assign(new Error(`Received unexpected response code ${statusCode}`), {
    statusCode,
  });
}

describe('PushNotificationService', () => {
  let service: PushNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.config.push, VAPID);
    mocks.config.nodeEnv = 'test';
    mocks.assertPublicUrl.mockImplementation(async (url: string) => new URL(url));
    mocks.prisma.pushSubscription.upsert.mockResolvedValue({
      id: 'sub1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([]);
    mocks.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.pushSubscription.updateMany.mockResolvedValue({ count: 0 });
    mocks.sendNotification.mockResolvedValue({ statusCode: 201 });
    service = new PushNotificationService();
  });

  describe('subscribe', () => {
    it('upserts by endpoint so the same browser never gets a second row', async () => {
      const subscription = browserSubscription();

      const result = await service.subscribe({
        userId: 'u1',
        orgId: 'o1',
        subscription,
        deviceInfo: { userAgent: 'UA', platform: 'Android' },
      });

      expect(result).toMatchObject({ subscribed: true, id: 'sub1' });
      expect(mocks.prisma.pushSubscription.upsert).toHaveBeenCalledTimes(1);
      const args = mocks.prisma.pushSubscription.upsert.mock.calls[0]![0];
      expect(args.where).toEqual({ endpoint: ENDPOINT });
      expect(args.create).toMatchObject({
        endpoint: ENDPOINT,
        userId: 'u1',
        orgId: 'o1',
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: 'UA',
        platform: 'Android',
      });
    });

    it('re-assigns an existing endpoint to the user who subscribes now', async () => {
      await service.subscribe({ userId: 'u2', orgId: 'o2', subscription: browserSubscription() });

      const args = mocks.prisma.pushSubscription.upsert.mock.calls[0]![0];
      // The update branch overwrites owner, org and keys of the existing row
      expect(args.update).toMatchObject({ userId: 'u2', orgId: 'o2' });
      expect(args.update.p256dh).toBeTruthy();
      expect(args.update.auth).toBeTruthy();
      expect(args.update).not.toHaveProperty('endpoint');
    });

    it('rejects with 503 PUSH_NOT_CONFIGURED when VAPID keys are missing', async () => {
      Object.assign(mocks.config.push, { vapidPublicKey: '', vapidPrivateKey: '' });

      await expect(
        service.subscribe({ userId: 'u1', orgId: 'o1', subscription: browserSubscription() }),
      ).rejects.toMatchObject({ statusCode: 503, code: PUSH_NOT_CONFIGURED });
      expect(mocks.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it('treats malformed VAPID keys as not configured', async () => {
      Object.assign(mocks.config.push, { vapidPublicKey: 'not-a-key' });

      expect(service.isConfigured()).toBe(false);
      expect(service.getClientConfig()).toEqual({ configured: false, publicKey: null });
    });

    it('rejects keys that are not a P-256 public key and a 16-byte secret', async () => {
      await expect(
        service.subscribe({
          userId: 'u1',
          orgId: 'o1',
          subscription: { endpoint: ENDPOINT, keys: { p256dh: 'abc', auth: 'def' } },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mocks.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it('rejects endpoints that point at internal addresses', async () => {
      mocks.assertPublicUrl.mockRejectedValue(
        Object.assign(new Error('URL points to a private address'), { statusCode: 400 }),
      );

      await expect(
        service.subscribe({ userId: 'u1', orgId: 'o1', subscription: browserSubscription() }),
      ).rejects.toThrow('private address');
      expect(mocks.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it('requires https endpoints', async () => {
      await expect(
        service.subscribe({
          userId: 'u1',
          orgId: 'o1',
          subscription: { ...browserSubscription(), endpoint: 'http://push.example.com/x' },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('unsubscribe', () => {
    it("only deletes the caller's own subscription", async () => {
      mocks.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      await expect(service.unsubscribe('u1', ENDPOINT)).resolves.toEqual({ removed: 1 });
      expect(mocks.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: ENDPOINT, userId: 'u1' },
      });
    });

    it('is idempotent for unknown endpoints', async () => {
      await expect(service.unsubscribe('u1', ENDPOINT)).resolves.toEqual({ removed: 0 });
    });
  });

  describe('getUserSubscriptions', () => {
    it('never selects the key material', async () => {
      await service.getUserSubscriptions('u1', 'o1');

      const args = mocks.prisma.pushSubscription.findMany.mock.calls[0]![0];
      expect(args.where).toEqual({ userId: 'u1', orgId: 'o1' });
      expect(args.select).not.toHaveProperty('p256dh');
      expect(args.select).not.toHaveProperty('auth');
    });
  });

  describe('sendToUser', () => {
    it("sends the payload to each of the user's subscriptions in that org", async () => {
      mocks.prisma.pushSubscription.findMany.mockResolvedValue([stored('a'), stored('b')]);

      const result = await service.sendToUser('u1', 'o1', payload);

      expect(result).toEqual({ sent: 2, removed: 0, failed: 0 });
      expect(mocks.prisma.pushSubscription.findMany.mock.calls[0]![0].where).toMatchObject({
        userId: 'u1',
        orgId: 'o1',
      });
      expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
      const [subscription, body, options] = mocks.sendNotification.mock.calls[0]!;
      expect(subscription).toEqual({
        endpoint: 'https://push.example.com/send/a',
        keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
      });
      expect(JSON.parse(body)).toEqual(payload);
      expect(options.vapidDetails).toEqual({
        subject: VAPID.vapidSubject,
        publicKey: VAPID.vapidPublicKey,
        privateKey: VAPID.vapidPrivateKey,
      });
      expect(options.TTL).toBeGreaterThan(0);
      expect(mocks.prisma.pushSubscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a', 'b'] } },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it.each([410, 404])(
      'removes a subscription the push service reports gone (%i)',
      async (code) => {
        mocks.prisma.pushSubscription.findMany.mockResolvedValue([stored('gone'), stored('ok')]);
        mocks.sendNotification.mockImplementation(async (subscription: { endpoint: string }) => {
          if (subscription.endpoint.endsWith('/gone')) throw pushServiceError(code);
          return { statusCode: 201 };
        });

        const result = await service.sendToUser('u1', 'o1', payload);

        expect(result).toEqual({ sent: 1, removed: 1, failed: 0 });
        expect(mocks.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['gone'] } },
        });
        expect(mocks.prisma.pushSubscription.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ['ok'] } },
          data: { lastUsedAt: expect.any(Date) },
        });
      },
    );

    it('keeps the subscription and still delivers to the others on other failures', async () => {
      mocks.prisma.pushSubscription.findMany.mockResolvedValue([stored('bad'), stored('ok')]);
      mocks.sendNotification.mockImplementation(async (subscription: { endpoint: string }) => {
        if (subscription.endpoint.endsWith('/bad')) throw pushServiceError(500);
        return { statusCode: 201 };
      });

      const result = await service.sendToUser('u1', 'o1', payload);

      expect(result).toEqual({ sent: 1, removed: 0, failed: 1 });
      expect(mocks.prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
      expect(mocks.logger.warn).toHaveBeenCalled();
    });

    it('never throws: network errors and database errors are swallowed', async () => {
      mocks.prisma.pushSubscription.findMany.mockResolvedValue([stored('a')]);
      mocks.sendNotification.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.sendToUser('u1', 'o1', payload)).resolves.toEqual({
        sent: 0,
        removed: 0,
        failed: 1,
      });

      mocks.prisma.pushSubscription.findMany.mockRejectedValue(new Error('db down'));
      await expect(service.sendToUser('u1', 'o1', payload)).resolves.toEqual({
        sent: 0,
        removed: 0,
        failed: 0,
      });
    });

    it('is a logged no-op when push is not configured', async () => {
      Object.assign(mocks.config.push, {
        vapidPublicKey: '',
        vapidPrivateKey: '',
        vapidSubject: '',
      });

      await expect(service.sendToUser('u1', 'o1', payload)).resolves.toEqual({
        sent: 0,
        removed: 0,
        failed: 0,
      });
      await service.sendToUser('u1', 'o1', payload);

      expect(mocks.prisma.pushSubscription.findMany).not.toHaveBeenCalled();
      expect(mocks.sendNotification).not.toHaveBeenCalled();
      // Warned once, not on every message
      expect(mocks.logger.warn).toHaveBeenCalledTimes(1);
    });

    it('truncates long titles and bodies', async () => {
      mocks.prisma.pushSubscription.findMany.mockResolvedValue([stored('a')]);

      await service.sendToUser('u1', 'o1', { ...payload, body: 'x'.repeat(5000) });

      const sent = JSON.parse(mocks.sendNotification.mock.calls[0]![1]);
      expect(sent.body.length).toBeLessThanOrEqual(160);
    });
  });

  describe('notifications', () => {
    beforeEach(() => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'c1',
        customerName: 'Sara',
        org: { defaultLanguage: 'en' },
      });
      mocks.prisma.pushSubscription.findMany.mockResolvedValue([stored('a')]);
    });

    it('notifyHandoff targets the given agent with a small, link-only payload', async () => {
      await service.notifyHandoff({ orgId: 'o1', conversationId: 'c1', toAgentId: 'u9' });

      expect(mocks.prisma.pushSubscription.findMany.mock.calls[0]![0].where).toMatchObject({
        userId: 'u9',
        orgId: 'o1',
      });
      const sent = JSON.parse(mocks.sendNotification.mock.calls[0]![1]);
      expect(sent).toEqual({
        title: 'New handoff request',
        body: 'Conversation with Sara needs attention',
        url: '/conversations?id=c1',
        tag: 'handoff-c1',
        type: 'handoff',
        conversationId: 'c1',
        requireInteraction: true,
      });
    });

    it('notifyHandoff without a target goes to all current org members', async () => {
      await service.notifyHandoff({ orgId: 'o1', conversationId: 'c1' });

      const where = mocks.prisma.pushSubscription.findMany.mock.calls[0]![0].where;
      expect(where).not.toHaveProperty('userId');
      expect(where).toMatchObject({
        orgId: 'o1',
        user: { memberships: { some: { orgId: 'o1' } } },
      });
    });

    it('uses Arabic texts unless the organization language is English', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'c1',
        customerName: null,
        org: { defaultLanguage: 'ar' },
      });

      await service.notifyNewMessage({ orgId: 'o1', conversationId: 'c1' });

      const sent = JSON.parse(mocks.sendNotification.mock.calls[0]![1]);
      expect(sent.title).toBe('رسالة جديدة');
      expect(sent.body).toBe('رسالة جديدة من عميل');
    });

    it('notifyCSATAlert only includes a short preview of the comment', async () => {
      await service.notifyCSATAlert({
        orgId: 'o1',
        conversationId: 'c1',
        rating: 1,
        comment: 'terrible '.repeat(100),
      });

      const sent = JSON.parse(mocks.sendNotification.mock.calls[0]![1]);
      expect(sent.body.startsWith('Sara rated 1/5: terrible')).toBe(true);
      expect(sent.body.length).toBeLessThanOrEqual('Sara rated 1/5: '.length + 50);
    });

    it('does not fail the caller when the push service is down', async () => {
      mocks.sendNotification.mockRejectedValue(new Error('socket hang up'));

      await expect(
        service.notifyEscalation({ orgId: 'o1', conversationId: 'c1', priority: 'urgent' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('cleanupExpiredSubscriptions', () => {
    it('deletes subscriptions not used or refreshed within the window', async () => {
      mocks.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 3 });

      await expect(service.cleanupExpiredSubscriptions(30)).resolves.toBe(3);

      const where = mocks.prisma.pushSubscription.deleteMany.mock.calls[0]![0].where;
      const cutoff: Date = where.OR[0].lastUsedAt.lt;
      const days = (Date.now() - cutoff.getTime()) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThan(30.1);
      expect(where.OR[1]).toEqual({ lastUsedAt: null, createdAt: { lt: cutoff } });
    });
  });
});
