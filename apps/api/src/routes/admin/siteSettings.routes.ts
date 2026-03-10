import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';
import { clearMaintenanceCache } from '../../middleware/maintenance';

const router: Router = Router();

// Multer config for logo/favicon uploads
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '../../../uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `site-${file.fieldname}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/png',
      'image/jpeg',
      'image/svg+xml',
      'image/webp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

const updateSchema = z.object({
  siteName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  keywords: z.string().max(500).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  twitterUrl: z.string().url().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  githubUrl: z.string().url().nullable().optional(),
  facebookUrl: z.string().url().nullable().optional(),
  instagramUrl: z.string().url().nullable().optional(),
  youtubeUrl: z.string().url().nullable().optional(),
  supportEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  companyAddress: z.string().max(500).nullable().optional(),
  copyrightText: z.string().max(200).nullable().optional(),
  timezone: z.string().max(50).optional(),
  googleAnalyticsId: z.string().max(30).nullable().optional(),
  customHeadScripts: z.string().max(5000).nullable().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).nullable().optional(),
  // Support chat widget
  supportChatEnabled: z.boolean().optional(),
  supportChatChannelId: z.string().max(100).nullable().optional(),
  supportChatPosition: z.enum(['left', 'right']).optional(),
  supportChatColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  supportChatWelcome: z.string().max(500).nullable().optional(),
  supportChatWelcomeAr: z.string().max(500).nullable().optional(),
});

// GET / - Get site settings
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

// PATCH / - Update site settings
router.patch(
  '/',
  validate({ body: updateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate supportChatChannelId if provided
      if (req.body.supportChatChannelId) {
        const channel = await prisma.channel.findUnique({
          where: { id: req.body.supportChatChannelId },
          select: { id: true, type: true, isActive: true },
        });

        if (!channel || channel.type !== 'WEBCHAT') {
          return res.status(400).json({
            success: false,
            error: 'This Integration ID is not valid or not connected to any Web Chat channel',
          });
        }

        if (!channel.isActive) {
          return res.status(400).json({
            success: false,
            error: 'This Web Chat channel is inactive. Please activate it first.',
          });
        }
      }

      const settings = await prisma.siteSettings.upsert({
        where: { id: 'singleton' },
        update: req.body,
        create: { id: 'singleton', ...req.body },
      });

      // Clear maintenance cache so changes take effect immediately
      clearMaintenanceCache();

      auditLogService
        .log({
          userId: req.user!.userId,
          action: 'SITE_SETTINGS_UPDATED',
          targetType: 'SiteSettings',
          targetId: 'singleton',
          metadata: req.body,
        })
        .catch(() => {});

      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  },
);

// POST /logo - Upload logo
router.post(
  '/logo',
  upload.single('logo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      const logoUrl = `/uploads/${req.file.filename}`;
      const settings = await prisma.siteSettings.upsert({
        where: { id: 'singleton' },
        update: { logoUrl },
        create: { id: 'singleton', logoUrl },
      });
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  },
);

// POST /favicon - Upload favicon
router.post(
  '/favicon',
  upload.single('favicon'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      const faviconUrl = `/uploads/${req.file.filename}`;
      const settings = await prisma.siteSettings.upsert({
        where: { id: 'singleton' },
        update: { faviconUrl },
        create: { id: 'singleton', faviconUrl },
      });
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  },
);

// POST /og-image - Upload OG image
router.post(
  '/og-image',
  upload.single('ogImage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      const ogImageUrl = `/uploads/${req.file.filename}`;
      const settings = await prisma.siteSettings.upsert({
        where: { id: 'singleton' },
        update: { ogImageUrl },
        create: { id: 'singleton', ogImageUrl },
      });
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
