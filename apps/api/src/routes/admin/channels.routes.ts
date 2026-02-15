import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';

const router: Router = Router();

// GET / - List all channels
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const orgId = req.query.orgId as string | undefined;
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;

    const where: any = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (orgId) where.orgId = orgId;
    if (type) where.type = type;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const [channels, total] = await Promise.all([
      prisma.channel.findMany({
        where,
        include: {
          org: { select: { id: true, name: true } },
          agents: {
            include: { agent: { select: { id: true, name: true } } },
          },
          _count: { select: { conversations: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.channel.count({ where }),
    ]);

    res.json({
      success: true,
      data: { channels, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Channel statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, active, inactive, byType] = await Promise.all([
      prisma.channel.count(),
      prisma.channel.count({ where: { isActive: true } }),
      prisma.channel.count({ where: { isActive: false } }),
      prisma.channel.groupBy({ by: ['type'], _count: true }),
    ]);

    res.json({ success: true, data: { total, active, inactive, byType } });
  } catch (err) {
    next(err);
  }
});

// GET /:channelId - Channel detail
router.get('/:channelId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channelId } = req.params as { channelId: string };
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        org: { select: { id: true, name: true, slug: true } },
        agents: {
          include: { agent: { select: { id: true, name: true, isActive: true } } },
        },
        _count: { select: { conversations: true } },
      },
    });

    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    res.json({ success: true, data: channel });
  } catch (err) {
    next(err);
  }
});

const updateChannelSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
});

// PATCH /:channelId - Toggle channel active status
router.patch(
  '/:channelId',
  validate({ body: updateChannelSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId } = req.params as { channelId: string };
      const channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) {
        return res.status(404).json({ success: false, message: 'Channel not found' });
      }

      const updated = await prisma.channel.update({
        where: { id: channelId },
        data: req.body,
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_CHANNEL_UPDATED',
        targetType: 'Channel',
        targetId: channelId,
        metadata: req.body,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:channelId - Delete channel
router.delete('/:channelId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channelId } = req.params as { channelId: string };
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    await prisma.channel.delete({ where: { id: channelId } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ADMIN_CHANNEL_DELETED',
      targetType: 'Channel',
      targetId: channelId,
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
