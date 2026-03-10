import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { validate } from '../../middleware/validate';
import { landingPageService } from '../../services/landingPage.service';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// Multer setup for landing page image uploads
const uploadDir = path.join(__dirname, '../../../public/uploads/landing');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `lp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

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
const updateSchema = z
  .object({
    // Hero
    heroEnabled: z.boolean().optional(),
    heroTitle: z.string().optional(),
    heroTitleAr: z.string().optional(),
    heroSubtitle: z.string().optional(),
    heroSubtitleAr: z.string().optional(),
    heroCta: z.string().optional(),
    heroCtaAr: z.string().optional(),
    heroCtaLink: z.string().optional(),
    heroImage: z.string().nullable().optional(),
    showNoCreditCard: z.boolean().optional(),
    badgeText: z.string().optional(),
    badgeTextAr: z.string().optional(),

    // Trusted By
    trustedByEnabled: z.boolean().optional(),
    trustedByTitle: z.string().optional(),
    trustedByTitleAr: z.string().optional(),
    trustedByLogos: z.any().optional(),

    // Features
    featuresEnabled: z.boolean().optional(),
    featuresTitle: z.string().optional(),
    featuresTitleAr: z.string().optional(),
    featuresSubtitle: z.string().optional(),
    featuresSubtitleAr: z.string().optional(),
    features: z.any().optional(),
    featuresAr: z.any().optional(),

    // Stats
    statsEnabled: z.boolean().optional(),
    statsCustomers: z.string().optional(),
    statsMessages: z.string().optional(),
    statsLanguages: z.string().optional(),
    statsUptime: z.string().optional(),

    // Pricing
    pricingEnabled: z.boolean().optional(),
    pricingTitle: z.string().optional(),
    pricingTitleAr: z.string().optional(),
    pricingSubtitle: z.string().optional(),
    pricingSubtitleAr: z.string().optional(),
    showYearlyToggle: z.boolean().optional(),
    yearlyDiscount: z.number().optional(),
    enterpriseCtaText: z.string().optional(),
    enterpriseCtaTextAr: z.string().optional(),
    enterpriseCtaLink: z.string().optional(),

    // Testimonials
    testimonialsEnabled: z.boolean().optional(),
    testimonialsTitle: z.string().optional(),
    testimonialsTitleAr: z.string().optional(),
    testimonialsSubtitle: z.string().optional(),
    testimonialsSubtitleAr: z.string().optional(),
    testimonialsMaxDisplay: z.number().optional(),
    testimonials: z.any().optional(),
    testimonialsAr: z.any().optional(),

    // FAQ
    faqEnabled: z.boolean().optional(),
    faqTitle: z.string().optional(),
    faqTitleAr: z.string().optional(),
    faqSubtitle: z.string().optional(),
    faqSubtitleAr: z.string().optional(),
    faqMaxDisplay: z.number().optional(),
    faqShowViewAll: z.boolean().optional(),

    // Bottom CTA
    bottomCtaEnabled: z.boolean().optional(),
    bottomCtaTitle: z.string().optional(),
    bottomCtaTitleAr: z.string().optional(),
    bottomCtaSubtitle: z.string().optional(),
    bottomCtaSubtitleAr: z.string().optional(),
    bottomCtaButtonText: z.string().optional(),
    bottomCtaButtonTextAr: z.string().optional(),
    bottomCtaButtonLink: z.string().optional(),

    // Footer
    footerCopyrightText: z.string().optional(),
    footerCopyrightTextAr: z.string().optional(),
    footerShowSocialLinks: z.boolean().optional(),
    footerTwitter: z.string().optional(),
    footerLinkedin: z.string().optional(),
    footerInstagram: z.string().optional(),
    footerFacebook: z.string().optional(),
    footerLinks: z.any().optional(),
    footerText: z.string().optional(),
    footerTextAr: z.string().optional(),
    customCss: z.string().max(50000).nullable().optional(),

    // SEO
    seoMetaTitle: z.string().optional(),
    seoMetaTitleAr: z.string().optional(),
    seoMetaDescription: z.string().optional(),
    seoMetaDescriptionAr: z.string().optional(),
    seoOgImage: z.string().nullable().optional(),
    seoGoogleAnalyticsId: z.string().optional(),
    seoCustomHeadCode: z.string().nullable().optional(),
    seoCustomFooterCode: z.string().nullable().optional(),
    seoFavicon: z.string().nullable().optional(),

    // Maintenance
    maintenanceEnabled: z.boolean().optional(),
    maintenanceTitle: z.string().optional(),
    maintenanceTitleAr: z.string().optional(),
    maintenanceMessage: z.string().optional(),
    maintenanceMessageAr: z.string().optional(),

    // Section order
    sectionOrder: z.any().optional(),
  })
  .passthrough();

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

// POST /upload — upload landing page images (hero, logos, og, favicon)
router.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const fileUrl = `/uploads/landing/${req.file.filename}`;
      res.json({ success: true, data: { url: fileUrl } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
