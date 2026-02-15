import { createServer } from 'http';
import app from './app';
import { config, validateConfig } from './config';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { setupWebSocket, getIO } from './websocket';
import { inboundQueue, aiQueue, outboundQueue, analyticsQueue, webhookQueue, bulkEmailQueue, deadLetterQueue } from './queues';

// Import workers (named exports for graceful shutdown)
import { inboundWorker } from './queues/workers/inbound.worker';
import { aiWorker } from './queues/workers/ai.worker';
import { outboundWorker } from './queues/workers/outbound.worker';
import { analyticsWorker } from './queues/workers/analytics.worker';
import webhookWorker from './queues/workers/webhook.worker';
import { bulkEmailWorker } from './queues/workers/bulkEmail.worker';

async function main() {
  // Test database connection
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to database');
    process.exit(1);
  }

  // Validate configuration (throws in production if required env vars are missing)
  validateConfig();

  // Create HTTP server and attach WebSocket
  const httpServer = createServer(app);
  setupWebSocket(httpServer);
  logger.info('WebSocket server initialized');

  httpServer.listen(config.port, () => {
    logger.info(`API server running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info('Queue workers started');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);

    // 1. Close Socket.IO (stop accepting new connections, disconnect existing)
    try {
      const io = getIO();
      io.close();
      logger.info('Socket.IO closed');
    } catch {
      // getIO throws if not initialized — safe to ignore
    }

    httpServer.close(async () => {
      // 2. Close BullMQ workers gracefully (finish in-progress jobs)
      await Promise.allSettled([
        inboundWorker.close(),
        aiWorker.close(),
        outboundWorker.close(),
        analyticsWorker.close(),
        webhookWorker.close(),
        bulkEmailWorker.close(),
      ]);
      logger.info('Queue workers closed');

      // 3. Close BullMQ queues (release Redis connections)
      await Promise.allSettled([
        inboundQueue.close(),
        aiQueue.close(),
        outboundQueue.close(),
        analyticsQueue.close(),
        webhookQueue.close(),
        bulkEmailQueue.close(),
        deadLetterQueue.close(),
      ]);
      logger.info('Queues closed');

      // 4. Disconnect database and Redis
      await prisma.$disconnect();
      await redis.quit();
      logger.info('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
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
