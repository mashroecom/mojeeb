import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';

interface TemplateParams { orgId: string; templateId: string; [key: string]: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// GET /api/v1/organizations/:orgId/message-templates
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params as unknown as TemplateParams;
    const templates = await prisma.messageTemplate.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/message-templates
router.post(
  '/',
  validate({
    body: z.object({
      title: z.string().min(1).max(200).trim(),
      content: z.string().min(1).max(5000).trim(),
      category: z.string().max(100).trim().optional(),
      shortcut: z.string().max(50).trim().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId } = req.params as unknown as TemplateParams;
      const { title, content, category, shortcut } = req.body;

      const template = await prisma.messageTemplate.create({
        data: {
          orgId,
          title,
          content,
          category: category || null,
          shortcut: shortcut || null,
          createdBy: (req as any).user.userId,
        },
      });
      res.status(201).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/organizations/:orgId/message-templates/:templateId
router.patch(
  '/:templateId',
  validate({
    body: z.object({
      title: z.string().min(1).max(200).trim().optional(),
      content: z.string().min(1).max(5000).trim().optional(),
      category: z.string().max(100).trim().optional(),
      shortcut: z.string().max(50).trim().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId, templateId } = req.params as unknown as TemplateParams;
      const { title, content, category, shortcut } = req.body;

      const template = await prisma.messageTemplate.findFirst({
        where: { id: templateId, orgId },
      });
      if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

      const updated = await prisma.messageTemplate.update({
        where: { id: templateId },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(category !== undefined && { category: category || null }),
          ...(shortcut !== undefined && { shortcut: shortcut || null }),
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

export default router;
