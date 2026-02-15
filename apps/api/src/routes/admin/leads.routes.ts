import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';

const router: Router = Router();

// GET / - List all leads
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
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (orgId) where.orgId = orgId;
    if (status) where.status = status;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          org: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, firstName: true, lastName: true } },
          conversation: { select: { id: true, customerName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      success: true,
      data: { leads, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Lead statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, byStatus] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: true }),
    ]);

    const converted = byStatus.find((s: any) => s.status === 'CONVERTED')?._count || 0;
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

    res.json({ success: true, data: { total, byStatus, conversionRate } });
  } catch (err) {
    next(err);
  }
});

// GET /:leadId - Lead detail
router.get('/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params as { leadId: string };
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        org: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        conversation: { select: { id: true, customerName: true, status: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
});

const updateLeadSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).optional(),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

// PATCH /:leadId - Update lead
router.patch(
  '/:leadId',
  validate({ body: updateLeadSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { leadId } = req.params as { leadId: string };
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: req.body,
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_LEAD_UPDATED',
        targetType: 'Lead',
        targetId: leadId,
        metadata: req.body,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:leadId - Delete lead
router.delete('/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params as { leadId: string };
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    await prisma.lead.delete({ where: { id: leadId } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ADMIN_LEAD_DELETED',
      targetType: 'Lead',
      targetId: leadId,
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// POST /bulk-status - Bulk update lead statuses
const bulkLeadStatusSchema = z.object({
  leadIds: z.array(z.string()).min(1).max(100),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']),
});

router.post(
  '/bulk-status',
  validate({ body: bulkLeadStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { leadIds, status } = req.body;

      const result = await prisma.lead.updateMany({
        where: { id: { in: leadIds } },
        data: { status },
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_LEADS_BULK_STATUS',
        targetType: 'Lead',
        targetId: 'bulk',
        metadata: { leadIds, status, count: result.count },
      });

      res.json({ success: true, data: { updated: result.count } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /bulk-delete - Bulk delete leads
const bulkLeadDeleteSchema = z.object({
  leadIds: z.array(z.string()).min(1).max(100),
});

router.post(
  '/bulk-delete',
  validate({ body: bulkLeadDeleteSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { leadIds } = req.body;

      const result = await prisma.lead.deleteMany({
        where: { id: { in: leadIds } },
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_LEADS_BULK_DELETE',
        targetType: 'Lead',
        targetId: 'bulk',
        metadata: { leadIds, count: result.count },
      });

      res.json({ success: true, data: { deleted: result.count } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
