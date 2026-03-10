import express from 'express';
import { config, validateConfig } from './config';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';
import {
  inboundQueue,
  aiQueue,
  outboundQueue,
  analyticsQueue,
  webhookQueue,
  bulkEmailQueue,
  emailQueue,
  crawlerQueue,
  deadLetterQueue,
} from './queues';

// Import workers (named exports for graceful shutdown)
import { inboundWorker } from './queues/workers/inbound.worker';
import { aiWorker } from './queues/workers/ai.worker';
import { outboundWorker } from './queues/workers/outbound.worker';
import { analyticsWorker } from './queues/workers/analytics.worker';
import webhookWorker from './queues/workers/webhook.worker';
import { bulkEmailWorker } from './queues/workers/bulkEmail.worker';
import { emailWorker } from './queues/workers/email.worker';
import { crawlerWorker } from './queues/workers/crawler.worker';

async function main() {
  // Test database connection
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to database');
    process.exit(1);
  }

  // Test Redis connection
  try {
    await redis.ping();
    logger.info('Redis connected');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to Redis');
    process.exit(1);
  }

  // Validate configuration (throws in production if required env vars are missing)
  validateConfig();

  logger.info('Queue workers started');
  logger.info(`Environment: ${config.nodeEnv}`);

  // Health check server (for k8s liveness/readiness probes)
  const healthPort = parseInt(process.env.WORKER_HEALTH_PORT || '4001', 10);
  const healthApp = express();

  healthApp.get('/health', async (req, res) => {
    try {
      const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

      // Check database
      const dbStart = Date.now();
      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
      } catch (err: any) {
        checks.database = {
          status: 'unhealthy',
          latencyMs: Date.now() - dbStart,
          error: err.message,
        };
      }

      // Check Redis
      const redisStart = Date.now();
      try {
        await redis.ping();
        checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart };
      } catch (err: any) {
        checks.redis = {
          status: 'unhealthy',
          latencyMs: Date.now() - redisStart,
          error: err.message,
        };
      }

      // Check workers (ensure they're running)
      const workers = [
        { name: 'inbound', worker: inboundWorker },
        { name: 'ai', worker: aiWorker },
        { name: 'outbound', worker: outboundWorker },
        { name: 'analytics', worker: analyticsWorker },
        { name: 'webhook', worker: webhookWorker },
        { name: 'bulkEmail', worker: bulkEmailWorker },
        { name: 'email', worker: emailWorker },
        { name: 'crawler', worker: crawlerWorker },
      ];

      for (const { name, worker } of workers) {
        const isRunning = worker.isRunning();
        checks[`worker_${name}`] = {
          status: isRunning ? 'healthy' : 'unhealthy',
        };
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
    } catch (err: any) {
      logger.error({ err }, 'Health check error');
      res.status(503).json({
        success: false,
        error: 'Health check failed',
      });
    }
  });

  const healthServer = healthApp.listen(healthPort, () => {
    logger.info(`Worker health check server listening on port ${healthPort}`);
  });

  // Graceful shutdown
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return; // Prevent double shutdown
    isShuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);

    // Force exit after 15 seconds to prevent hanging
    const forceTimer = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15000);
    forceTimer.unref(); // Don't keep process alive just for this timer

    // 1. Close BullMQ workers gracefully (finish in-progress jobs)
    await Promise.allSettled([
      inboundWorker.close(),
      aiWorker.close(),
      outboundWorker.close(),
      analyticsWorker.close(),
      webhookWorker.close(),
      bulkEmailWorker.close(),
      emailWorker.close(),
      crawlerWorker.close(),
    ]);
    logger.info('Queue workers closed');

    // 2. Close BullMQ queues (release Redis connections)
    await Promise.allSettled([
      inboundQueue.close(),
      aiQueue.close(),
      outboundQueue.close(),
      analyticsQueue.close(),
      webhookQueue.close(),
      bulkEmailQueue.close(),
      emailQueue.close(),
      crawlerQueue.close(),
      deadLetterQueue.close(),
    ]);
    logger.info('Queues closed');

    // 3. Close health check server
    healthServer.close();
    logger.info('Health check server closed');

    // 4. Disconnect database and Redis
    await prisma.$disconnect();
    await redis.quit();
    logger.info('Worker shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled promise rejections so they don't crash the process silently
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });

  // Catch uncaught exceptions (log before crash)
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start worker');
  process.exit(1);
});
