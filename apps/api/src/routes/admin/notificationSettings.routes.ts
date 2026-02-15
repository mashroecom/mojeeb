import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { configService } from '../../services/config.service';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

const NOTIFICATION_DEFAULTS: Record<string, { value: string; label: string; description: string; isSecret: boolean }> = {
  ENABLE_EMAIL_NOTIFICATIONS: { value: 'true', label: 'Enable Email Notifications', description: 'Master switch for email notifications', isSecret: false },
  ADMIN_ALERT_EMAIL: { value: '', label: 'Admin Alert Email', description: 'Email address for admin alerts (leave empty for no alerts)', isSecret: false },
  NOTIFY_NEW_USER_SIGNUP: { value: 'true', label: 'New User Signup', description: 'Send notification when a new user registers', isSecret: false },
  NOTIFY_NEW_ORG_CREATED: { value: 'true', label: 'New Organization', description: 'Send notification when a new organization is created', isSecret: false },
  NOTIFY_FAILED_PAYMENT: { value: 'true', label: 'Failed Payment', description: 'Send notification on payment failures', isSecret: false },
  NOTIFY_SYSTEM_ERRORS: { value: 'true', label: 'System Errors', description: 'Send notification on critical system errors', isSecret: false },
  NOTIFY_NEW_CONTACT_MESSAGE: { value: 'true', label: 'New Contact Message', description: 'Send notification for new contact form submissions', isSecret: false },
  NOTIFY_NEW_DEMO_REQUEST: { value: 'true', label: 'New Demo Request', description: 'Send notification for new demo requests', isSecret: false },
  ERROR_DIGEST_INTERVAL_HOURS: { value: '24', label: 'Error Digest Interval (Hours)', description: 'Send error digest every N hours', isSecret: false },
  DAILY_SUMMARY_EMAIL: { value: 'false', label: 'Daily Summary Email', description: 'Send daily platform summary email to admin', isSecret: false },
};

async function ensureNotificationDefaults() {
  const existing = await prisma.systemConfig.findMany({ where: { category: 'notifications' } });
  const existingKeys = new Set(existing.map((c) => c.key));

  const toCreate = Object.entries(NOTIFICATION_DEFAULTS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, def]) => ({
      key,
      value: def.value,
      category: 'notifications',
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
    await ensureNotificationDefaults();
    const configs = await prisma.systemConfig.findMany({
      where: { category: 'notifications' },
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
        if (key in NOTIFICATION_DEFAULTS) {
          await configService.set(key, value as string);
        }
      }

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'UPDATE_NOTIFICATION_SETTINGS',
        targetType: 'SystemConfig',
        targetId: 'notifications',
        metadata: { keys: Object.keys(settings) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const configs = await prisma.systemConfig.findMany({
        where: { category: 'notifications' },
        orderBy: { key: 'asc' },
      });

      res.json({ success: true, data: configs });
    } catch (err) {
      next(err);
    }
  },
);

// POST /test-email — send test notification email
router.post('/test-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminEmail = await configService.get('ADMIN_ALERT_EMAIL');
    if (!adminEmail) {
      return res.status(400).json({ success: false, error: 'Admin alert email not configured' });
    }

    // Try to send test email
    try {
      const { emailService } = await import('../../services/email.service');
      await emailService.sendCustomEmail(
        adminEmail,
        'Test Notification - Mojeeb Admin',
        'This is a test notification from your Mojeeb admin panel. If you received this, your notification email is configured correctly.',
      );
      res.json({ success: true, message: 'Test email sent successfully' });
    } catch (emailErr: any) {
      res.status(500).json({ success: false, error: `Failed to send test email: ${emailErr.message}` });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
