import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// GET /api/v1/organizations/:orgId/tags
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.params.orgId as string;
    const tags = await prisma.tag.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { conversations: true } } },
    });
    res.json({ success: true, data: tags });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/tags
router.post(
  '/',
  validate({
    body: z.object({
      name: z.string().min(1).max(100).trim(),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.params.orgId as string;
      const { name, color } = req.body;

      const tag = await prisma.tag.create({
        data: { orgId, name, color: color || '#6366f1' },
      });
      res.status(201).json({ success: true, data: tag });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'Tag already exists' });
      }
      next(err);
    }
  },
);

// PATCH /api/v1/organizations/:orgId/tags/:tagId
router.patch(
  '/:tagId',
  validate({
    body: z
      .object({
        name: z.string().min(1).max(100).trim().optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
      .refine((d) => d.name || d.color, { message: 'name or color is required' }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.params.orgId as string;
      const tagId = req.params.tagId as string;
      const { name, color } = req.body;

      const tag = await prisma.tag.findFirst({ where: { id: tagId, orgId } });
      if (!tag) return res.status(404).json({ success: false, error: 'Tag not found' });

      const updated = await prisma.tag.update({
        where: { id: tagId },
        data: {
          ...(name && { name }),
          ...(color && { color }),
        },
      });
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'Tag name already exists' });
      }
      next(err);
    }
  },
);

// DELETE /api/v1/organizations/:orgId/tags/:tagId
router.delete('/:tagId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.params.orgId as string;
    const tagId = req.params.tagId as string;
    const tag = await prisma.tag.findFirst({ where: { id: tagId, orgId } });
    if (!tag) {
      return res.status(404).json({ success: false, error: 'Tag not found' });
    }
    await prisma.tag.delete({ where: { id: tagId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/tags/:tagId/conversations/:conversationId
router.post(
  '/:tagId/conversations/:conversationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.params.orgId as string;
      const tagId = req.params.tagId as string;
      const conversationId = req.params.conversationId as string;
      // Verify both tag and conversation belong to this org
      const [tag, conversation] = await Promise.all([
        prisma.tag.findFirst({ where: { id: tagId, orgId }, select: { id: true } }),
        prisma.conversation.findFirst({
          where: { id: conversationId, orgId },
          select: { id: true },
        }),
      ]);
      if (!tag) return res.status(404).json({ success: false, error: 'Tag not found' });
      if (!conversation)
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      const result = await prisma.conversationTag.create({
        data: { conversationId, tagId },
      });
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'Tag already applied' });
      }
      next(err);
    }
  },
);

// DELETE /api/v1/organizations/:orgId/tags/:tagId/conversations/:conversationId
router.delete(
  '/:tagId/conversations/:conversationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.params.orgId as string;
      const tagId = req.params.tagId as string;
      const conversationId = req.params.conversationId as string;
      // Verify both tag and conversation belong to this org
      const [tag, conversation] = await Promise.all([
        prisma.tag.findFirst({ where: { id: tagId, orgId }, select: { id: true } }),
        prisma.conversation.findFirst({
          where: { id: conversationId, orgId },
          select: { id: true },
        }),
      ]);
      if (!tag || !conversation)
        return res.status(404).json({ success: false, error: 'Not found' });
      await prisma.conversationTag.deleteMany({
        where: { conversationId, tagId },
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
