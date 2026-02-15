import { Queue } from 'bullmq';
import { redis } from '../config/redis';

const defaultOpts = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

export const inboundQueue = new Queue('inbound-messages', defaultOpts);
export const aiQueue = new Queue('ai-processing', defaultOpts);
export const outboundQueue = new Queue('outbound-messages', defaultOpts);
export const analyticsQueue = new Queue('analytics', {
  ...defaultOpts,
  defaultJobOptions: {
    ...defaultOpts.defaultJobOptions,
    attempts: 1, // Analytics events don't need retries
  },
});

export const webhookQueue = new Queue('webhook-dispatch', {
  ...defaultOpts,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 5000 }, // 5s, 10s, 20s, 40s, 80s
    removeOnComplete: { count: 2000 },
    removeOnFail: { count: 5000 },
  },
});

export const bulkEmailQueue = new Queue('bulk-email', {
  ...defaultOpts,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 3000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 2000 },
  },
});

export const deadLetterQueue = new Queue('dead-letter', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});
