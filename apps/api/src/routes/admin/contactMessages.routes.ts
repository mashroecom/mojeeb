import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// GET / - List contact messages paginated
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactMessage.count({ where }),
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

// GET /:id - Get single contact message
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const contactMessage = await prisma.contactMessage.findUnique({
      where: { id },
    });

    if (!contactMessage) {
      return res.status(404).json({ success: false, error: 'Contact message not found' });
    }

    res.json({ success: true, data: contactMessage });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id - Update status
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    const contactMessage = await prisma.contactMessage.update({
      where: { id },
      data: { status },
    });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'CONTACT_MESSAGE_UPDATED',
      targetType: 'ContactMessage',
      targetId: id,
      metadata: { status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: contactMessage });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete contact message
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.contactMessage.delete({
      where: { id },
    });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'CONTACT_MESSAGE_DELETED',
      targetType: 'ContactMessage',
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
