import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { featureFlagService } from '../../services/featureFlag.service';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

const createFlagSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .regex(
      /^[a-z][a-z0-9_]*$/,
      'Key must start with a lowercase letter and contain only lowercase letters, digits, and underscores',
    ),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
});

const updateFlagSchema = z.object({
  enabled: z.boolean().optional(),
  description: z.string().optional(),
  metadata: z
    .object({
      rolloutPercentage: z.number().min(0).max(100).optional(),
      targetOrgs: z.array(z.string()).optional(),
      targetUsers: z.array(z.string()).optional(),
    })
    .optional(),
});

// GET / - List all feature flags
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const flags = await featureFlagService.getAll();
    res.json({ success: true, data: flags });
  } catch (err) {
    next(err);
  }
});

// POST / - Create a feature flag
router.post(
  '/',
  validate({ body: createFlagSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key, description, enabled } = req.body;

      const flag = await featureFlagService.create({ key, description, enabled });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'FEATURE_FLAG_CREATED',
        targetType: 'FeatureFlag',
        targetId: flag.id,
        metadata: { key, enabled: flag.enabled },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ success: true, data: flag });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:key - Update a feature flag
router.patch(
  '/:key',
  validate({ body: updateFlagSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params as { key: string };
      const { enabled, description, metadata } = req.body;

      const flag = await featureFlagService.update(key, { enabled, description, metadata });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'FEATURE_FLAG_UPDATED',
        targetType: 'FeatureFlag',
        targetId: flag.id,
        metadata: { key, enabled: flag.enabled, description: flag.description },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: flag });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:key - Delete a feature flag
router.delete('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params as { key: string };

    const flag = await featureFlagService.delete(key);

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'FEATURE_FLAG_DELETED',
      targetType: 'FeatureFlag',
      targetId: flag.id,
      metadata: { key },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: { key } });
  } catch (err) {
    next(err);
  }
});

export default router;
