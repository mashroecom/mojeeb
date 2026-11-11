import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { auditLogService } from '../../services/auditLog.service';
import {
  backupPayloadSchema,
  systemBackupService,
  type BackupPayload,
} from '../../services/systemBackup.service';

const router: Router = Router();

// GET /export - Export admin-managed configuration as a portable JSON document.
// Secret config values are never included (see systemBackup.service).
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backup = await systemBackupService.exportConfig();

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'SYSTEM_CONFIG_EXPORTED',
      targetType: 'SystemBackup',
      targetId: backup.checksum,
      metadata: {
        sections: Object.fromEntries(
          Object.entries(backup.data).map(([name, value]) => [
            name,
            Array.isArray(value) ? value.length : value ? 1 : 0,
          ]),
        ),
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: backup });
  } catch (err) {
    next(err);
  }
});

// POST /import - Apply a previously exported configuration document.
// The body is the exported document itself; it is schema-validated, checksum-verified and
// applied in a single transaction together with its audit log entry.
router.post(
  '/import',
  validate({ body: backupPayloadSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await systemBackupService.importConfig(req.body as BackupPayload, {
        userId: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
