import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

const router: Router = Router();

// GET /stats - Emotion/sentiment statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [emotionDistribution, negativeConversations, totalWithEmotion] = await Promise.all([
      prisma.message.groupBy({
        by: ['emotion'],
        where: { emotion: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { emotion: 'desc' } },
      }),
      prisma.conversation.findMany({
        where: {
          lastEmotion: { in: ['angry', 'frustrated'] },
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
      }),
      prisma.conversation.count({
        where: { lastEmotion: { not: null } },
      }),
    ]);

    const emotionMap: Record<string, number> = {};
    for (const row of emotionDistribution) {
      if (row.emotion) {
        emotionMap[row.emotion] = row._count._all;
      }
    }

    res.json({
      success: true,
      data: {
        emotionDistribution: emotionMap,
        negativeConversations: negativeConversations.map((c) => ({
          id: c.id,
          customerName: c.customerName,
          lastEmotion: c.lastEmotion,
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: c.messages[0]?.content?.substring(0, 120) || '',
        })),
        totalWithEmotion,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /trends - Last 30 days emotion distribution by day
router.get('/trends', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const trends = await prisma.$queryRaw<{ date: string; emotion: string; count: number }[]>`
      SELECT DATE("createdAt") as date,
             emotion,
             COUNT(*)::int as count
      FROM "messages"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        AND emotion IS NOT NULL
      GROUP BY DATE("createdAt"), emotion
      ORDER BY date ASC, count DESC
    `;

    res.json({
      success: true,
      data: trends.map((r) => ({
        date: r.date,
        emotion: r.emotion,
        count: Number(r.count),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
