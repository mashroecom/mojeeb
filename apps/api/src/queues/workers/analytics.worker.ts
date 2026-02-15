import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

interface AnalyticsJobData {
  orgId: string;
  eventType: string;
  data: Record<string, unknown>;
  channelType?: string;
  agentId?: string;
}

export const analyticsWorker = new Worker(
  'analytics',
  async (job) => {
    const data = job.data as AnalyticsJobData;

    await prisma.analyticsEvent.create({
      data: {
        orgId: data.orgId,
        eventType: data.eventType as any,
        data: data.data as any,
        channelType: data.channelType as any,
        agentId: data.agentId,
        date: new Date(),
      },
    });
  },
  {
    connection: redis,
    concurrency: 20,
  }
);

analyticsWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Analytics event processing failed');
});

analyticsWorker.on('error', (err) => {
  logger.error({ err }, 'Analytics worker error');
});
