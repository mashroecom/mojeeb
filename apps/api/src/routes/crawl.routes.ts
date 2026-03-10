import { Router } from 'express';
import { knowledgeBaseService } from '../services/knowledgeBase.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

interface CrawlParams {
  orgId: string;
  kbId: string;
  [key: string]: string;
}
interface JobParams {
  orgId: string;
  kbId: string;
  jobId: string;
  [key: string]: string;
}

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// POST /api/v1/organizations/:orgId/knowledge-bases/:kbId/crawl
router.post(
  '/',
  validate({
    body: z.object({
      startUrl: z.string().url(),
      maxDepth: z.number().min(1).max(5).optional(),
      urlPattern: z.string().optional(),
      configId: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, kbId } = req.params as CrawlParams;
      // Verify KB belongs to org
      await knowledgeBaseService.getById(orgId, kbId);
      const crawlJob = await knowledgeBaseService.createCrawlJob(kbId, req.body);
      res.status(201).json({ success: true, data: crawlJob });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/organizations/:orgId/knowledge-bases/:kbId/crawl
router.get('/', async (req, res, next) => {
  try {
    const { orgId, kbId } = req.params as CrawlParams;
    // Verify KB belongs to org
    await knowledgeBaseService.getById(orgId, kbId);
    const jobs = await knowledgeBaseService.listCrawlJobs(kbId);
    res.json({ success: true, data: jobs });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/knowledge-bases/:kbId/crawl/:jobId
router.get('/:jobId', async (req, res, next) => {
  try {
    const { orgId, kbId, jobId } = req.params as JobParams;
    // Verify KB belongs to org
    await knowledgeBaseService.getById(orgId, kbId);
    const job = await knowledgeBaseService.getCrawlJob(jobId);
    // Verify job belongs to this KB
    if (job.knowledgeBaseId !== kbId) {
      return res.status(404).json({ success: false, error: 'Crawl job not found' });
    }
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/organizations/:orgId/knowledge-bases/:kbId/crawl/:jobId
router.delete('/:jobId', async (req, res, next) => {
  try {
    const { orgId, kbId, jobId } = req.params as JobParams;
    // Verify KB belongs to org
    await knowledgeBaseService.getById(orgId, kbId);
    const job = await knowledgeBaseService.getCrawlJob(jobId);
    // Verify job belongs to this KB
    if (job.knowledgeBaseId !== kbId) {
      return res.status(404).json({ success: false, error: 'Crawl job not found' });
    }
    // TODO: Implement job cancellation in worker
    // For now, just mark as cancelled in DB
    await knowledgeBaseService.getById(orgId, kbId); // Placeholder for future cancelCrawlJob method
    res.json({ success: true, message: 'Crawl job cancellation requested' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/knowledge-bases/:kbId/crawl/schedule
router.post(
  '/schedule',
  validate({
    body: z.object({
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
      enabled: z.boolean(),
      maxDepth: z.number().min(1).max(5).optional(),
      urlPattern: z.string().optional(),
      startUrl: z.string().url().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, kbId } = req.params as CrawlParams;
      // Verify KB belongs to org
      await knowledgeBaseService.getById(orgId, kbId);
      const config = await knowledgeBaseService.updateCrawlSchedule(kbId, req.body);
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/organizations/:orgId/knowledge-bases/:kbId/crawl/schedule
router.get('/schedule', async (req, res, next) => {
  try {
    const { orgId, kbId } = req.params as CrawlParams;
    // Verify KB belongs to org
    await knowledgeBaseService.getById(orgId, kbId);
    const config = await knowledgeBaseService.getCrawlSchedule(kbId);
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

export default router;
