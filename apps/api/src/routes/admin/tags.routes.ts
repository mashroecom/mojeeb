import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// GET / - List all tags with pagination, search, usage count
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || undefined;

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { conversations: true } },
        },
      }),
      prisma.tag.count({ where }),
    ]);

    // Resolve org names
    const orgIds = [...new Set(items.map((t) => t.orgId))];
    const orgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

    const data = items.map((tag) => ({
      ...tag,
      orgName: orgMap[tag.orgId] || '—',
      usageCount: tag._count.conversations,
    }));

    res.json({
      success: true,
      data: {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete tag (cascade deletes conversationTag entries)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.tag.delete({ where: { id } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'TAG_DELETED',
      targetType: 'Tag',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export default router;
