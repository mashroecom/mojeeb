import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the service
// ---------------------------------------------------------------------------

vi.mock('../config/database', () => ({
  prisma: {
    webhook: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../queues', () => ({
  webhookQueue: {
    addBulk: vi.fn(),
  },
}));

vi.mock('../config', () => ({
  config: {
    nodeEnv: 'test',
  },
}));

import { WebhookService } from './webhook.service';
import { prisma } from '../config/database';
import { BadRequestError } from '../utils/errors';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookService();
  });

  // -----------------------------------------------------------------------
  // SSRF prevention — private URL rejection
  // -----------------------------------------------------------------------
  describe('SSRF prevention (create)', () => {
    const orgId = 'org-1';
    const validEvents = ['message.received'];

    it('should reject localhost URLs', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://localhost/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject 127.0.0.1 URLs', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://127.0.0.1/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject 10.x.x.x private range URLs', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://10.0.0.1/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject 10.255.255.255 private range URLs', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://10.255.255.255/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject 192.168.x.x private range URLs', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://192.168.1.1/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject 192.168.0.100 private range URLs', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://192.168.0.100/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject 172.16-31.x.x private range URLs', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://172.16.0.1/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');

      await expect(
        service.create(orgId, {
          url: 'https://172.31.255.255/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject 169.254.169.254 (AWS metadata endpoint)', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://169.254.169.254/latest/meta-data/',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject 169.254.x.x link-local range', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://169.254.1.1/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject 0.0.0.0 URLs', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://0.0.0.0/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject .local domain URLs', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://myserver.local/hook',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject metadata.google.internal', async () => {
      await expect(
        service.create(orgId, {
          url: 'https://metadata.google.internal/computeMetadata/v1/',
          events: validEvents,
        }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });
  });

  // -----------------------------------------------------------------------
  // SSRF prevention — private URL rejection via update
  // -----------------------------------------------------------------------
  describe('SSRF prevention (update)', () => {
    const orgId = 'org-1';
    const webhookId = 'wh-1';

    beforeEach(() => {
      // Mock getById to return a valid webhook
      vi.mocked(prisma.webhook.findFirst).mockResolvedValue({
        id: webhookId,
        orgId,
        url: 'https://example.com/hook',
        secret: 'abc',
        events: ['message.received'],
        isActive: true,
      } as any);
    });

    it('should reject private URLs when updating', async () => {
      await expect(
        service.update(orgId, webhookId, { url: 'https://127.0.0.1/hook' }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });

    it('should reject localhost when updating', async () => {
      await expect(
        service.update(orgId, webhookId, { url: 'https://localhost/hook' }),
      ).rejects.toThrow('Webhook URL cannot point to private or internal networks');
    });
  });

  // -----------------------------------------------------------------------
  // Valid HTTPS URLs accepted
  // -----------------------------------------------------------------------
  describe('valid HTTPS URLs', () => {
    const orgId = 'org-1';
    const validEvents = ['message.received'];

    it('should accept a valid HTTPS URL', async () => {
      const mockWebhook = {
        id: 'wh-1',
        orgId,
        url: 'https://example.com/webhook',
        secret: 'generated-secret',
        events: validEvents,
        isActive: true,
      };
      vi.mocked(prisma.webhook.create).mockResolvedValue(mockWebhook as any);

      const result = await service.create(orgId, {
        url: 'https://example.com/webhook',
        events: validEvents,
      });

      expect(result).toEqual(mockWebhook);
      expect(prisma.webhook.create).toHaveBeenCalledOnce();
    });

    it('should accept a valid HTTPS URL with a path', async () => {
      vi.mocked(prisma.webhook.create).mockResolvedValue({
        id: 'wh-2',
        orgId,
        url: 'https://hooks.myapp.io/api/v1/incoming',
        events: validEvents,
        isActive: true,
      } as any);

      const result = await service.create(orgId, {
        url: 'https://hooks.myapp.io/api/v1/incoming',
        events: validEvents,
      });

      expect(result.url).toBe('https://hooks.myapp.io/api/v1/incoming');
    });

    it('should accept a valid HTTPS URL with port', async () => {
      vi.mocked(prisma.webhook.create).mockResolvedValue({
        id: 'wh-3',
        orgId,
        url: 'https://example.com:8443/hook',
        events: validEvents,
        isActive: true,
      } as any);

      const result = await service.create(orgId, {
        url: 'https://example.com:8443/hook',
        events: validEvents,
      });

      expect(result.url).toBe('https://example.com:8443/hook');
    });
  });

  // -----------------------------------------------------------------------
  // HTTP URLs rejected (must be HTTPS)
  // -----------------------------------------------------------------------
  describe('non-HTTPS URLs', () => {
    it('should reject HTTP URLs', async () => {
      await expect(
        service.create('org-1', {
          url: 'http://example.com/hook',
          events: ['message.received'],
        }),
      ).rejects.toThrow('Webhook URL must use HTTPS');
    });

    it('should reject URLs without a scheme', async () => {
      await expect(
        service.create('org-1', {
          url: 'example.com/hook',
          events: ['message.received'],
        }),
      ).rejects.toThrow('Webhook URL must use HTTPS');
    });

    it('should reject empty URL', async () => {
      await expect(
        service.create('org-1', {
          url: '',
          events: ['message.received'],
        }),
      ).rejects.toThrow('Webhook URL must use HTTPS');
    });
  });

  // -----------------------------------------------------------------------
  // Invalid events
  // -----------------------------------------------------------------------
  describe('event validation', () => {
    it('should reject invalid event names', async () => {
      await expect(
        service.create('org-1', {
          url: 'https://example.com/hook',
          events: ['invalid.event'],
        }),
      ).rejects.toThrow('Invalid events: invalid.event');
    });

    it('should accept all valid event types', async () => {
      const allEvents = [
        'conversation.created',
        'conversation.closed',
        'message.received',
        'message.sent',
        'lead.created',
        'lead.updated',
      ];

      vi.mocked(prisma.webhook.create).mockResolvedValue({
        id: 'wh-1',
        orgId: 'org-1',
        url: 'https://example.com/hook',
        events: allEvents,
        isActive: true,
      } as any);

      const result = await service.create('org-1', {
        url: 'https://example.com/hook',
        events: allEvents,
      });

      expect(result.events).toEqual(allEvents);
    });
  });
});
