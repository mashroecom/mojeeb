import type { Request, Response, NextFunction } from 'express';
import { configService } from '../../services/config.service';
import { createSettingsCategoryRouter } from './settingsCategoryRouter';
import { NOTIFICATION_DEFAULTS } from '../../services/systemSettings.service';

// Keys, seed defaults and accepted values live in systemSettings.service; the event
// toggles and the alert address are applied by adminNotificationService.notifyEvent.
const router = createSettingsCategoryRouter({
  category: 'notifications',
  defs: NOTIFICATION_DEFAULTS,
  auditAction: 'UPDATE_NOTIFICATION_SETTINGS',
});

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
      res
        .status(500)
        .json({ success: false, error: `Failed to send test email: ${emailErr.message}` });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
