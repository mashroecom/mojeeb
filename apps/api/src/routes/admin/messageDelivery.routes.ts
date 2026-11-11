import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { DeliveryStatus, MessageRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

const router: Router = Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const TREND_DAYS = 14;
const FAILURE_REASONS_LIMIT = 5;
const RECENT_FAILURES_LIMIT = 10;

// Delivery status is only meaningful for messages the platform sends out
const OUTBOUND_ROLES: MessageRole[] = [MessageRole.AI_AGENT, MessageRole.HUMAN_AGENT];

const STATUS_ORDER: DeliveryStatus[] = [
  DeliveryStatus.QUEUED,
  DeliveryStatus.SENT,
  DeliveryStatus.DELIVERED,
  DeliveryStatus.READ,
  DeliveryStatus.FAILED,
];

function percent(part: number, whole: number): number {
  return whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : 0;
}

// GET /stats - Outbound message delivery health over the last WINDOW_DAYS days
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayUtc = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const windowStart = new Date(todayUtc.getTime() - (WINDOW_DAYS - 1) * DAY_MS);
    const trendStart = new Date(todayUtc.getTime() - (TREND_DAYS - 1) * DAY_MS);

    const where: Prisma.MessageWhereInput = {
      role: { in: OUTBOUND_ROLES },
      createdAt: { gte: windowStart },
    };

    const [byStatus, byChannelRows, latencyRows, failureReasons, trendRows, recentFailures] =
      await Promise.all([
        prisma.message.groupBy({ by: ['deliveryStatus'], where, _count: { _all: true } }),
        prisma.$queryRaw<
          { channelType: string; total: number; failed: number; delivered: number; read: number }[]
        >`
          SELECT ch."type"::text AS "channelType",
                 COUNT(*)::int AS "total",
                 COUNT(*) FILTER (WHERE m."deliveryStatus" = 'FAILED')::int AS "failed",
                 COUNT(*) FILTER (WHERE m."deliveryStatus" IN ('DELIVERED', 'READ'))::int
                   AS "delivered",
                 COUNT(*) FILTER (WHERE m."deliveryStatus" = 'READ')::int AS "read"
            FROM "messages" m
            JOIN "conversations" c ON c."id" = m."conversationId"
            JOIN "channels" ch ON ch."id" = c."channelId"
           WHERE m."role" IN ('AI_AGENT', 'HUMAN_AGENT')
             AND m."createdAt" >= ${windowStart}
           GROUP BY 1
           ORDER BY 2 DESC
        `,
        prisma.$queryRaw<{ avgSeconds: number | null; samples: number }[]>`
          SELECT AVG(EXTRACT(EPOCH FROM ("deliveredAt" - "createdAt")))::float8 AS "avgSeconds",
                 COUNT(*)::int AS "samples"
            FROM "messages"
           WHERE "role" IN ('AI_AGENT', 'HUMAN_AGENT')
             AND "createdAt" >= ${windowStart}
             AND "deliveredAt" IS NOT NULL
             AND "deliveredAt" >= "createdAt"
        `,
        prisma.message.groupBy({
          by: ['failureReason'],
          where: { ...where, deliveryStatus: DeliveryStatus.FAILED },
          _count: { _all: true },
          orderBy: { _count: { failureReason: 'desc' } },
        }),
        prisma.$queryRaw<{ date: Date; total: number; failed: number }[]>`
          SELECT date_trunc('day', "createdAt") AS "date",
                 COUNT(*)::int AS "total",
                 COUNT(*) FILTER (WHERE "deliveryStatus" = 'FAILED')::int AS "failed"
            FROM "messages"
           WHERE "role" IN ('AI_AGENT', 'HUMAN_AGENT')
             AND "createdAt" >= ${trendStart}
           GROUP BY 1
           ORDER BY 1
        `,
        prisma.message.findMany({
          where: { ...where, deliveryStatus: DeliveryStatus.FAILED },
          orderBy: { createdAt: 'desc' },
          take: RECENT_FAILURES_LIMIT,
          select: {
            id: true,
            role: true,
            failureReason: true,
            createdAt: true,
            conversation: {
              select: {
                id: true,
                org: { select: { id: true, name: true } },
                channel: { select: { type: true, name: true } },
              },
            },
          },
        }),
      ]);

    const counts = new Map(byStatus.map((row) => [row.deliveryStatus, row._count._all]));
    const count = (status: DeliveryStatus) => counts.get(status) ?? 0;
    const total = STATUS_ORDER.reduce((sum, status) => sum + count(status), 0);
    const failed = count(DeliveryStatus.FAILED);
    const read = count(DeliveryStatus.READ);
    // Statuses are progressive: a READ message was also delivered
    const delivered = count(DeliveryStatus.DELIVERED) + read;

    // groupBy orders NULL groups inconsistently, so sort the (small) result in memory.
    const reasons = failureReasons
      .map((row) => ({ reason: row.failureReason, count: row._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, FAILURE_REASONS_LIMIT);

    const trendByDate = new Map(trendRows.map((row) => [row.date.toISOString().slice(0, 10), row]));
    const daily = Array.from({ length: TREND_DAYS }, (_, i) => {
      const date = new Date(trendStart.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      const row = trendByDate.get(date);
      const dayTotal = row?.total ?? 0;
      const dayFailed = row?.failed ?? 0;
      return { date, total: dayTotal, failed: dayFailed, succeeded: dayTotal - dayFailed };
    });

    const latency = latencyRows[0];

    res.json({
      success: true,
      data: {
        windowDays: WINDOW_DAYS,
        total,
        queued: count(DeliveryStatus.QUEUED),
        sent: count(DeliveryStatus.SENT),
        delivered,
        read,
        failed,
        // Percentages (0-100) of all outbound messages in the window
        deliveryRate: percent(delivered, total),
        readRate: percent(read, total),
        failureRate: percent(failed, total),
        // Mean seconds between creation and delivery receipt; null when no receipts exist
        avgDeliverySeconds:
          latency && latency.samples > 0 && latency.avgSeconds !== null
            ? Number(latency.avgSeconds.toFixed(1))
            : null,
        byStatus: STATUS_ORDER.map((status) => ({
          status,
          count: count(status),
          percentage: percent(count(status), total),
        })),
        byChannel: byChannelRows.map((row) => ({
          channelType: row.channelType,
          total: row.total,
          delivered: row.delivered,
          read: row.read,
          failed: row.failed,
          failureRate: percent(row.failed, row.total),
        })),
        topFailureReasons: reasons,
        daily,
        recentFailures: recentFailures.map((message) => ({
          id: message.id,
          role: message.role,
          failureReason: message.failureReason,
          createdAt: message.createdAt,
          conversationId: message.conversation.id,
          orgId: message.conversation.org.id,
          orgName: message.conversation.org.name,
          channelType: message.conversation.channel.type,
          channelName: message.conversation.channel.name,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
