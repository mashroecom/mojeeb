import { Router } from 'express';
import { deadLetterQueue } from '../../queues/index';
import { inboundQueue, aiQueue, outboundQueue, webhookQueue } from '../../queues/index';

const router: Router = Router();

const QUEUE_MAP: Record<string, typeof inboundQueue> = {
  'inbound-messages': inboundQueue,
  'ai-processing': aiQueue,
  'outbound-messages': outboundQueue,
  'webhook-dispatch': webhookQueue,
};

// GET /admin/dlq - List dead letter jobs
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const start = (page - 1) * limit;

    const jobs = await deadLetterQueue.getJobs(['waiting', 'delayed', 'completed', 'failed'], start, start + limit - 1);
    const total = await deadLetterQueue.getJobCounts();

    res.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        data: j.data,
        timestamp: j.timestamp,
      })),
      total: (total.waiting ?? 0) + (total.delayed ?? 0) + (total.completed ?? 0) + (total.failed ?? 0),
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/dlq/:id/retry - Retry a dead letter job
router.post('/:id/retry', async (req, res, next) => {
  try {
    const job = await deadLetterQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const originalQueue = QUEUE_MAP[job.data.originalQueue];
    if (!originalQueue) {
      return res.status(400).json({ error: `Unknown original queue: ${job.data.originalQueue}` });
    }

    await originalQueue.add(job.data.jobName || 'retry', job.data.data);
    await job.remove();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/dlq/:id - Discard a dead letter job
router.delete('/:id', async (req, res, next) => {
  try {
    const job = await deadLetterQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await job.remove();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
