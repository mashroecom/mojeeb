import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { validate } from '../../middleware/validate';
import { auditLogService } from '../../services/auditLog.service';
import { BadRequestError } from '../../utils/errors';

const router: Router = Router();

const createSchema = z.object({
  question: z.string().trim().min(1).max(500),
  questionAr: z.string().trim().max(500).optional(),
  answer: z.string().trim().min(1).max(10000),
  answerAr: z.string().trim().max(10000).optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = z
  .object({
    question: z.string().trim().min(1).max(500).optional(),
    questionAr: z.string().trim().max(500).optional(),
    answer: z.string().trim().min(1).max(10000).optional(),
    answerAr: z.string().trim().max(10000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' });

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

const listOrder = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

// GET / - List all FAQs (active and inactive) in display order
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const faqs = await prisma.fAQ.findMany({ orderBy: listOrder });
    res.json({ success: true, data: faqs });
  } catch (err) {
    next(err);
  }
});

// POST / - Create FAQ (appended at the end of the list)
router.post(
  '/',
  validate({ body: createSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof createSchema>;

      const last = await prisma.fAQ.aggregate({ _max: { sortOrder: true } });
      const faq = await prisma.fAQ.create({
        data: {
          question: body.question,
          questionAr: body.questionAr ?? '',
          answer: body.answer,
          answerAr: body.answerAr ?? '',
          isActive: body.isActive ?? true,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'FAQ_CREATED',
        targetType: 'FAQ',
        targetId: faq.id,
        metadata: { question: faq.question },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ success: true, data: faq });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /reorder - Persist a new display order ({ ids } in the desired order)
router.put(
  '/reorder',
  validate({ body: reorderSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids } = req.body as z.infer<typeof reorderSchema>;

      if (new Set(ids).size !== ids.length) {
        throw new BadRequestError('ids must be unique');
      }

      const existing = await prisma.fAQ.findMany({ orderBy: listOrder, select: { id: true } });
      const existingIds = new Set(existing.map((f) => f.id));
      const unknown = ids.filter((id) => !existingIds.has(id));
      if (unknown.length > 0) {
        throw new BadRequestError(`Unknown FAQ ids: ${unknown.join(', ')}`);
      }

      // Items not mentioned keep their relative order after the listed ones
      const listed = new Set(ids);
      const finalOrder = [...ids, ...existing.map((f) => f.id).filter((id) => !listed.has(id))];

      await prisma.$transaction(
        finalOrder.map((id, index) =>
          prisma.fAQ.update({ where: { id }, data: { sortOrder: index } }),
        ),
      );

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'FAQ_REORDERED',
        targetType: 'FAQ',
        targetId: 'all',
        metadata: { ids: finalOrder },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const faqs = await prisma.fAQ.findMany({ orderBy: listOrder });
      res.json({ success: true, data: faqs });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id - Update FAQ
router.patch(
  '/:id',
  validate({ body: updateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as z.infer<typeof updateSchema>;

      const faq = await prisma.fAQ.update({ where: { id }, data: body });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'FAQ_UPDATED',
        targetType: 'FAQ',
        targetId: id,
        metadata: { fields: Object.keys(body) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: faq });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Delete FAQ
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const faq = await prisma.fAQ.delete({ where: { id } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'FAQ_DELETED',
      targetType: 'FAQ',
      targetId: id,
      metadata: { question: faq.question },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export default router;
