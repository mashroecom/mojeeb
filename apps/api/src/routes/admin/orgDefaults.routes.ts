import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { configService } from '../../services/config.service';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

const ORG_DEFAULTS: Record<string, { value: string; label: string; description: string; isSecret: boolean }> = {
  DEFAULT_PLAN: { value: 'FREE', label: 'Default Plan', description: 'Default subscription plan for new organizations', isSecret: false },
  TRIAL_PERIOD_DAYS: { value: '14', label: 'Trial Period (Days)', description: 'Number of trial days for new organizations', isSecret: false },
  DEFAULT_TIMEZONE: { value: 'Asia/Riyadh', label: 'Default Timezone', description: 'Default timezone for new organizations', isSecret: false },
  DEFAULT_MESSAGES_LIMIT: { value: '100', label: 'Default Messages Limit', description: 'Default monthly message limit', isSecret: false },
  DEFAULT_AGENTS_LIMIT: { value: '1', label: 'Default Agents Limit', description: 'Default AI agents limit', isSecret: false },
  DEFAULT_CHANNELS_LIMIT: { value: '1', label: 'Default Channels Limit', description: 'Default channels limit', isSecret: false },
  DEFAULT_TEAM_MEMBERS_LIMIT: { value: '2', label: 'Default Team Members Limit', description: 'Default team members limit', isSecret: false },
  DEFAULT_KB_LIMIT: { value: '1', label: 'Default Knowledge Bases Limit', description: 'Default knowledge bases limit', isSecret: false },
  AUTO_CREATE_WEBCHAT_CHANNEL: { value: 'true', label: 'Auto-Create Webchat Channel', description: 'Automatically create a webchat channel for new organizations', isSecret: false },
  REQUIRE_EMAIL_VERIFICATION: { value: 'true', label: 'Require Email Verification', description: 'Require email verification for new users', isSecret: false },
};

async function ensureOrgDefaults() {
  const existing = await prisma.systemConfig.findMany({ where: { category: 'org_defaults' } });
  const existingKeys = new Set(existing.map((c) => c.key));

  const toCreate = Object.entries(ORG_DEFAULTS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, def]) => ({
      key,
      value: def.value,
      category: 'org_defaults',
      label: def.label,
      description: def.description,
      isSecret: def.isSecret,
    }));

  if (toCreate.length > 0) {
    await prisma.systemConfig.createMany({ data: toCreate });
  }
}

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureOrgDefaults();
    const configs = await prisma.systemConfig.findMany({
      where: { category: 'org_defaults' },
      orderBy: { key: 'asc' },
    });
    res.json({ success: true, data: configs });
  } catch (err) {
    next(err);
  }
});

const bulkUpdateSchema = z.object({
  settings: z.record(z.string()),
});

router.patch(
  '/',
  validate({ body: bulkUpdateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { settings } = req.body;

      for (const [key, value] of Object.entries(settings)) {
        if (key in ORG_DEFAULTS) {
          await configService.set(key, value as string);
        }
      }

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'UPDATE_ORG_DEFAULTS',
        targetType: 'SystemConfig',
        targetId: 'org_defaults',
        metadata: { keys: Object.keys(settings) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const configs = await prisma.systemConfig.findMany({
        where: { category: 'org_defaults' },
        orderBy: { key: 'asc' },
      });

      res.json({ success: true, data: configs });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
