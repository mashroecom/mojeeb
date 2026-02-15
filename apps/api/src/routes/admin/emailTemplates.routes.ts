import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { emailTemplateService } from '../../services/emailTemplate.service';
import { auditLogService } from '../../services/auditLog.service';
import { logger } from '../../config/logger';

const router: Router = Router();

// GET / — list all templates
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await emailTemplateService.list();
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

// GET /:key — get template by key
router.get('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await emailTemplateService.getByKey(String(req.params.key));
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// PUT /:key — upsert template
const upsertSchema = z.object({
  subject: z.string().min(1),
  subjectAr: z.string().optional(),
  bodyHtml: z.string().min(1),
  bodyHtmlAr: z.string().optional(),
  bodyText: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

router.put(
  '/:key',
  validate({ body: upsertSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = String(req.params.key);
      const template = await emailTemplateService.upsert({
        key,
        ...req.body,
      });

      await auditLogService.log({
        userId: (req as any).user.id,
        action: 'UPSERT_EMAIL_TEMPLATE',
        targetType: 'EmailTemplate',
        targetId: template.id,
        metadata: { key },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:key — delete template
router.delete('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = String(req.params.key);
    const existing = await emailTemplateService.getByKey(key);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    await emailTemplateService.delete(key);

    await auditLogService.log({
      userId: (req as any).user.id,
      action: 'DELETE_EMAIL_TEMPLATE',
      targetType: 'EmailTemplate',
      targetId: existing.id,
      metadata: { key },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /:key/preview — render template preview
const previewSchema = z.object({
  variables: z.record(z.string()).optional().default({}),
  locale: z.enum(['en', 'ar']).optional().default('en'),
});

router.post(
  '/:key/preview',
  validate({ body: previewSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rendered = await emailTemplateService.renderTemplate(
        String(req.params.key),
        req.body.variables ?? {},
        req.body.locale ?? 'en',
      );
      res.json({ success: true, data: rendered });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ success: false, error: err.message });
      }
      next(err);
    }
  },
);

// POST /seed — seed default templates
router.post('/seed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await emailTemplateService.seedDefaults();

    await auditLogService.log({
      userId: (req as any).user.id,
      action: 'SEED_EMAIL_TEMPLATES',
      targetType: 'EmailTemplate',
      targetId: 'seed',
      metadata: { count },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

export default router;
