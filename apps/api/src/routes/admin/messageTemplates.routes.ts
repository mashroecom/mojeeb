import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';

const router: Router = Router();

// GET / - List all templates with pagination, search, category filter
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || undefined;
    const category = (req.query.category as string) || undefined;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.messageTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          org: { select: { name: true } },
        },
      }),
      prisma.messageTemplate.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        data: items,
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

// GET /analytics - Template usage analytics
router.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalTemplates,
      activeTemplates,
      categoryStats,
      mostUsedTemplates,
      sharedTemplates,
    ] = await Promise.all([
      prisma.messageTemplate.count(),
      prisma.messageTemplate.count({ where: { isActive: true } }),
      prisma.messageTemplate.groupBy({
        by: ['category'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.messageTemplate.findMany({
        orderBy: { usageCount: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          category: true,
          usageCount: true,
          org: { select: { name: true } },
        },
      }),
      prisma.messageTemplate.count({ where: { isShared: true } }),
    ]);

    const data = {
      totalTemplates,
      activeTemplates,
      inactiveTemplates: totalTemplates - activeTemplates,
      sharedTemplates,
      categoryStats: categoryStats.map((stat) => ({
        category: stat.category || 'Uncategorized',
        count: stat._count.id,
      })),
      mostUsedTemplates,
    };

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get template detail
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const template = await prisma.messageTemplate.findUnique({
      where: { id },
      include: { org: { select: { name: true } } },
    });

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// Validation schemas
const createTemplateSchema = z.object({
  orgId: z.string().min(1),
  title: z.string().min(1).max(200),
  titleAr: z.string().max(200).optional(),
  content: z.string().min(1),
  contentAr: z.string().optional(),
  category: z.string().max(100).optional(),
  shortcut: z.string().max(50).optional(),
  variables: z.array(z.string()).optional(),
  isShared: z.boolean().optional(),
  userId: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleAr: z.string().max(200).optional(),
  content: z.string().min(1).optional(),
  contentAr: z.string().optional(),
  category: z.string().max(100).optional(),
  shortcut: z.string().max(50).optional(),
  variables: z.array(z.string()).optional(),
  isShared: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// POST / - Create new template
router.post(
  '/',
  validate({ body: createTemplateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await prisma.messageTemplate.create({
        data: req.body,
        include: { org: { select: { name: true } } },
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'MESSAGE_TEMPLATE_CREATED',
        targetType: 'MessageTemplate',
        targetId: template.id,
        metadata: req.body,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /:id - Update template
router.patch(
  '/:id',
  validate({ body: updateTemplateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const template = await prisma.messageTemplate.findUnique({ where: { id } });
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      const updated = await prisma.messageTemplate.update({
        where: { id },
        data: req.body,
        include: { org: { select: { name: true } } },
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'MESSAGE_TEMPLATE_UPDATED',
        targetType: 'MessageTemplate',
        targetId: id,
        metadata: req.body,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:id - Delete template
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.messageTemplate.delete({ where: { id } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'MESSAGE_TEMPLATE_DELETED',
      targetType: 'MessageTemplate',
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
