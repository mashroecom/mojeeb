import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { bulkEmailService } from '../../services/bulkEmail.service';

const router: Router = Router();

const createSchema = z.object({
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  targetFilter: z.object({
    plan: z.string().optional(),
    status: z.string().optional(),
    emailVerified: z.boolean().optional(),
  }).optional().default({}),
});

const recipientCountSchema = z.object({
  plan: z.string().optional(),
  status: z.string().optional(),
  emailVerified: z.coerce.boolean().optional(),
});

// GET / — list campaigns
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await bulkEmailService.list({ page, limit });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /recipient-count — preview recipient count for a filter
router.get(
  '/recipient-count',
  validate({ query: recipientCountSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = (req as any).validatedQuery;
      const count = await bulkEmailService.getRecipientCount(filter);
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — get campaign detail
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await bulkEmailService.getById(String(req.params.id));
    res.json({ success: true, data: campaign });
  } catch (err: any) {
    if (err.message === 'Campaign not found') {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
});

// POST / — create campaign
router.post(
  '/',
  validate({ body: createSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await bulkEmailService.create({
        ...req.body,
        createdBy: req.user!.userId,
      });
      res.status(201).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/send — start sending campaign
router.post('/:id/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await bulkEmailService.send(String(req.params.id));
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('DRAFT')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

// POST /:id/cancel — cancel campaign
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await bulkEmailService.cancel(String(req.params.id));
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'Campaign not found') {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
});

export default router;
