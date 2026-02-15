import { Router, Request, Response, NextFunction } from 'express';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// GET / - List audit log entries paginated
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const action = req.query.action as string | undefined;
    const targetType = req.query.targetType as string | undefined;
    const userId = req.query.userId as string | undefined;
    const targetId = req.query.targetId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await auditLogService.list({
      page,
      limit,
      action,
      targetType,
      userId,
      targetId,
      startDate,
      endDate,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
