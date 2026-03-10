import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

let cachedSettings: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function getSiteSettings() {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 'singleton' },
    });
    cachedSettings = settings || {};
    cacheTimestamp = now;
    return cachedSettings;
  } catch {
    return {};
  }
}

// Clear the cache (called when admin updates settings)
export function clearSettingsCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}

/**
 * Settings middleware - populates req.settings with site & org config
 */
export async function settingsMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Populate site settings
    const siteSettings = await getSiteSettings();
    (req as any).siteSettings = siteSettings;

    // TODO: Populate org settings if orgId is in params
    // This can be extended based on specific requirements

    next();
  } catch (error) {
    // Don't block requests if settings fail to load
    (req as any).siteSettings = {};
    next();
  }
}
