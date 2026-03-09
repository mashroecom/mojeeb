import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { NotFoundError } from '../../utils/errors';

const router: Router = Router();

// GET / - List all active sessions, paginated
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const userId = req.query.userId as string | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = {
      expiresAt: { gt: new Date() },
    };

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.user = {
        email: { contains: search, mode: 'insensitive' },
      };
    }

    const [items, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.session.count({ where }),
    ]);

    const mapped = items.map((s) => ({
      id: s.id,
      userId: s.userId,
      userEmail: s.user?.email ?? '',
      userName: s.user ? `${s.user.firstName ?? ''} ${s.user.lastName ?? ''}`.trim() : undefined,
      ip: s.ipAddress ?? '',
      userAgent: s.userAgent ?? '',
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));

    res.json({
      success: true,
      data: {
        items: mapped,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Session stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalActive, createdToday] = await Promise.all([
      prisma.session.count({
        where: { expiresAt: { gt: now } },
      }),
      prisma.session.count({
        where: { createdAt: { gte: todayStart } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalActive,
        createdToday,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /:sessionId - Kill a specific session
router.delete('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params as { sessionId: string };

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    await prisma.session.delete({ where: { id: sessionId } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'SESSION_KILLED',
      targetType: 'Session',
      targetId: sessionId,
      metadata: { targetUserId: session.userId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: { id: sessionId } });
  } catch (err) {
    next(err);
  }
});

// DELETE /user/:userId - Kill all sessions for a user
router.delete('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };

    const result = await prisma.session.deleteMany({
      where: { userId },
    });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'USER_SESSIONS_KILLED',
      targetType: 'User',
      targetId: userId,
      metadata: { sessionsDeleted: result.count },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: { userId, sessionsDeleted: result.count } });
  } catch (err) {
    next(err);
  }
});

export default router;
