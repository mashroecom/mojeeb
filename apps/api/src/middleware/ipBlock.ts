import type { Request, Response, NextFunction } from 'express';
import { ipBlockService } from '../services/ipBlock.service';
import { logger } from '../config/logger';

/**
 * Middleware that checks if the requesting IP is blocked.
 * Skips admin panel paths and health endpoints so admins can always access their dashboard.
 */
export async function ipBlockGuard(req: Request, res: Response, next: NextFunction) {
  const path = req.path;

  // Skip check for admin panel routes (admins should never be blocked from their own panel)
  if (path.startsWith('/api/v1/admin')) {
    return next();
  }

  // Skip health endpoints
  if (path === '/api/v1/health' || path === '/health') {
    return next();
  }

  try {
    const ip = req.ip;
    if (ip && (await ipBlockService.isBlocked(ip))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
  } catch (err) {
    // If the check fails, allow the request through (fail-open)
    logger.warn({ err }, 'IP block check failed, allowing request');
  }

  next();
}
