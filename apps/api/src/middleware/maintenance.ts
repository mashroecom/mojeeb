import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

let cachedSettings: { maintenanceMode: boolean; maintenanceMessage: string | null } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds

async function getMaintenanceStatus() {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 'singleton' },
      select: { maintenanceMode: true, maintenanceMessage: true },
    });
    cachedSettings = settings || { maintenanceMode: false, maintenanceMessage: null };
    cacheTimestamp = now;
    return cachedSettings;
  } catch {
    return { maintenanceMode: false, maintenanceMessage: null };
  }
}

// Clear the cache (called when admin updates settings)
export function clearMaintenanceCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}

// Paths that bypass maintenance mode
const BYPASS_PATHS = [
  '/api/v1/auth',
  '/api/v1/admin',
  '/api/v1/public/site-settings',
  '/api/v1/public/landing-page',
  '/api/v1/public/feature-flags',
  '/widget.js',
  '/chat',
  '/uploads',
];

export async function maintenanceGuard(req: Request, res: Response, next: NextFunction) {
  // Always allow bypassed paths (admin, auth, widget, public settings)
  const path = req.path;
  if (BYPASS_PATHS.some((bp) => path.startsWith(bp))) {
    return next();
  }

  const status = await getMaintenanceStatus();
  if (!status.maintenanceMode) {
    return next();
  }

  res.status(503).json({
    success: false,
    error: 'Service Unavailable',
    message: status.maintenanceMessage || 'The site is currently under maintenance. Please try again later.',
  });
}
