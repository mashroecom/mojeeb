import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { configService } from '../../services/config.service';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// Default security settings to seed if they don't exist
const SECURITY_DEFAULTS: Record<string, { value: string; label: string; description: string; isSecret: boolean }> = {
  MIN_PASSWORD_LENGTH: { value: '8', label: 'Minimum Password Length', description: 'Minimum number of characters required for passwords', isSecret: false },
  REQUIRE_UPPERCASE: { value: 'true', label: 'Require Uppercase', description: 'Require at least one uppercase letter', isSecret: false },
  REQUIRE_NUMBERS: { value: 'true', label: 'Require Numbers', description: 'Require at least one number', isSecret: false },
  REQUIRE_SPECIAL_CHARS: { value: 'false', label: 'Require Special Characters', description: 'Require at least one special character', isSecret: false },
  PASSWORD_EXPIRY_DAYS: { value: '0', label: 'Password Expiry (Days)', description: 'Days before password expires (0 = never)', isSecret: false },
  SESSION_TIMEOUT_MINUTES: { value: '1440', label: 'Session Timeout (Minutes)', description: 'Session timeout in minutes (1440 = 24 hours)', isSecret: false },
  MAX_SESSIONS_PER_USER: { value: '5', label: 'Max Sessions Per User', description: 'Maximum concurrent sessions allowed per user', isSecret: false },
  MAX_LOGIN_ATTEMPTS: { value: '10', label: 'Max Login Attempts', description: 'Maximum failed login attempts before lockout', isSecret: false },
  LOCKOUT_DURATION_MINUTES: { value: '30', label: 'Lockout Duration (Minutes)', description: 'Account lockout duration after max failed attempts', isSecret: false },
  ENABLE_2FA: { value: 'false', label: 'Enable Two-Factor Auth', description: 'Allow users to enable 2FA', isSecret: false },
  ENFORCE_2FA_FOR_ADMINS: { value: 'false', label: 'Enforce 2FA for Admins', description: 'Require 2FA for all admin users', isSecret: false },
};

// Ensure all security config keys exist
async function ensureSecurityDefaults() {
  const existing = await prisma.systemConfig.findMany({ where: { category: 'security' } });
  const existingKeys = new Set(existing.map((c) => c.key));

  const toCreate = Object.entries(SECURITY_DEFAULTS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, def]) => ({
      key,
      value: def.value,
      category: 'security',
      label: def.label,
      description: def.description,
      isSecret: def.isSecret,
    }));

  if (toCreate.length > 0) {
    await prisma.systemConfig.createMany({ data: toCreate });
  }
}

// GET / — list all security settings
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureSecurityDefaults();
    const configs = await prisma.systemConfig.findMany({
      where: { category: 'security' },
      orderBy: { key: 'asc' },
    });
    res.json({ success: true, data: configs });
  } catch (err) {
    next(err);
  }
});

// PATCH / — bulk update security settings
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
        if (key in SECURITY_DEFAULTS) {
          await configService.set(key, value as string);
        }
      }

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'UPDATE_SECURITY_SETTINGS',
        targetType: 'SystemConfig',
        targetId: 'security',
        metadata: { keys: Object.keys(settings) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const configs = await prisma.systemConfig.findMany({
        where: { category: 'security' },
        orderBy: { key: 'asc' },
      });

      res.json({ success: true, data: configs });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
