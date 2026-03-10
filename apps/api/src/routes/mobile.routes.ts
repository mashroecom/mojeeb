import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { pushNotificationService } from '../services/pushNotification.service';

const router: Router = Router();

// All mobile routes require authentication
router.use(authenticate);

// GET /inbox - List conversations across all user's organizations
router.get('/inbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const orgId = req.query.orgId as string | undefined;

    // Get all organizations the user belongs to
    const memberships = await prisma.orgMembership.findMany({
      where: { userId },
      select: { orgId: true },
    });
    const orgIds = memberships.map((m) => m.orgId);

    if (orgIds.length === 0) {
      return res.json({
        success: true,
        data: { conversations: [], total: 0, page, limit, totalPages: 0 },
      });
    }

    // Build query filter
    const where: any = {
      orgId: orgId ? orgId : { in: orgIds },
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          org: { select: { id: true, name: true, logoUrl: true } },
          channel: { select: { id: true, name: true, type: true } },
          agent: { select: { id: true, name: true } },
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
      data: {
        conversations,
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

// GET /stats - Dashboard statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.query.orgId as string | undefined;

    // Get all organizations the user belongs to
    const memberships = await prisma.orgMembership.findMany({
      where: { userId },
      select: { orgId: true },
    });
    const orgIds = memberships.map((m) => m.orgId);

    if (orgIds.length === 0) {
      return res.json({
        success: true,
        data: { total: 0, byStatus: [], activeOrgs: 0 },
      });
    }

    const whereFilter: any = {
      orgId: orgId ? orgId : { in: orgIds },
    };

    const [total, byStatus, activeOrgs] = await Promise.all([
      prisma.conversation.count({ where: whereFilter }),
      prisma.conversation.groupBy({
        by: ['status'],
        where: whereFilter,
        _count: true,
      }),
      orgId
        ? Promise.resolve(1)
        : prisma.organization.count({
            where: { id: { in: orgIds } },
          }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        byStatus,
        activeOrgs,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /conversations/:conversationId - Get conversation details
router.get(
  '/conversations/:conversationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params as { conversationId: string };
      const msgPage = parseInt(req.query.msgPage as string) || 1;
      const msgLimit = Math.min(parseInt(req.query.msgLimit as string) || 50, 200);

      // Get user's organizations
      const memberships = await prisma.orgMembership.findMany({
        where: { userId },
        select: { orgId: true },
      });
      const orgIds = memberships.map((m) => m.orgId);

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          orgId: { in: orgIds },
        },
        include: {
          org: { select: { id: true, name: true, logoUrl: true } },
          channel: { select: { id: true, name: true, type: true } },
          agent: { select: { id: true, name: true } },
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
  },
);

const quickActionSchema = z.object({
  action: z.enum(['resolve', 'archive', 'activate', 'handoff', 'waiting']),
});

// POST /conversations/:conversationId/quick-actions - Quick status updates
router.post(
  '/conversations/:conversationId/quick-actions',
  validate({ body: quickActionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params as { conversationId: string };
      const { action } = req.body;

      // Get user's organizations
      const memberships = await prisma.orgMembership.findMany({
        where: { userId },
        select: { orgId: true },
      });
      const orgIds = memberships.map((m) => m.orgId);

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          orgId: { in: orgIds },
        },
      });

      if (!conversation) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }

      // Map action to status
      const statusMap: Record<string, string> = {
        resolve: 'RESOLVED',
        archive: 'ARCHIVED',
        activate: 'ACTIVE',
        handoff: 'HANDED_OFF',
        waiting: 'WAITING',
      };

      const newStatus = statusMap[action];
      const updateData: any = { status: newStatus };

      if (action === 'resolve') {
        updateData.resolvedAt = new Date();
      }

      const updated = await prisma.conversation.update({
        where: { id: conversationId },
        data: updateData,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// GET /organizations - List user's organizations
router.get('/organizations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const memberships = await prisma.orgMembership.findMany({
      where: { userId },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            timezone: true,
            defaultLanguage: true,
          },
        },
      },
    });

    const organizations = memberships.map((m) => ({
      ...m.org,
      role: m.role,
    }));

    res.json({
      success: true,
      data: { organizations },
    });
  } catch (err) {
    next(err);
  }
});

const subscribeSchema = z.object({
  orgId: z.string().cuid(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
  deviceInfo: z
    .object({
      userAgent: z.string().optional(),
      platform: z.string().optional(),
    })
    .optional(),
});

// POST /push/subscribe - Subscribe to push notifications
router.post(
  '/push/subscribe',
  validate({ body: subscribeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { orgId, subscription, deviceInfo } = req.body;

      // Verify user has access to the organization
      const membership = await prisma.orgMembership.findUnique({
        where: {
          userId_orgId: { userId, orgId },
        },
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this organization',
        });
      }

      const result = await pushNotificationService.subscribe({
        userId,
        orgId,
        subscription,
        deviceInfo,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// DELETE /push/unsubscribe - Unsubscribe from push notifications
router.delete(
  '/push/unsubscribe',
  validate({ body: unsubscribeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { endpoint } = req.body;

      await pushNotificationService.unsubscribe(userId, endpoint);

      res.json({
        success: true,
        data: { unsubscribed: true },
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /push/subscriptions - List user's push subscriptions
router.get('/push/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.query.orgId as string | undefined;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: 'orgId query parameter is required',
      });
    }

    // Verify user has access to the organization
    const membership = await prisma.orgMembership.findUnique({
      where: {
        userId_orgId: { userId, orgId },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this organization',
      });
    }

    const subscriptions = await pushNotificationService.getUserSubscriptions(userId, orgId);

    res.json({
      success: true,
      data: { subscriptions },
    });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/dashboard - Mobile dashboard analytics with key metrics
router.get('/analytics/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const orgId = req.query.orgId as string | undefined;

    // Get user's organizations
    const memberships = await prisma.orgMembership.findMany({
      where: { userId },
      select: { orgId: true },
    });
    const orgIds = memberships.map((m) => m.orgId);

    if (orgIds.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const now = new Date();
    const currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const orgFilter = orgId ? orgId : { in: orgIds };

    const changePercent = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 10000) / 100;
    };

    const [
      currentConversations,
      previousConversations,
      currentMessages,
      previousMessages,
      activeConversations,
      resolvedConversations,
      conversationsToday,
      currentAvgMessageCount,
      previousAvgMessageCount,
    ] = await Promise.all([
      prisma.conversation.count({
        where: { orgId: orgFilter, createdAt: { gte: currentStart, lte: now } },
      }),
      prisma.conversation.count({
        where: { orgId: orgFilter, createdAt: { gte: previousStart, lte: currentStart } },
      }),
      prisma.message.count({
        where: { conversation: { orgId: orgFilter }, createdAt: { gte: currentStart, lte: now } },
      }),
      prisma.message.count({
        where: {
          conversation: { orgId: orgFilter },
          createdAt: { gte: previousStart, lte: currentStart },
        },
      }),
      prisma.conversation.count({ where: { orgId: orgFilter, status: 'ACTIVE' } }),
      prisma.conversation.count({
        where: {
          orgId: orgFilter,
          status: 'RESOLVED',
          resolvedAt: { gte: currentStart, lte: now },
        },
      }),
      prisma.conversation.count({ where: { orgId: orgFilter, createdAt: { gte: todayStart } } }),
      prisma.conversation.aggregate({
        where: { orgId: orgFilter, createdAt: { gte: currentStart, lte: now } },
        _avg: { messageCount: true },
      }),
      prisma.conversation.aggregate({
        where: { orgId: orgFilter, createdAt: { gte: previousStart, lte: currentStart } },
        _avg: { messageCount: true },
      }),
    ]);

    const avgMsgCurrent = currentAvgMessageCount._avg.messageCount || 0;
    const avgMsgPrevious = previousAvgMessageCount._avg.messageCount || 0;

    const metrics = [
      {
        label: 'totalConversations',
        value: currentConversations,
        previousValue: previousConversations,
        changePercent: changePercent(currentConversations, previousConversations),
      },
      {
        label: 'totalMessages',
        value: currentMessages,
        previousValue: previousMessages,
        changePercent: changePercent(currentMessages, previousMessages),
      },
      {
        label: 'activeConversations',
        value: activeConversations,
        previousValue: 0,
        changePercent: 0,
      },
      {
        label: 'resolvedConversations',
        value: resolvedConversations,
        previousValue: 0,
        changePercent: 0,
      },
      {
        label: 'avgMessagesPerConversation',
        value: avgMsgCurrent,
        previousValue: avgMsgPrevious,
        changePercent: changePercent(avgMsgCurrent, avgMsgPrevious),
      },
      {
        label: 'conversationsToday',
        value: conversationsToday,
        previousValue: 0,
        changePercent: 0,
      },
    ];

    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

export default router;
