import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/database';
import { subscriptionService } from '../services/subscription.service';
import { authenticate, orgContext, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

interface OrgParams { orgId: string; [key: string]: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// GET /api/v1/organizations/:orgId/subscription
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const subscription = await subscriptionService.getByOrgId(orgId);
    res.json({ success: true, data: subscription });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/subscription/checkout
// Creates a Kashier checkout session for plan upgrade
router.post(
  '/checkout',
  requireRole('OWNER', 'ADMIN'),
  validate({
    body: z.object({
      plan: z.string().min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const { plan } = req.body;
      const result = await subscriptionService.createCheckout(orgId, plan);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/organizations/:orgId/subscription/confirm-payment
// Confirms a payment from Kashier redirect parameters
router.post(
  '/confirm-payment',
  requireRole('OWNER', 'ADMIN'),
  validate({
    body: z.object({
      merchantOrderId: z.string().min(1),
      paymentStatus: z.string().min(1),
      transactionId: z.string().optional(),
      amount: z.union([z.string(), z.number()]),
      currency: z.string().min(1),
      signature: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const { merchantOrderId, paymentStatus, transactionId, amount, currency, signature } = req.body;
      const subscription = await subscriptionService.confirmPayment(orgId, {
        merchantOrderId,
        paymentStatus,
        transactionId,
        amount,
        currency,
        signature,
      });
      res.json({ success: true, data: subscription });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/organizations/:orgId/subscription/cancel
// Cancels the current subscription and downgrades to FREE
router.post('/cancel', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const { immediate } = req.body as { immediate?: boolean };
    const subscription = await subscriptionService.cancelSubscription(orgId, immediate ?? false);
    res.json({ success: true, data: subscription });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/subscription/invoices
const invoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  '/invoices',
  validate({ query: invoicesQuerySchema }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const { page, limit } = (req as any).validatedQuery;
      const result = await subscriptionService.getInvoices(orgId, { page, limit });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/organizations/:orgId/subscription/invoices/:invoiceId
const invoiceParamsSchema = z.object({
  orgId: z.string(),
  invoiceId: z.string(),
});

router.get(
  '/invoices/:invoiceId',
  validate({ params: invoiceParamsSchema }),
  async (req, res, next) => {
    try {
      const { orgId, invoiceId } = (req as any).validatedParams;
      const invoice = await subscriptionService.getInvoiceById(orgId, invoiceId);
      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/organizations/:orgId/subscription/invoices/:invoiceId/pdf
router.get('/invoices/:invoiceId/pdf', async (req, res, next) => {
  try {
    const { orgId, invoiceId } = req.params as { orgId: string; invoiceId: string };

    const subscription = await prisma.subscription.findUnique({ where: { orgId } });
    if (!subscription) { res.status(404).json({ error: 'Subscription not found' }); return; }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, subscriptionId: subscription.id },
    });
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.id.slice(-8)}.pdf`);
    doc.pipe(res);

    const primaryColor = '#6366F1';
    const darkColor = '#1F2937';
    const mutedColor = '#6B7280';
    const pageWidth = doc.page.width - 100;

    // Header
    doc.rect(0, 0, doc.page.width, 120).fill(primaryColor);
    doc.fill('#FFFFFF').fontSize(28).font('Helvetica-Bold').text('INVOICE', 50, 45);
    doc.fontSize(11).font('Helvetica').text('Mojeeb - AI Customer Support', 50, 80);

    // Invoice meta (right side)
    doc.fontSize(10)
      .text(`Invoice #${invoice.id.slice(-8).toUpperCase()}`, 350, 45, { align: 'right', width: pageWidth - 300 })
      .text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 350, 62, { align: 'right', width: pageWidth - 300 })
      .text(`Due: ${new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 350, 79, { align: 'right', width: pageWidth - 300 });

    doc.fill(darkColor);
    let y = 150;

    // Bill To
    doc.fontSize(10).font('Helvetica-Bold').fill(mutedColor).text('BILL TO', 50, y);
    y += 18;
    doc.fontSize(12).font('Helvetica-Bold').fill(darkColor).text(org?.name ?? 'Organization', 50, y);
    y += 18;
    doc.fontSize(10).font('Helvetica').fill(mutedColor).text(`Plan: ${subscription.plan}`, 50, y);
    y += 15;
    doc.text(`Period: ${new Date(subscription.currentPeriodStart).toLocaleDateString()} - ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`, 50, y);

    // Status badge
    const statusColors: Record<string, string> = { PAID: '#10B981', PENDING: '#F59E0B', FAILED: '#EF4444', REFUNDED: '#6B7280' };
    const statusColor = statusColors[invoice.status] || mutedColor;
    doc.roundedRect(430, 150, 80, 24, 12).fill(statusColor);
    doc.fill('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(invoice.status, 430, 157, { width: 80, align: 'center' });

    y += 40;

    // Table header
    doc.rect(50, y, pageWidth, 35).fill('#F3F4F6');
    doc.fill(darkColor).fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 60, y + 11);
    doc.text('Amount', 400, y + 11, { width: 110, align: 'right' });
    y += 35;

    // Table row
    const planLabel = subscription.plan === 'FREE'
      ? 'Free Plan'
      : `${subscription.plan.charAt(0) + subscription.plan.slice(1).toLowerCase()} Plan - Monthly`;
    doc.font('Helvetica').fontSize(10).fill(darkColor);
    doc.text(planLabel, 60, y + 12);
    doc.text(`${invoice.currency} ${Number(invoice.amount).toFixed(2)}`, 400, y + 12, { width: 110, align: 'right' });
    y += 40;

    // Divider
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 15;

    // Total
    doc.font('Helvetica-Bold').fontSize(12).fill(darkColor);
    doc.text('Total', 60, y);
    doc.text(`${invoice.currency} ${Number(invoice.amount).toFixed(2)}`, 400, y, { width: 110, align: 'right' });
    y += 30;

    // Payment info
    if (invoice.paidAt) {
      doc.font('Helvetica').fontSize(9).fill(mutedColor);
      doc.text(`Paid on ${new Date(invoice.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 60, y);
      y += 15;
    }
    if (invoice.kashierPaymentId) {
      doc.font('Helvetica').fontSize(9).fill(mutedColor);
      doc.text(`Transaction ID: ${invoice.kashierPaymentId}`, 60, y);
      y += 15;
    }

    // Footer — keep on single page by using fixed Y and lineBreak: false
    const footerY = 720;
    doc.moveTo(50, footerY).lineTo(50 + pageWidth, footerY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fill(mutedColor);
    doc.text('Mojeeb - AI Customer Support Platform', 50, footerY + 12, { align: 'center', width: pageWidth, lineBreak: false });
    doc.text('This is a computer-generated invoice and does not require a signature.', 50, footerY + 24, { align: 'center', width: pageWidth, lineBreak: false });

    doc.end();
  } catch (err) {
    next(err);
  }
});

export default router;
