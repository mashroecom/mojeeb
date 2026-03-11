import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';

const router: Router = Router();

async function getSystemHealth() {
  const services: Record<string, { status: 'healthy' | 'unhealthy'; latency?: number }> = {};

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = { status: 'healthy', latency: Date.now() - dbStart };
  } catch {
    services.database = { status: 'unhealthy', latency: Date.now() - dbStart };
  }

  const redisStart = Date.now();
  try {
    await redis.ping();
    services.redis = { status: 'healthy', latency: Date.now() - redisStart };
  } catch {
    services.redis = { status: 'unhealthy', latency: Date.now() - redisStart };
  }

  const queueStart = Date.now();
  try {
    const queueModule = await import('../../queues');
    const anyQueue = Object.values(queueModule).find(
      (v) => v && typeof (v as any).getJobCounts === 'function',
    );
    if (anyQueue) {
      await (anyQueue as any).getJobCounts('waiting');
      services.queues = { status: 'healthy', latency: Date.now() - queueStart };
    } else {
      services.queues = { status: 'healthy', latency: Date.now() - queueStart };
    }
  } catch {
    services.queues = { status: 'unhealthy', latency: Date.now() - queueStart };
  }

  return services;
}

// GET / - Alias for /health
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getSystemHealth();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /health - System health check
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getSystemHealth();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /queues - BullMQ queue stats
router.get('/queues', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result: Record<
      string,
      { waiting: number; active: number; completed: number; failed: number; delayed: number }
    > = {};

    try {
      const queueModule = await import('../../queues');
      const queueEntries = Object.entries(queueModule).filter(
        ([, value]) => value && typeof (value as any).getJobCounts === 'function',
      );

      for (const [name, queue] of queueEntries) {
        const counts = await (queue as any).getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        );
        // Use a display-friendly name (strip "Queue" suffix from export name)
        const displayName = name.replace(/Queue$/, '');
        result[displayName] = {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
        };
      }
    } catch {
      // queues module not available
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /db-stats - Database table stats
router.get('/db-stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tables = await prisma.$queryRaw<{ table_name: string; row_count: bigint }[]>`
      SELECT relname as table_name, n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `;

    const data = tables.map((t) => ({
      table: t.table_name,
      rowCount: Number(t.row_count),
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
