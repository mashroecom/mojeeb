import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { configService } from '../../services/config.service';
import { auditLogService } from '../../services/auditLog.service';
import { validateSettingValue, type SettingDef } from '../../services/systemSettings.service';

const bulkUpdateSchema = z.object({
  settings: z.record(z.string().max(500)),
});

/**
 * Builds the GET / + PATCH / pair shared by the admin "security", "notifications" and
 * "org_defaults" settings pages. Every row is returned with `enforced` so the UI can tell
 * the admin which settings the backend actually acts on.
 */
export function createSettingsCategoryRouter(opts: {
  category: string;
  defs: Record<string, SettingDef>;
  auditAction: string;
}): Router {
  const { category, defs, auditAction } = opts;
  const router: Router = Router();

  // Ensure all config keys of this category exist
  async function ensureDefaults() {
    const existing = await prisma.systemConfig.findMany({
      where: { key: { in: Object.keys(defs) } },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((c) => c.key));

    const toCreate = Object.entries(defs)
      .filter(([key]) => !existingKeys.has(key))
      .map(([key, def]) => ({
        key,
        value: def.value,
        category,
        label: def.label,
        description: def.description,
        isSecret: def.isSecret,
      }));

    if (toCreate.length > 0) {
      await prisma.systemConfig.createMany({ data: toCreate, skipDuplicates: true });
    }
  }

  async function list() {
    const configs = await prisma.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
    return configs.map((c) => ({ ...c, enforced: defs[c.key]?.enforced ?? false }));
  }

  // GET / — list all settings of the category
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureDefaults();
      res.json({ success: true, data: await list() });
    } catch (err) {
      next(err);
    }
  });

  // PATCH / — bulk update
  router.patch(
    '/',
    validate({ body: bulkUpdateSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const settings = req.body.settings as Record<string, string>;

        // Unknown keys are ignored (as before); known keys must carry a valid value.
        const updates: [string, string][] = [];
        const fieldErrors: Record<string, string[]> = {};
        for (const [key, raw] of Object.entries(settings)) {
          const def = defs[key];
          if (!def) continue;
          const problem = validateSettingValue(def, raw);
          if (problem) fieldErrors[key] = [`${key} ${problem}`];
          else updates.push([key, raw.trim()]);
        }

        if (Object.keys(fieldErrors).length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: { body: { formErrors: [], fieldErrors } },
          });
        }

        await ensureDefaults();
        for (const [key, value] of updates) {
          await configService.set(key, value);
        }

        await auditLogService.log({
          userId: req.user!.userId,
          action: auditAction,
          targetType: 'SystemConfig',
          targetId: category,
          metadata: { keys: Object.keys(settings) },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.json({ success: true, data: await list() });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
