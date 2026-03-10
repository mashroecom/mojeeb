import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';

const router: Router = Router();

// GET / - List all webhooks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const orgId = req.query.orgId as string | undefined;
    const status = req.query.status as string | undefined;

    const where: any = {};
    if (orgId) where.orgId = orgId;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const [webhooks, total] = await Promise.all([
      prisma.webhook.findMany({
        where,
        include: {
          org: { select: { id: true, name: true } },
          _count: { select: { logs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.webhook.count({ where }),
    ]);

    res.json({
      success: true,
      data: { webhooks, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Webhook statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, active, inactive, recentLogs] = await Promise.all([
      prisma.webhook.count(),
      prisma.webhook.count({ where: { isActive: true } }),
      prisma.webhook.count({ where: { isActive: false } }),
      prisma.webhookLog.count({
        where: { success: false, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    res.json({
      success: true,
      data: { total, active, inactive, recentErrors: recentLogs },
    });
  } catch (err) {
    next(err);
  }
});

// GET /:webhookId - Webhook detail with recent logs
router.get('/:webhookId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { webhookId } = req.params as { webhookId: string };
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
      include: {
        org: { select: { id: true, name: true } },
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!webhook) {
      return res.status(404).json({ success: false, message: 'Webhook not found' });
    }

    res.json({ success: true, data: webhook });
  } catch (err) {
    next(err);
  }
});

const updateWebhookSchema = z.object({
  isActive: z.boolean().optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
});

// PATCH /:webhookId - Update webhook
router.patch(
  '/:webhookId',
  validate({ body: updateWebhookSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { webhookId } = req.params as { webhookId: string };
      const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
      if (!webhook) {
        return res.status(404).json({ success: false, message: 'Webhook not found' });
      }

      const updated = await prisma.webhook.update({
        where: { id: webhookId },
        data: req.body,
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_WEBHOOK_UPDATED',
        targetType: 'Webhook',
        targetId: webhookId,
        metadata: req.body,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:webhookId - Delete webhook
router.delete('/:webhookId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { webhookId } = req.params as { webhookId: string };
    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) {
      return res.status(404).json({ success: false, message: 'Webhook not found' });
    }

    await prisma.webhook.delete({ where: { id: webhookId } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ADMIN_WEBHOOK_DELETED',
      targetType: 'Webhook',
      targetId: webhookId,
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
