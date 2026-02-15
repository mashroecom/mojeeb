import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// GET / - List announcements paginated
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.announcement.count(),
    ]);

    res.json({
      success: true,
      data: {
        items,
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

// POST / - Create announcement
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, body, type, startsAt, endsAt } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'title and body are required' });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        body,
        type: type || 'info',
        startsAt: startsAt ? new Date(startsAt) : undefined,
        endsAt: endsAt ? new Date(endsAt) : undefined,
        createdBy: req.user!.userId,
      },
    });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ANNOUNCEMENT_CREATED',
      targetType: 'Announcement',
      targetId: announcement.id,
      metadata: { title, type },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id - Update announcement
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { title, body, type, isActive, startsAt, endsAt } = req.body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (body !== undefined) updateData.body = body;
    if (type !== undefined) updateData.type = type;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (startsAt !== undefined) updateData.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) updateData.endsAt = endsAt ? new Date(endsAt) : null;

    const announcement = await prisma.announcement.update({
      where: { id },
      data: updateData,
    });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ANNOUNCEMENT_UPDATED',
      targetType: 'Announcement',
      targetId: id,
      metadata: updateData,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete announcement
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.announcement.delete({
      where: { id },
    });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ANNOUNCEMENT_DELETED',
      targetType: 'Announcement',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export default router;
