import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import { moveToDeadLetterQueue } from '../dlq';
import { processOutboundJob } from './outbound.processor';
import type { OutboundJobData } from './outbound.processor';

export const outboundWorker = new Worker(
  'outbound-messages',
  async (job) => processOutboundJob(job.data as OutboundJobData, job.id),
  {
    connection: redis,
    concurrency: 10,
  },
);

outboundWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Outbound message sending failed');
  moveToDeadLetterQueue('outbound-messages', job, err, 3);
});

outboundWorker.on('error', (err) => {
  logger.error({ err }, 'Outbound worker error');
});
