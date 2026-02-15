import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// GET / - List demo requests paginated
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.demoRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.demoRequest.count({ where }),
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

// GET /:id - Get single demo request
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const demoRequest = await prisma.demoRequest.findUnique({
      where: { id },
    });

    if (!demoRequest) {
      return res.status(404).json({ success: false, error: 'Demo request not found' });
    }

    res.json({ success: true, data: demoRequest });
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

    const demoRequest = await prisma.demoRequest.update({
      where: { id },
      data: { status },
    });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'DEMO_REQUEST_UPDATED',
      targetType: 'DemoRequest',
      targetId: id,
      metadata: { status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: demoRequest });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete demo request
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.demoRequest.delete({
      where: { id },
    });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'DEMO_REQUEST_DELETED',
      targetType: 'DemoRequest',
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
