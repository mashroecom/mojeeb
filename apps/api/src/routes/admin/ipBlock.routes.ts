import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { ipBlockService } from '../../services/ipBlock.service';
import { auditLogService } from '../../services/auditLog.service';
import { NotFoundError } from '../../utils/errors';

const router: Router = Router();

// Validation: IPv4 or IPv6
const blockIPSchema = z.object({
  ip: z.string().ip({ message: 'Must be a valid IPv4 or IPv6 address' }),
  reason: z.string().min(1, 'Reason is required'),
  expiresAt: z.string().datetime().optional(),
});

// GET / - List blocked IPs paginated
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = req.query.search as string | undefined;

    const result = await ipBlockService.list({ page, limit, search });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST / - Block an IP
router.post(
  '/',
  validate({ body: blockIPSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ip, reason, expiresAt } = req.body;

      const record = await ipBlockService.block({
        ip,
        reason,
        blockedBy: req.user!.userId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'IP_BLOCKED',
        targetType: 'BlockedIP',
        targetId: record.id,
        metadata: { ip, reason, expiresAt },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Unblock an IP
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const record = await ipBlockService.unblock(id);

    if (!record) {
      throw new NotFoundError('Blocked IP record not found');
    }

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'IP_UNBLOCKED',
      targetType: 'BlockedIP',
      targetId: id,
      metadata: { ip: record.ip },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export default router;
