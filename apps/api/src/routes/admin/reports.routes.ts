import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { pdfReportService } from '../../services/pdfReport.service';

const router: Router = Router();

// GET /platform-overview — download platform overview PDF
router.get('/platform-overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const buffer = await pdfReportService.generatePlatformOverview(startDate, endDate);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="platform-overview.pdf"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// GET /revenue — download revenue report PDF
router.get('/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const buffer = await pdfReportService.generateRevenueReport(startDate, endDate);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue-report.pdf"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// GET /user-growth — download user growth report PDF
router.get('/user-growth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const buffer = await pdfReportService.generateUserGrowthReport(startDate, endDate);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="user-growth.pdf"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// GET /subscriptions — download subscription report PDF
router.get('/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const buffer = await pdfReportService.generateSubscriptionReport(startDate, endDate);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="subscription-report.pdf"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
