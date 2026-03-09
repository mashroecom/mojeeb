import { config, validateConfig } from './config';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { inboundQueue, aiQueue, outboundQueue, analyticsQueue, webhookQueue, bulkEmailQueue, emailQueue, deadLetterQueue } from './queues';

// Import workers (named exports for graceful shutdown)
import { inboundWorker } from './queues/workers/inbound.worker';
import { aiWorker } from './queues/workers/ai.worker';
import { outboundWorker } from './queues/workers/outbound.worker';
import { analyticsWorker } from './queues/workers/analytics.worker';
import webhookWorker from './queues/workers/webhook.worker';
import { bulkEmailWorker } from './queues/workers/bulkEmail.worker';
import { emailWorker } from './queues/workers/email.worker';

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
      deadLetterQueue.close(),
    ]);
    logger.info('Queues closed');

    // 3. Disconnect database and Redis
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
