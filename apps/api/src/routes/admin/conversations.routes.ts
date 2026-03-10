import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';

const router: Router = Router();

// GET / - List all conversations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const orgId = req.query.orgId as string | undefined;
    const channelId = req.query.channelId as string | undefined;
    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (orgId) where.orgId = orgId;
    if (channelId) where.channelId = channelId;
    if (status) where.status = status;
    // BUG FIX: validate date strings before creating Date objects
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (endDate) {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) where.createdAt.lte = d;
      }
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          org: { select: { id: true, name: true } },
          channel: { select: { id: true, name: true, type: true } },
          leads: { select: { id: true, name: true, email: true, phone: true }, take: 1 },
          _count: { select: { messages: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    res.json({
      success: true,
      data: { conversations, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Conversation statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, byStatus, avgMessages] = await Promise.all([
      prisma.conversation.count(),
      prisma.conversation.groupBy({ by: ['status'], _count: true }),
      prisma.message.count().then(async (msgCount) => {
        const convCount = await prisma.conversation.count();
        return convCount > 0 ? Math.round(msgCount / convCount) : 0;
      }),
    ]);

    res.json({ success: true, data: { total, byStatus, avgMessages } });
  } catch (err) {
    next(err);
  }
});

// GET /:conversationId - Conversation detail with messages
router.get('/:conversationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationId } = req.params as { conversationId: string };
    const msgPage = parseInt(req.query.msgPage as string) || 1;
    const msgLimit = Math.min(parseInt(req.query.msgLimit as string) || 50, 200);

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        org: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true, type: true } },
        ratings: true,
        tags: { include: { tag: true } },
        notes: {
          orderBy: { createdAt: 'desc' as const },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const [messages, messageTotal] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: (msgPage - 1) * msgLimit,
        take: msgLimit,
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    res.json({
      success: true,
      data: {
        ...conversation,
        messages,
        messageTotal,
        messagePage: msgPage,
        messageTotalPages: Math.ceil(messageTotal / msgLimit),
      },
    });
  } catch (err) {
    next(err);
  }
});

const updateConversationSchema = z.object({
  status: z.enum(['ACTIVE', 'HANDED_OFF', 'WAITING', 'RESOLVED', 'ARCHIVED']).optional(),
});

// PATCH /:conversationId - Update conversation status
router.patch(
  '/:conversationId',
  validate({ body: updateConversationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params as { conversationId: string };
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }

      const updated = await prisma.conversation.update({
        where: { id: conversationId },
        data: req.body,
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_CONVERSATION_UPDATED',
        targetType: 'Conversation',
        targetId: conversationId,
        metadata: req.body,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// POST /bulk-status - Bulk update conversation statuses
const bulkStatusSchema = z.object({
  conversationIds: z.array(z.string()).min(1).max(100),
  status: z.enum(['ACTIVE', 'HANDED_OFF', 'WAITING', 'RESOLVED', 'ARCHIVED']),
});

router.post(
  '/bulk-status',
  validate({ body: bulkStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationIds, status } = req.body;

      const result = await prisma.conversation.updateMany({
        where: { id: { in: conversationIds } },
        data: { status },
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_CONVERSATIONS_BULK_STATUS',
        targetType: 'Conversation',
        targetId: 'bulk',
        metadata: { conversationIds, status, count: result.count },
      });

      res.json({ success: true, data: { updated: result.count } });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:conversationId - Delete a single conversation
router.delete('/:conversationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationId } = req.params as { conversationId: string };
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Delete related records first
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversationRating.deleteMany({ where: { conversationId } });
    await prisma.conversationTag.deleteMany({ where: { conversationId } });
    await prisma.conversationNote.deleteMany({ where: { conversationId } });
    await prisma.lead.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ADMIN_CONVERSATION_DELETED',
      targetType: 'Conversation',
      targetId: conversationId,
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// POST /bulk-delete - Bulk delete conversations
const bulkDeleteSchema = z.object({
  conversationIds: z.array(z.string()).min(1).max(100),
});

router.post(
  '/bulk-delete',
  validate({ body: bulkDeleteSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationIds } = req.body;

      // Delete related records first
      await prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await prisma.conversationRating.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });
      await prisma.conversationTag.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });
      await prisma.conversationNote.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });
      await prisma.lead.deleteMany({ where: { conversationId: { in: conversationIds } } });

      const result = await prisma.conversation.deleteMany({
        where: { id: { in: conversationIds } },
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_CONVERSATIONS_BULK_DELETED',
        targetType: 'Conversation',
        targetId: 'bulk',
        metadata: { conversationIds, count: result.count },
      });

      res.json({ success: true, data: { deleted: result.count } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
