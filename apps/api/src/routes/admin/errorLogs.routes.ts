import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { errorLogService } from '../../services/errorLog.service';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  level: z.string().optional(),
  source: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

const cleanupSchema = z.object({
  olderThanDays: z.number().int().min(1).max(365),
});

// GET / — list with pagination + filters
router.get(
  '/',
  validate({ query: listQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, level, source, startDate, endDate, search } =
        // BUG FIX: validate middleware sets data on req.query, not validatedQuery
        req.query as any;

      const result = await errorLogService.list({
        page,
        limit,
        level,
        source,
        startDate,
        endDate,
        search,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — single error with full stack trace
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const log = await errorLogService.getById(id);

    if (!log) {
      return res.status(404).json({ success: false, error: 'Error log not found' });
    }

    res.json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
});

// DELETE /cleanup — delete old error logs
router.delete(
  '/cleanup',
  validate({ body: cleanupSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { olderThanDays } = req.body;
      const deletedCount = await errorLogService.cleanup(olderThanDays);

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ERROR_LOGS_CLEANUP',
        targetType: 'ErrorLog',
        targetId: 'bulk',
        metadata: { olderThanDays, deletedCount },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: { deletedCount } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
