import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';

const router: Router = Router();

// GET /health - System health check
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // Check database
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
    } catch (err: any) {
      checks.database = { status: 'unhealthy', latencyMs: Date.now() - dbStart, error: err.message };
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      await redis.ping();
      checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart };
    } catch (err: any) {
      checks.redis = { status: 'unhealthy', latencyMs: Date.now() - redisStart, error: err.message };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
      success: true,
      data: {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /queues - BullMQ queue stats
router.get('/queues', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let queues: Record<string, any> = {};

    try {
      const queueModule = await import('../../queues');
      const queueEntries = Object.entries(queueModule).filter(
        ([, value]) => value && typeof (value as any).getJobCounts === 'function'
      );

      for (const [name, queue] of queueEntries) {
        const counts = await (queue as any).getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
        queues[name] = counts;
      }
    } catch {
      // queues module not available, return empty
      queues = {};
    }

    res.json({ success: true, data: { queues } });
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

    // Convert BigInt to Number for JSON serialization
    const data = tables.map((t) => ({
      table_name: t.table_name,
      row_count: Number(t.row_count),
    }));

    res.json({ success: true, data: { tables: data } });
  } catch (err) {
    next(err);
  }
});

export default router;
