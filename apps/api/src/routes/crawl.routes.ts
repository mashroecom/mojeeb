import { Router } from 'express';
import { knowledgeBaseService } from '../services/knowledgeBase.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { MAX_URL_PATTERNS, MAX_URL_PATTERN_LENGTH } from '../utils/urlPatterns';

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
      startUrl: z.string().url().max(2000),
      maxDepth: z.number().int().min(1).max(5).optional(),
      // URL filters: only links matching one of them are followed (see utils/urlPatterns)
      urlPatterns: z.array(z.string().max(MAX_URL_PATTERN_LENGTH)).max(MAX_URL_PATTERNS).optional(),
      // Comma-separated form of the same thing, accepted for older clients
      urlPattern: z.string().max(2000).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, kbId } = req.params as CrawlParams;
      // Verify KB belongs to org
      await knowledgeBaseService.getById(orgId, kbId);
      // startCrawlJob creates the job row AND enqueues it for the crawler worker
      const crawlJob = await knowledgeBaseService.startCrawlJob(kbId, req.body);
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

// NOTE: the /schedule routes must stay above /:jobId, otherwise "schedule" is
// matched as a job id and every schedule request answers "Crawl job not found".
// POST /api/v1/organizations/:orgId/knowledge-bases/:kbId/crawl/schedule
router.post(
  '/schedule',
  validate({
    body: z.object({
      // What gets re-crawled (site, depth, URL filter) is taken from the
      // knowledge base's latest crawl, not from this request.
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
      enabled: z.boolean(),
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
    const cancelled = await knowledgeBaseService.cancelCrawlJob(jobId);
    res.json({ success: true, data: cancelled });
  } catch (err) {
    next(err);
  }
});

export default router;
