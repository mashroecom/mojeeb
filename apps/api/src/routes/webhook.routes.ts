import { Router } from 'express';
import { z } from 'zod';
import { webhookService } from '../services/webhook.service';
import { authenticate, orgContext, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

interface OrgParams { orgId: string; [key: string]: string; }
interface WebhookParams extends OrgParams { webhookId: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext, requireRole('OWNER', 'ADMIN'));

// GET /api/v1/organizations/:orgId/webhooks
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const webhooks = await webhookService.list(orgId);
    // Strip secrets from list response
    const safe = webhooks.map(({ secret, ...rest }) => rest);
    res.json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/webhooks/:webhookId
router.get('/:webhookId', async (req, res, next) => {
  try {
    const { orgId, webhookId } = req.params as WebhookParams;
    const webhook = await webhookService.getById(orgId, webhookId);
    const { secret, ...safe } = webhook;
    res.json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/webhooks
const createSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

router.post(
  '/',
  validate({ body: createSchema }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const { url, events } = req.body;
      const webhook = await webhookService.create(orgId, { url, events });
      // Return secret only on creation
      res.status(201).json({ success: true, data: webhook });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/organizations/:orgId/webhooks/:webhookId
const updateSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  '/:webhookId',
  validate({ body: updateSchema }),
  async (req, res, next) => {
    try {
      const { orgId, webhookId } = req.params as WebhookParams;
      const data = req.body;
      const webhook = await webhookService.update(orgId, webhookId, data);
      const { secret, ...safe } = webhook;
      res.json({ success: true, data: safe });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/organizations/:orgId/webhooks/:webhookId
router.delete('/:webhookId', async (req, res, next) => {
  try {
    const { orgId, webhookId } = req.params as WebhookParams;
    await webhookService.delete(orgId, webhookId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/webhooks/:webhookId/regenerate-secret
router.post('/:webhookId/regenerate-secret', async (req, res, next) => {
  try {
    const { orgId, webhookId } = req.params as WebhookParams;
    const webhook = await webhookService.regenerateSecret(orgId, webhookId);
    res.json({ success: true, data: { secret: webhook.secret } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/webhooks/:webhookId/logs
router.get('/:webhookId/logs', async (req, res, next) => {
  try {
    const { orgId, webhookId } = req.params as WebhookParams;
    await webhookService.getById(orgId, webhookId); // verify ownership
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { prisma } = await import('../config/database');
    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.webhookLog.count({ where: { webhookId } }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/webhooks/:webhookId/test
router.post('/:webhookId/test', async (req, res, next) => {
  try {
    const { orgId, webhookId } = req.params as WebhookParams;
    const webhook = await webhookService.getById(orgId, webhookId);

    // Queue a test delivery via BullMQ
    const { webhookQueue } = await import('../queues');
    await webhookQueue.add(`test:${webhook.id}`, {
      webhookId: webhook.id,
      event: 'test.ping',
      payload: {
        event: 'test.ping',
        timestamp: new Date().toISOString(),
        data: { message: 'This is a test webhook from Mojeeb' },
      },
    });

    res.json({ success: true, message: 'Test event sent' });
  } catch (err) {
    next(err);
  }
});

export default router;
