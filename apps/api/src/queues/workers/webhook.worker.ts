import crypto from 'crypto';
import { Worker, Job } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { moveToDeadLetterQueue } from '../dlq';

interface WebhookJobData {
  webhookId: string;
  event: string;
  payload: unknown;
}

const worker = new Worker<WebhookJobData>(
  'webhook-dispatch',
  async (job: Job<WebhookJobData>) => {
    const { webhookId, event, payload } = job.data;

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook || !webhook.isActive) {
      logger.info({ webhookId, event }, 'Webhook inactive or deleted, skipping');
      return;
    }

    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');

    const startTime = Date.now();
    let res: globalThis.Response | undefined;
    let responseText: string | undefined;

    try {
      res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-Delivery': job.id ?? '',
        },
        body,
        signal: AbortSignal.timeout(15000),
      });

      // Read response text once for both logging and error checking
      responseText = await res.text().catch(() => undefined);
    } catch (fetchErr) {
      // Log failed delivery attempt
      const duration = Date.now() - startTime;
      try {
        await prisma.webhookLog.create({
          data: {
            webhookId,
            event,
            status: null,
            requestBody: body.substring(0, 5000),
            responseBody: null,
            duration,
            attempt: job.attemptsMade + 1,
            error: fetchErr instanceof Error ? fetchErr.message : 'Fetch failed',
            success: false,
          },
        });
      } catch (logErr) {
        // BUG FIX: log the failure instead of silently swallowing it
        logger.debug({ logErr, webhookId }, 'Failed to persist webhook delivery log');
      }
      throw fetchErr;
    }

    const duration = Date.now() - startTime;

    // Log the delivery attempt
    try {
      await prisma.webhookLog.create({
        data: {
          webhookId,
          event,
          status: res.status,
          requestBody: body.substring(0, 5000),
          responseBody: responseText?.substring(0, 2000) ?? null,
          duration,
          attempt: job.attemptsMade + 1,
          error: !res.ok ? `HTTP ${res.status}` : null,
          success: res.ok,
        },
      });
    } catch (logErr) {
      // BUG FIX: log the failure instead of silently swallowing it
      logger.debug({ logErr, webhookId }, 'Failed to persist webhook delivery log');
    }

    try {
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          lastTriggeredAt: new Date(),
          lastError: res.ok ? null : `HTTP ${res.status}`,
        },
      });
    } catch (updateErr) {
      logger.warn({ err: updateErr, webhookId }, 'Failed to update webhook lastTriggeredAt');
    }

    if (!res.ok) {
      throw new Error(`Webhook returned HTTP ${res.status}`);
    }

    logger.info(
      { webhookId, event, attempt: job.attemptsMade + 1 },
      'Webhook delivered successfully',
    );
  },
  {
    connection: redis,
    concurrency: 10,
    limiter: { max: 50, duration: 1000 }, // Max 50 webhook calls per second
  },
);

worker.on('failed', (job, err) => {
  if (job) {
    logger.warn(
      { webhookId: job.data.webhookId, event: job.data.event, attempt: job.attemptsMade, err: err.message },
      'Webhook delivery failed, will retry',
    );
    moveToDeadLetterQueue('webhook-dispatch', job, err, 5);
  }
});

worker.on('error', (err) => {
  logger.error({ err }, 'Webhook worker error');
});

export default worker;
