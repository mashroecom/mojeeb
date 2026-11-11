import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { validate } from '../../middleware/validate';
import { auditLogService } from '../../services/auditLog.service';
import { BadRequestError } from '../../utils/errors';

const router: Router = Router();

// Optional text that the client may send as '' or null to clear it
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

// Only http(s) URLs or site-relative paths: the value ends up in an <img src>
const photoUrlSchema = nullableText(2000).refine(
  (v) => v == null || /^https?:\/\//i.test(v) || (v.startsWith('/') && !v.startsWith('//')),
  { message: 'photoUrl must be an http(s) URL or a site-relative path' },
);

const fields = {
  name: z.string().trim().min(1).max(200),
  nameAr: z.string().trim().max(200),
  role: z.string().trim().max(200),
  roleAr: z.string().trim().max(200),
  content: z.string().trim().min(1).max(5000),
  contentAr: z.string().trim().max(5000),
  photoUrl: photoUrlSchema,
  company: nullableText(200),
  rating: z.number().int().min(1).max(5),
  isActive: z.boolean(),
};

const createSchema = z.object({
  name: fields.name,
  nameAr: fields.nameAr.optional(),
  role: fields.role.optional(),
  roleAr: fields.roleAr.optional(),
  content: fields.content,
  contentAr: fields.contentAr.optional(),
  photoUrl: fields.photoUrl,
  company: fields.company,
  rating: fields.rating.optional(),
  isActive: fields.isActive.optional(),
});

const updateSchema = z
  .object({
    name: fields.name.optional(),
    nameAr: fields.nameAr.optional(),
    role: fields.role.optional(),
    roleAr: fields.roleAr.optional(),
    content: fields.content.optional(),
    contentAr: fields.contentAr.optional(),
    photoUrl: fields.photoUrl,
    company: fields.company,
    rating: fields.rating.optional(),
    isActive: fields.isActive.optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'No fields to update',
  });

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

const listOrder = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

// GET / - List all testimonials (active and inactive) in display order
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const testimonials = await prisma.testimonial.findMany({ orderBy: listOrder });
    res.json({ success: true, data: testimonials });
  } catch (err) {
    next(err);
  }
});

// POST / - Create testimonial (appended at the end of the list)
router.post(
  '/',
  validate({ body: createSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof createSchema>;

      const last = await prisma.testimonial.aggregate({ _max: { sortOrder: true } });
      const testimonial = await prisma.testimonial.create({
        data: {
          name: body.name,
          nameAr: body.nameAr ?? '',
          role: body.role ?? '',
          roleAr: body.roleAr ?? '',
          content: body.content,
          contentAr: body.contentAr ?? '',
          photoUrl: body.photoUrl ?? null,
          company: body.company ?? null,
          rating: body.rating ?? 5,
          isActive: body.isActive ?? true,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'TESTIMONIAL_CREATED',
        targetType: 'Testimonial',
        targetId: testimonial.id,
        metadata: { name: testimonial.name, company: testimonial.company },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ success: true, data: testimonial });
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

      const existing = await prisma.testimonial.findMany({
        orderBy: listOrder,
        select: { id: true },
      });
      const existingIds = new Set(existing.map((item) => item.id));
      const unknown = ids.filter((id) => !existingIds.has(id));
      if (unknown.length > 0) {
        throw new BadRequestError(`Unknown testimonial ids: ${unknown.join(', ')}`);
      }

      // Items not mentioned keep their relative order after the listed ones
      const listed = new Set(ids);
      const finalOrder = [
        ...ids,
        ...existing.map((item) => item.id).filter((id) => !listed.has(id)),
      ];

      await prisma.$transaction(
        finalOrder.map((id, index) =>
          prisma.testimonial.update({ where: { id }, data: { sortOrder: index } }),
        ),
      );

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'TESTIMONIAL_REORDERED',
        targetType: 'Testimonial',
        targetId: 'all',
        metadata: { ids: finalOrder },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const testimonials = await prisma.testimonial.findMany({ orderBy: listOrder });
      res.json({ success: true, data: testimonials });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id - Update testimonial
router.patch(
  '/:id',
  validate({ body: updateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as z.infer<typeof updateSchema>;

      const testimonial = await prisma.testimonial.update({ where: { id }, data: body });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'TESTIMONIAL_UPDATED',
        targetType: 'Testimonial',
        targetId: id,
        metadata: {
          fields: Object.keys(body).filter((k) => body[k as keyof typeof body] !== undefined),
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: testimonial });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Delete testimonial
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const testimonial = await prisma.testimonial.delete({ where: { id } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'TESTIMONIAL_DELETED',
      targetType: 'Testimonial',
      targetId: id,
      metadata: { name: testimonial.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export default router;
