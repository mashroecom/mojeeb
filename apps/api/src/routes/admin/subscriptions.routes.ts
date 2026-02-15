import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { adminService } from '../../services/admin.service';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// GET / - List subscriptions with pagination
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const plan = req.query.plan as string | undefined;
    const status = req.query.status as string | undefined;

    const data = await adminService.listSubscriptions({ page, limit, plan, status });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /:subscriptionId - Subscription detail with invoices
router.get('/:subscriptionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subscriptionId } = req.params as { subscriptionId: string };
    const data = await adminService.getSubscriptionDetail(subscriptionId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /:subscriptionId - Update subscription limits
router.patch('/:subscriptionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subscriptionId } = req.params as { subscriptionId: string };
    const data = await adminService.updateSubscription(subscriptionId, req.body);

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'SUBSCRIPTION_UPDATED',
      targetType: 'Subscription',
      targetId: subscriptionId,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
