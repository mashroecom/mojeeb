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
          githubUrl: null,
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
        githubUrl: settings.githubUrl,
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
    res.json({ success: true, data: content });
  } catch (err) {
    next(err);
  }
});

export default router;
