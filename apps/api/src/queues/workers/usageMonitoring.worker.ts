import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import { usageAlertService } from '../../services/usageAlert.service';
import { moveToDeadLetterQueue } from '../dlq';

/**
 * Usage Monitoring Worker
 *
 * Periodically checks all active subscriptions for AI conversation usage
 * and sends alerts when usage exceeds thresholds (80% and 100%).
 *
 * Designed to run every hour via a repeatable job.
 */
export const usageMonitoringWorker = new Worker(
  'usage-monitoring',
  async (job) => {
    logger.info({ jobId: job.id }, 'Starting usage monitoring check');

    try {
      // Check all subscriptions and send alerts where needed
      const alertsSent = await usageAlertService.checkAllSubscriptionsAndSendAlerts();

      logger.info(
        { jobId: job.id, alertsSent },
        'Usage monitoring check completed',
      );

      return { alertsSent, timestamp: new Date().toISOString() };
    } catch (err) {
      logger.error({ jobId: job.id, err }, 'Usage monitoring check failed');
      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 1, // Only one usage monitoring job should run at a time
  }
);

usageMonitoringWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Usage monitoring job failed');
  moveToDeadLetterQueue('usage-monitoring', job, err, 3);
});

usageMonitoringWorker.on('error', (err) => {
  logger.error({ err }, 'Usage monitoring worker error');
});

usageMonitoringWorker.on('completed', (job, result) => {
  logger.info(
    { jobId: job.id, alertsSent: result?.alertsSent },
    'Usage monitoring job completed successfully',
  );
});
