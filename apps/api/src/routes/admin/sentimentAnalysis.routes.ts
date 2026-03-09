import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

const router: Router = Router();

// GET /stats - Emotion/sentiment statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const emotionDistribution = await prisma.message.groupBy({
      by: ['emotion'],
      where: { emotion: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { emotion: 'desc' } },
    });

    const emotionMap: Record<string, number> = {};
    let totalAnalyzed = 0;
    for (const row of emotionDistribution) {
      if (row.emotion) {
        emotionMap[row.emotion] = row._count._all;
        totalAnalyzed += row._count._all;
      }
    }

    const positiveEmotions = ['happy', 'satisfied'];
    const negativeEmotions = ['angry', 'frustrated', 'sad'];

    const positiveCount = positiveEmotions.reduce((sum, e) => sum + (emotionMap[e] || 0), 0);
    const negativeCount = negativeEmotions.reduce((sum, e) => sum + (emotionMap[e] || 0), 0);
    const neutralCount = totalAnalyzed - positiveCount - negativeCount;

    res.json({
      success: true,
      data: {
        totalAnalyzed,
        positivePct: totalAnalyzed > 0 ? (positiveCount / totalAnalyzed) * 100 : 0,
        negativePct: totalAnalyzed > 0 ? (negativeCount / totalAnalyzed) * 100 : 0,
        neutralPct: totalAnalyzed > 0 ? (neutralCount / totalAnalyzed) * 100 : 0,
        emotionDistribution: emotionMap,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /trends - Recent negative conversations
router.get('/trends', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const negativeConversations = await prisma.conversation.findMany({
      where: {
        lastEmotion: { in: ['angry', 'frustrated', 'sad'] },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
      select: {
        id: true,
        customerName: true,
        lastEmotion: true,
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        recentNegative: negativeConversations.map((c) => ({
          id: c.id,
          visitorName: c.customerName,
          conversationId: c.id,
          emotion: c.lastEmotion,
          messagePreview: c.messages[0]?.content?.substring(0, 120) || '',
          createdAt: c.lastMessageAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
