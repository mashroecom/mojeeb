import { Worker, Job } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { moveToDeadLetterQueue } from '../dlq';

interface BulkEmailJobData {
  campaignId: string;
  email: string;
  firstName: string;
  subject: string;
  bodyHtml: string;
}

export const bulkEmailWorker = new Worker<BulkEmailJobData>(
  'bulk-email',
  async (job: Job<BulkEmailJobData>) => {
    const { campaignId, email, firstName, subject, bodyHtml } = job.data;

    try {
      // Dynamic import to avoid circular dependency issues at startup
      const { emailService } = await import('../../services/email.service');

      // Replace {{firstName}} placeholder if present
      const personalizedBody = bodyHtml.replace(/\{\{firstName\}\}/g, firstName || 'User');

      // Use sendCustomEmail which handles Resend client setup, from address,
      // and wraps content in the Mojeeb-branded email template
      await emailService.sendCustomEmail(email, subject, personalizedBody);

      // Increment sent count
      await prisma.bulkEmailCampaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } },
      });

      logger.debug({ campaignId, email }, 'Bulk email sent');
    } catch (err) {
      logger.error({ err, campaignId, email }, 'Failed to send bulk email');

      // Increment failed count
      await prisma.bulkEmailCampaign.update({
        where: { id: campaignId },
        data: { failedCount: { increment: 1 } },
      });

      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  },
);

bulkEmailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Bulk email sending failed');
  moveToDeadLetterQueue('bulk-email', job, err, 3);
});

bulkEmailWorker.on('error', (err) => {
  logger.error({ err }, 'Bulk email worker error');
});
