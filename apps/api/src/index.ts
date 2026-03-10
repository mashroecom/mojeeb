import { createServer } from 'http';
import app from './app';
import { config, validateConfig } from './config';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { setupWebSocket, getIO } from './websocket';
import {
  inboundQueue,
  aiQueue,
  outboundQueue,
  analyticsQueue,
  webhookQueue,
  bulkEmailQueue,
  emailQueue,
  deadLetterQueue,
} from './queues';
import { configService } from './services/config.service';
import type { Worker } from 'bullmq';

async function main() {
  // Conditionally load workers based on ENABLE_WORKERS environment variable
  let workers: Worker[] = [];
  if (config.enableWorkers) {
    const { inboundWorker } = await import('./queues/workers/inbound.worker');
    const { aiWorker } = await import('./queues/workers/ai.worker');
    const { outboundWorker } = await import('./queues/workers/outbound.worker');
    const { analyticsWorker } = await import('./queues/workers/analytics.worker');
    const { default: webhookWorker } = await import('./queues/workers/webhook.worker');
    const { bulkEmailWorker } = await import('./queues/workers/bulkEmail.worker');
    const { emailWorker } = await import('./queues/workers/email.worker');

    workers = [
      inboundWorker,
      aiWorker,
      outboundWorker,
      analyticsWorker,
      webhookWorker,
      bulkEmailWorker,
      emailWorker,
    ];
    logger.info('Queue workers loaded and started');
  } else {
    logger.info('Queue workers disabled (ENABLE_WORKERS=false)');
  }
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

  // Warm config cache into Redis
  await configService.warmCache();
  logger.info('Config cache warmed');

  // Validate configuration (throws in production if required env vars are missing)
  validateConfig();

  // Create HTTP server and attach WebSocket
  const httpServer = createServer(app);
  setupWebSocket(httpServer);
  logger.info('WebSocket server initialized');

  httpServer.listen(config.port, () => {
    logger.info(`API server running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Workers enabled: ${config.enableWorkers}`);
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

    // 1. Close Socket.IO (stop accepting new connections, disconnect existing)
    try {
      const io = getIO();
      io.close();
      logger.info('Socket.IO closed');
    } catch {
      // getIO throws if not initialized — safe to ignore
    }

    // 2. Stop accepting new HTTP connections and wait for in-flight requests
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    logger.info('HTTP server closed');

    // 3. Close BullMQ workers gracefully (finish in-progress jobs)
    if (workers.length > 0) {
      await Promise.allSettled(workers.map((worker) => worker.close()));
      logger.info('Queue workers closed');
    }

    // 4. Close BullMQ queues (release Redis connections)
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

    // 5. Disconnect database and Redis
    await prisma.$disconnect();
    await redis.quit();
    logger.info('Server closed');
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
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
