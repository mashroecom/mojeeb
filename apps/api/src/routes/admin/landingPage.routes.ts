import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { landingPageService } from '../../services/landingPage.service';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// GET / — get landing page content
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const content = await landingPageService.get();
    res.json({ success: true, data: content });
  } catch (err) {
    next(err);
  }
});

// PATCH / — update landing page content
const updateSchema = z.object({
  heroTitle: z.string().optional(),
  heroTitleAr: z.string().optional(),
  heroSubtitle: z.string().optional(),
  heroSubtitleAr: z.string().optional(),
  heroCta: z.string().optional(),
  heroCtaAr: z.string().optional(),
  heroCtaLink: z.string().optional(),
  featuresTitle: z.string().optional(),
  featuresTitleAr: z.string().optional(),
  features: z.any().optional(),
  featuresAr: z.any().optional(),
  statsEnabled: z.boolean().optional(),
  testimonialsEnabled: z.boolean().optional(),
  testimonials: z.any().optional(),
  testimonialsAr: z.any().optional(),
  pricingTitle: z.string().optional(),
  pricingTitleAr: z.string().optional(),
  pricingSubtitle: z.string().optional(),
  pricingSubtitleAr: z.string().optional(),
  footerText: z.string().optional(),
  footerTextAr: z.string().optional(),
  customCss: z.string().max(50000).nullable().optional(),
});

router.patch(
  '/',
  validate({ body: updateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const content = await landingPageService.update(req.body);

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'UPDATE_LANDING_PAGE',
        targetType: 'LandingPageContent',
        targetId: 'singleton',
        metadata: { fields: Object.keys(req.body) },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: content });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
