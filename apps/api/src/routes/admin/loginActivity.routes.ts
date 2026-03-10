import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { loginActivityService } from '../../services/loginActivity.service';

const router: Router = Router();

// GET / - List login activity paginated with filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const userId = req.query.userId as string | undefined;
    const email = req.query.email as string | undefined;
    const ipAddress = req.query.ipAddress as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    let success: boolean | undefined;
    if (req.query.success === 'true') success = true;
    else if (req.query.success === 'false') success = false;

    const result = await loginActivityService.list({
      page,
      limit,
      userId,
      email,
      success,
      ipAddress,
      startDate,
      endDate,
    });

    const mapped = {
      ...result,
      items: result.items.map((item: any) => ({
        id: item.id,
        email: item.email,
        userName: item.user
          ? `${item.user.firstName ?? ''} ${item.user.lastName ?? ''}`.trim()
          : undefined,
        success: item.success,
        ip: item.ipAddress ?? '',
        userAgent: item.userAgent ?? '',
        createdAt: item.createdAt,
      })),
    };

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Today's login stats summary
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await loginActivityService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

export default router;
