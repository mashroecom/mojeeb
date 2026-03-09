import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { featureFlagService } from '../services/featureFlag.service';
import { landingPageService } from '../services/landingPage.service';

const router: Router = Router();

// GET /site-settings - Public site settings (no auth)
router.get('/site-settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings) {
      return res.json({
        success: true,
        data: {
          siteName: 'Mojeeb',
          description: '',
          keywords: '',
          primaryColor: '#6366f1',
          logoUrl: null,
          faviconUrl: null,
          supportEmail: null,
          twitterUrl: null,
          linkedinUrl: null,
          facebookUrl: null,
          instagramUrl: null,
          githubUrl: null,
          supportChatEnabled: false,
          supportChatChannelId: null,
          supportChatPosition: 'right',
          supportChatColor: '#6366f1',
          supportChatWelcome: null,
          supportChatWelcomeAr: null,
        },
      });
    }

    // Only expose public-safe fields
    res.json({
      success: true,
      data: {
        siteName: settings.siteName,
        description: settings.description,
        keywords: settings.keywords,
        primaryColor: settings.primaryColor,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        supportEmail: settings.supportEmail,
        twitterUrl: settings.twitterUrl,
        linkedinUrl: settings.linkedinUrl,
        facebookUrl: settings.facebookUrl,
        instagramUrl: settings.instagramUrl,
        githubUrl: settings.githubUrl,
        supportChatEnabled: settings.supportChatEnabled,
        supportChatChannelId: settings.supportChatChannelId,
        supportChatPosition: settings.supportChatPosition,
        supportChatColor: settings.supportChatColor,
        supportChatWelcome: settings.supportChatWelcome,
        supportChatWelcomeAr: settings.supportChatWelcomeAr,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /plans - Public plans/pricing (no auth)
router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.planConfig.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        plan: true,
        displayName: true,
        displayNameAr: true,
        monthlyPrice: true,
        yearlyPrice: true,
        currency: true,
        messagesPerMonth: true,
        maxAgents: true,
        maxChannels: true,
        maxKnowledgeBases: true,
        maxTeamMembers: true,
        apiAccess: true,
        isPopular: true,
        features: true,
        featuresAr: true,
      },
    });

    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

// GET /feature-flags - Public feature flags (no auth)
router.get('/feature-flags', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const flags = await featureFlagService.getClientFlags();
    res.json({ success: true, data: flags });
  } catch (err) {
    next(err);
  }
});

// GET /landing-page - Public landing page content (no auth, cached 5min)
router.get('/landing-page', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const content = await landingPageService.get();
    // Cache for 5 minutes
    res.set('Cache-Control', 'public, max-age=300');

    // Check both LandingPage.maintenanceEnabled AND SiteSettings.maintenanceMode
    let isMaintenanceOn = content.maintenanceEnabled;
    let mTitle = content.maintenanceTitle;
    let mTitleAr = content.maintenanceTitleAr;
    let mMessage = content.maintenanceMessage;
    let mMessageAr = content.maintenanceMessageAr;

    if (!isMaintenanceOn) {
      // Also check SiteSettings.maintenanceMode (admin settings toggle)
      const siteSettings = await prisma.siteSettings.findUnique({
        where: { id: 'singleton' },
        select: { maintenanceMode: true, maintenanceMessage: true },
      });
      if (siteSettings?.maintenanceMode) {
        isMaintenanceOn = true;
        mMessage = siteSettings.maintenanceMessage || '';
        mMessageAr = siteSettings.maintenanceMessage || '';
      }
    }

    if (isMaintenanceOn) {
      return res.json({
        success: true,
        data: {
          maintenanceEnabled: true,
          maintenanceTitle: mTitle,
          maintenanceTitleAr: mTitleAr,
          maintenanceMessage: mMessage,
          maintenanceMessageAr: mMessageAr,
        },
      });
    }

    res.json({ success: true, data: content });
  } catch (err) {
    next(err);
  }
});

// GET /faq - Public FAQ
router.get('/faq', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const faqs = await prisma.fAQ.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: faqs });
  } catch (err) {
    next(err);
  }
});

// GET /testimonials - Public testimonials
router.get('/testimonials', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: testimonials });
  } catch (err) {
    next(err);
  }
});

// GET /legal/:type - Public legal content (privacy-policy or terms)
router.get('/legal/:type', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params;
    if (type !== 'privacy-policy' && type !== 'terms') {
      return res.status(400).json({ success: false, error: 'Invalid type.' });
    }

    const content = await prisma.legalContent.findUnique({
      where: { id: type },
    });

    if (!content) {
      return res.json({ success: true, data: { id: type, contentEn: '', contentAr: '', updatedAt: null } });
    }

    res.json({ success: true, data: content });
  } catch (err) {
    next(err);
  }
});

export default router;
