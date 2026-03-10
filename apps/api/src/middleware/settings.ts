import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

// Cache settings to avoid repeated database queries
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

// Middleware to attach site settings to request object
export async function settingsMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    (req as any).siteSettings = await getSiteSettings();
    next();
  } catch (error) {
    // Don't block requests if settings fetch fails
    (req as any).siteSettings = {};
    next();
  }
}
