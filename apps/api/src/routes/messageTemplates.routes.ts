import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';

interface OrgParams {
  orgId: string;
  [key: string]: string;
}
interface TemplateParams {
  orgId: string;
  templateId: string;
  [key: string]: string;
}

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

const CATEGORIES = ['greeting', 'closing', 'support', 'sales', 'billing', 'general'] as const;

const variableSchema = z.object({
  key: z.string().min(1),
  labelEn: z.string().min(1),
  labelAr: z.string().optional().default(''),
});

const autoTriggerSchema = z.object({
  enabled: z.boolean().default(false),
  keywords: z.array(z.string()).default([]),
});

const createSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  contentEn: z.string().min(1).max(5000).trim(),
  contentAr: z.string().max(5000).trim().optional().default(''),
  shortcut: z.string().max(50).trim().optional().nullable(),
  category: z.enum(CATEGORIES).default('general'),
  variables: z.array(variableSchema).optional().default([]),
  agentId: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  autoTrigger: autoTriggerSchema.optional().default({ enabled: false, keywords: [] }),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  contentEn: z.string().min(1).max(5000).trim().optional(),
  contentAr: z.string().max(5000).trim().optional(),
  shortcut: z.string().max(50).trim().optional().nullable(),
  category: z.enum(CATEGORIES).optional(),
  variables: z.array(variableSchema).optional(),
  agentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  autoTrigger: autoTriggerSchema.optional(),
});

// GET /api/v1/organizations/:orgId/message-templates
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params as unknown as OrgParams;
    const { category, search, agentId } = req.query;

    const where: any = { orgId };

    if (category && typeof category === 'string') {
      where.category = category;
    }

    if (agentId && typeof agentId === 'string') {
      where.OR = [{ agentId }, { agentId: null }];
    }

    if (search && typeof search === 'string') {
      const searchFilter = {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { contentEn: { contains: search, mode: 'insensitive' as const } },
          { contentAr: { contains: search, mode: 'insensitive' as const } },
          { shortcut: { contains: search, mode: 'insensitive' as const } },
        ],
      };
      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchFilter];
        delete where.OR;
      } else {
        where.AND = [searchFilter];
      }
    }

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/message-templates/shortcut/:shortcut
router.get('/shortcut/:shortcut', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params as unknown as OrgParams;
    const shortcut = req.params.shortcut as string;

    const template = await prisma.messageTemplate.findFirst({
      where: { orgId, shortcut, isActive: true },
    });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/message-templates/:templateId
router.get('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, templateId } = req.params as unknown as TemplateParams;
    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/message-templates
router.post(
  '/',
  validate({ body: createSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params as unknown as OrgParams;
      const {
        title,
        contentEn,
        contentAr,
        shortcut,
        category,
        variables,
        agentId,
        isActive,
        autoTrigger,
      } = req.body;

      // Check shortcut uniqueness within org
      if (shortcut) {
        const existing = await prisma.messageTemplate.findFirst({
          where: { orgId, shortcut },
        });
        if (existing) {
          return res.status(409).json({ success: false, error: 'Shortcut already exists' });
        }
      }

      const template = await prisma.messageTemplate.create({
        data: {
          orgId,
          title,
          contentEn,
          contentAr: contentAr || '',
          shortcut: shortcut || null,
          category,
          variables: variables || [],
          agentId: agentId || null,
          isActive: isActive !== undefined ? isActive : true,
          autoTrigger: autoTrigger || { enabled: false, keywords: [] },
          createdBy: (req as any).user.userId,
        },
      });
      res.status(201).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/organizations/:orgId/message-templates/:templateId
router.put(
  '/:templateId',
  validate({ body: updateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId, templateId } = req.params as unknown as TemplateParams;
      const {
        title,
        contentEn,
        contentAr,
        shortcut,
        category,
        variables,
        agentId,
        isActive,
        autoTrigger,
      } = req.body;

      const template = await prisma.messageTemplate.findFirst({
        where: { id: templateId, orgId },
      });
      if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

      // Check shortcut uniqueness if changed
      if (shortcut !== undefined && shortcut !== null && shortcut !== template.shortcut) {
        const existing = await prisma.messageTemplate.findFirst({
          where: { orgId, shortcut, id: { not: templateId } },
        });
        if (existing) {
          return res.status(409).json({ success: false, error: 'Shortcut already exists' });
        }
      }

      const updated = await prisma.messageTemplate.update({
        where: { id: templateId },
        data: {
          ...(title !== undefined && { title }),
          ...(contentEn !== undefined && { contentEn }),
          ...(contentAr !== undefined && { contentAr }),
          ...(shortcut !== undefined && { shortcut: shortcut || null }),
          ...(category !== undefined && { category }),
          ...(variables !== undefined && { variables }),
          ...(agentId !== undefined && { agentId: agentId || null }),
          ...(isActive !== undefined && { isActive }),
          ...(autoTrigger !== undefined && { autoTrigger }),
        },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// Also support PATCH for partial updates
router.patch(
  '/:templateId',
  validate({ body: updateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId, templateId } = req.params as unknown as TemplateParams;
      const {
        title,
        contentEn,
        contentAr,
        shortcut,
        category,
        variables,
        agentId,
        isActive,
        autoTrigger,
      } = req.body;

      const template = await prisma.messageTemplate.findFirst({
        where: { id: templateId, orgId },
      });
      if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

      if (shortcut !== undefined && shortcut !== null && shortcut !== template.shortcut) {
        const existing = await prisma.messageTemplate.findFirst({
          where: { orgId, shortcut, id: { not: templateId } },
        });
        if (existing) {
          return res.status(409).json({ success: false, error: 'Shortcut already exists' });
        }
      }

      const updated = await prisma.messageTemplate.update({
        where: { id: templateId },
        data: {
          ...(title !== undefined && { title }),
          ...(contentEn !== undefined && { contentEn }),
          ...(contentAr !== undefined && { contentAr }),
          ...(shortcut !== undefined && { shortcut: shortcut || null }),
          ...(category !== undefined && { category }),
          ...(variables !== undefined && { variables }),
          ...(agentId !== undefined && { agentId: agentId || null }),
          ...(isActive !== undefined && { isActive }),
          ...(autoTrigger !== undefined && { autoTrigger }),
        },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/organizations/:orgId/message-templates/:templateId
router.delete('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, templateId } = req.params as unknown as TemplateParams;
    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

    await prisma.messageTemplate.delete({ where: { id: templateId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/message-templates/:templateId/use
router.post('/:templateId/use', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, templateId } = req.params as unknown as TemplateParams;
    const { variables: varValues } = req.body || {};

    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

    // Increment usage count
    await prisma.messageTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    // Replace variables in content
    let contentEn = template.contentEn;
    let contentAr = template.contentAr;

    if (varValues && typeof varValues === 'object') {
      for (const [key, value] of Object.entries(varValues)) {
        const placeholder = `{{${key}}}`;
        contentEn = contentEn.replace(
          new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
          String(value),
        );
        contentAr = contentAr.replace(
          new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
          String(value),
        );
      }
    }

    res.json({
      success: true,
      data: {
        ...template,
        usageCount: template.usageCount + 1,
        contentEn,
        contentAr,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
