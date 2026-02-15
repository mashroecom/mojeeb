import type { Job } from 'bullmq';
import { deadLetterQueue } from './index';
import { logger } from '../config/logger';

/**
 * Moves a job to the dead letter queue after all retry attempts are exhausted.
 * Call this from the worker's 'failed' event handler.
 */
export async function moveToDeadLetterQueue(
  queueName: string,
  job: Job | undefined,
  err: Error | undefined,
  maxAttempts: number,
): Promise<void> {
  if (!job || job.attemptsMade < maxAttempts) return;

  try {
    await deadLetterQueue.add(`dlq:${queueName}`, {
      originalQueue: queueName,
      jobId: job.id,
      jobName: job.name,
      data: job.data,
      error: err?.message,
      stack: err?.stack,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
    });
    logger.warn({ jobId: job.id, queue: queueName }, 'Job moved to dead letter queue');
  } catch (dlqErr) {
    logger.error({ jobId: job.id, err: dlqErr }, 'Failed to move job to DLQ');
  }
}
