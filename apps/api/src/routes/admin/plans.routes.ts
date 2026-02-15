import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';

const router: Router = Router();

const updatePlanSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  displayNameAr: z.string().max(50).optional(),
  monthlyPrice: z.number().min(0).optional(),
  yearlyPrice: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  messagesPerMonth: z.number().int().min(0).optional(),
  maxAgents: z.number().int().min(0).optional(),
  maxChannels: z.number().int().min(0).optional(),
  maxKnowledgeBases: z.number().int().min(0).optional(),
  maxTeamMembers: z.number().int().min(0).optional(),
  apiAccess: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  features: z.string().optional(),
  featuresAr: z.string().optional(),
});

// GET / - List all plans
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.planConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

// GET /:plan - Get single plan
router.get('/:plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.planConfig.findUnique({
      where: { plan: req.params.plan as any },
    });
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// PATCH /:plan - Update plan
router.patch(
  '/:plan',
  validate({ body: updatePlanSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.planConfig.findUnique({
        where: { plan: req.params.plan as any },
      });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Plan not found' });
      }

      // If setting isPopular=true, unset others first
      if (req.body.isPopular === true) {
        await prisma.planConfig.updateMany({
          where: { isPopular: true },
          data: { isPopular: false },
        });
      }

      const updated = await prisma.planConfig.update({
        where: { plan: req.params.plan as any },
        data: req.body,
      });

      auditLogService.log({
        userId: req.user!.userId,
        action: 'PLAN_CONFIG_UPDATED',
        targetType: 'PlanConfig',
        targetId: existing.id,
        metadata: { plan: req.params.plan, changes: req.body },
      }).catch(() => {});

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
