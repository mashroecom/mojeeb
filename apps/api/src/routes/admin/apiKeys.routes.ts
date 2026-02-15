import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// GET / - List all API keys
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const orgId = req.query.orgId as string | undefined;
    const status = req.query.status as string | undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { keyPrefix: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (orgId) where.orgId = orgId;
    if (status === 'active') where.revokedAt = null;
    if (status === 'revoked') where.revokedAt = { not: null };

    const [apiKeys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          expiresAt: true,
          lastUsedAt: true,
          revokedAt: true,
          createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          org: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.apiKey.count({ where }),
    ]);

    res.json({
      success: true,
      data: { apiKeys, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - API key statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, active, revoked, expired] = await Promise.all([
      prisma.apiKey.count(),
      prisma.apiKey.count({ where: { revokedAt: null } }),
      prisma.apiKey.count({ where: { revokedAt: { not: null } } }),
      prisma.apiKey.count({ where: { expiresAt: { lt: new Date() }, revokedAt: null } }),
    ]);

    res.json({ success: true, data: { total, active, revoked, expired } });
  } catch (err) {
    next(err);
  }
});

// PATCH /:keyId/revoke - Revoke an API key
router.patch('/:keyId/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyId } = req.params as { keyId: string };
    const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    const updated = await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ADMIN_API_KEY_REVOKED',
      targetType: 'ApiKey',
      targetId: keyId,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /:keyId - Delete API key
router.delete('/:keyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyId } = req.params as { keyId: string };
    const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    await prisma.apiKey.delete({ where: { id: keyId } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ADMIN_API_KEY_DELETED',
      targetType: 'ApiKey',
      targetId: keyId,
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
