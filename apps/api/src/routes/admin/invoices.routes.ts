import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';

const router: Router = Router();

// GET / - List all invoices
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const orgId = req.query.orgId as string | undefined;
    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: any = {};
    if (orgId) where.subscription = { orgId };
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          subscription: {
            select: { id: true, plan: true, status: true, org: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: { invoices, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Invoice statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, byStatus, totalRevenue, pendingAmount, refundedAmount] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.groupBy({ by: ['status'], _count: true }),
      prisma.invoice.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { status: 'REFUNDED' }, _sum: { amount: true } }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        byStatus,
        totalRevenue: totalRevenue._sum.amount?.toNumber() ?? 0,
        pendingAmount: pendingAmount._sum.amount?.toNumber() ?? 0,
        refundedAmount: refundedAmount._sum.amount?.toNumber() ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /:invoiceId - Invoice detail
router.get('/:invoiceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceId } = req.params as { invoiceId: string };
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          select: { id: true, plan: true, status: true, org: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

const updateInvoiceSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']),
});

// PATCH /:invoiceId - Update invoice status
router.patch(
  '/:invoiceId',
  validate({ body: updateInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { invoiceId } = req.params as { invoiceId: string };
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }

      const updateData: any = { status: req.body.status };
      if (req.body.status === 'PAID' && !invoice.paidAt) {
        updateData.paidAt = new Date();
      }

      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: updateData,
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_INVOICE_UPDATED',
        targetType: 'Invoice',
        targetId: invoiceId,
        metadata: { status: req.body.status },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
