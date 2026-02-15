import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { adminService } from '../../services/admin.service';

const router: Router = Router();

// GET /overview - Platform overview
router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.getPlatformOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /growth - Growth metrics
router.get('/growth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const groupBy = req.query.groupBy as string | undefined;

    const data = await adminService.getPlatformGrowth({ startDate, endDate, groupBy });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /revenue - Revenue analytics
router.get('/revenue', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.getRevenueAnalytics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /top-organizations - Top organizations by message count
router.get('/top-organizations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const data = await adminService.getTopOrganizations(limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /recent-activity - Recent platform activity
router.get('/recent-activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;
    const data = await adminService.getRecentActivity(limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /daily-revenue - Revenue over last 30 days
router.get('/daily-revenue', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.getDailyRevenue();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
