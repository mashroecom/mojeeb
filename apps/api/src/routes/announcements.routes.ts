import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';

/**
 * User-facing announcements (mounted behind `authenticate`).
 * Admins manage announcements under /admin/announcements; these endpoints let a
 * signed-in user read the ones that are currently live and dismiss them.
 */

const router: Router = Router();

// GET /api/v1/announcements — active announcements the user has not dismissed
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const now = new Date();

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        dismissals: { none: { userId } },
      },
      select: { id: true, title: true, body: true, type: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: 'desc' },
      take: 5,
    });

    // Most severe first, then newest
    const severity: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    announcements.sort((a, b) => (severity[a.type] ?? 3) - (severity[b.type] ?? 3));

    res.json({ success: true, data: announcements });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/announcements/:id/dismiss — hide an announcement for this user
router.post('/:id/dismiss', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params as { id: string };

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!announcement) throw new NotFoundError('Announcement not found');

    await prisma.announcementDismissal.upsert({
      where: { announcementId_userId: { announcementId: id, userId } },
      create: { announcementId: id, userId },
      update: {},
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
