import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

const router: Router = Router();

// GET /stats - Conversation quality statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Total conversations
    const totalConversations = await prisma.conversation.count();

    // Average messages per conversation
    const avgMessagesResult = await prisma.conversation.aggregate({
      _avg: { messageCount: true },
    });
    const avgMessages = Number((avgMessagesResult._avg.messageCount ?? 0).toFixed(1));

    // Average resolution time (resolved conversations only)
    const resolvedConversations = await prisma.conversation.findMany({
      where: { status: 'RESOLVED', resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    });

    let avgResolutionTimeMs = 0;
    if (resolvedConversations.length > 0) {
      const totalMs = resolvedConversations.reduce((sum, c) => {
        return sum + (new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime());
      }, 0);
      avgResolutionTimeMs = totalMs / resolvedConversations.length;
    }

    // Format resolution time
    const avgResolutionMinutes = Math.round(avgResolutionTimeMs / 60000);
    const avgResolutionHours = Number((avgResolutionMinutes / 60).toFixed(1));

    // Average rating
    const avgRatingResult = await prisma.conversationRating.aggregate({
      _avg: { rating: true },
    });
    const avgRating = Number((avgRatingResult._avg.rating ?? 0).toFixed(1));

    // Quality tiers
    const [highQuality, mediumQuality, lowQuality] = await Promise.all([
      prisma.conversationRating.count({ where: { rating: { gte: 4 } } }),
      prisma.conversationRating.count({ where: { rating: 3 } }),
      prisma.conversationRating.count({ where: { rating: { lte: 2 } } }),
    ]);

    const totalRated = highQuality + mediumQuality + lowQuality;

    res.json({
      success: true,
      data: {
        totalConversations,
        avgMessages,
        avgResolutionMinutes,
        avgResolutionHours,
        avgRating,
        qualityTiers: {
          high: highQuality,
          medium: mediumQuality,
          low: lowQuality,
          total: totalRated,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /low-quality - Paginated list of low-quality conversations
router.get('/low-quality', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Low quality = rating <= 2
    const lowRatings = await prisma.conversationRating.findMany({
      where: { rating: { lte: 2 } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        rating: true,
        feedback: true,
        createdAt: true,
        conversation: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            status: true,
            messageCount: true,
            createdAt: true,
            resolvedAt: true,
            org: { select: { name: true } },
          },
        },
      },
    });

    const total = await prisma.conversationRating.count({
      where: { rating: { lte: 2 } },
    });

    const conversations = lowRatings.map((r) => {
      const durationMs = r.conversation.resolvedAt
        ? new Date(r.conversation.resolvedAt).getTime() -
          new Date(r.conversation.createdAt).getTime()
        : new Date().getTime() - new Date(r.conversation.createdAt).getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      return {
        conversationId: r.conversation.id,
        customerName: r.conversation.customerName,
        customerEmail: r.conversation.customerEmail,
        orgName: r.conversation.org.name,
        rating: r.rating,
        feedback: r.feedback,
        messageCount: r.conversation.messageCount,
        durationMinutes,
        status: r.conversation.status,
        createdAt: r.conversation.createdAt,
      };
    });

    res.json({
      success: true,
      data: {
        conversations,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
