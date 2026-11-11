import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { validate } from '../../middleware/validate';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// The LegalContent row id is the document type; it is the same id that
// GET /public/legal/:type reads, so both sides stay in sync.
const paramsSchema = z.object({
  type: z.enum(['privacy-policy', 'terms']),
});

const updateSchema = z.object({
  contentEn: z.string().max(200000),
  contentAr: z.string().max(200000),
});

// GET /:type - Get legal content (empty document if never saved)
router.get(
  '/:type',
  validate({ params: paramsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as z.infer<typeof paramsSchema>;

      const content = await prisma.legalContent.findUnique({ where: { id: type } });

      res.json({
        success: true,
        data: content ?? { id: type, contentEn: '', contentAr: '', updatedAt: null },
      });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:type - Create or replace legal content
router.put(
  '/:type',
  validate({ params: paramsSchema, body: updateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as z.infer<typeof paramsSchema>;
      const { contentEn, contentAr } = req.body as z.infer<typeof updateSchema>;

      const content = await prisma.legalContent.upsert({
        where: { id: type },
        update: { contentEn, contentAr },
        create: { id: type, contentEn, contentAr },
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'LEGAL_CONTENT_UPDATED',
        targetType: 'LegalContent',
        targetId: type,
        metadata: { contentEnLength: contentEn.length, contentArLength: contentAr.length },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: content });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
