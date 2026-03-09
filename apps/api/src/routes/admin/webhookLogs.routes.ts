import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';

const router: Router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  webhookId: z.string().optional(),
  event: z.string().optional(),
  success: z.enum(['true', 'false']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

// GET / — list webhook logs paginated with filters
router.get(
  '/',
  validate({ query: listQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, webhookId, event, success, startDate, endDate, search } =
        // BUG FIX: validate middleware sets data on req.query, not validatedQuery
        req.query as any;

      const where: Record<string, unknown> = {};

      if (webhookId) where.webhookId = webhookId;
      if (event) where.event = event;
      if (success !== undefined) where.success = success === 'true';
      if (search) {
        where.webhook = { url: { contains: search, mode: 'insensitive' } };
      }
      if (startDate || endDate) {
        where.createdAt = {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate ? { lte: new Date(endDate) } : {}),
        };
      }

      const [logs, total] = await Promise.all([
        prisma.webhookLog.findMany({
          where,
          select: {
            id: true,
            webhookId: true,
            webhook: {
              select: { url: true },
            },
            event: true,
            status: true,
            duration: true,
            attempt: true,
            error: true,
            success: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.webhookLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: { logs, total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /stats — aggregated stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalDeliveries, successCount, durationAgg, failuresByWebhook] = await Promise.all([
      prisma.webhookLog.count(),
      prisma.webhookLog.count({ where: { success: true } }),
      prisma.webhookLog.aggregate({
        _avg: { duration: true },
      }),
      prisma.webhookLog.groupBy({
        by: ['webhookId'],
        where: { success: false },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    // Get webhook URLs for failure stats
    const webhookIds = failuresByWebhook.map((f) => f.webhookId);
    const webhooks = webhookIds.length
      ? await prisma.webhook.findMany({
          where: { id: { in: webhookIds } },
          select: { id: true, url: true },
        })
      : [];

    const webhookMap = Object.fromEntries(webhooks.map((w) => [w.id, w.url]));

    const totalFailures = totalDeliveries - successCount;
    const successRate = totalDeliveries > 0 ? ((successCount / totalDeliveries) * 100).toFixed(1) : '0';
    const avgDuration = Math.round(durationAgg._avg.duration ?? 0);

    res.json({
      success: true,
      data: {
        totalDeliveries,
        successRate: Number(successRate),
        avgDuration,
        totalFailures,
        failuresByWebhook: failuresByWebhook.map((f) => ({
          webhookId: f.webhookId,
          url: webhookMap[f.webhookId] ?? 'Unknown',
          failures: f._count.id,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /:id — single log detail
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };

    const log = await prisma.webhookLog.findUnique({
      where: { id },
      include: {
        webhook: {
          select: { url: true, events: true },
        },
      },
    });

    if (!log) {
      return res.status(404).json({ success: false, error: 'Webhook log not found' });
    }

    res.json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
});

export default router;
