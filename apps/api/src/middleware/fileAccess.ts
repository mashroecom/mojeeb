import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { fileAccessService } from '../services/fileAccess.service';
import { tokenBlacklistService } from '../services/tokenBlacklist.service';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../config/logger';

interface VisitorTokenPayload {
  visitorId: string;
  filename: string;
  jti?: string;
  exp?: number;
}

export async function validateFileAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    // Extract filename from URL params
    const filename = (req.params as { filename?: string }).filename;
    if (!filename) {
      return next(new ForbiddenError('Filename is required'));
    }

    let userId: string | undefined;
    let visitorId: string | undefined;

    // Check for Bearer token (authenticated users)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = jwt.verify(token, config.jwt.secret) as {
          userId: string;
          email: string;
          jti?: string;
        };

        // Check if token has been revoked
        if (payload.jti && (await tokenBlacklistService.isBlacklisted(payload.jti))) {
          return next(new UnauthorizedError('Token has been revoked'));
        }

        userId = payload.userId;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          return next(new UnauthorizedError('Token expired', 'TOKEN_EXPIRED'));
        }
        // Don't fail here - might be using visitor token instead
        logger.debug({ err }, 'Bearer token validation failed, checking for visitor token');
      }
    }

    // Check for visitor token in query params (unauthenticated visitors)
    const visitorToken = (req.query as { token?: string }).token;
    if (visitorToken && !userId) {
      try {
        const payload = jwt.verify(visitorToken, config.jwt.secret) as VisitorTokenPayload;

        // Check if token has been revoked
        if (payload.jti && (await tokenBlacklistService.isBlacklisted(payload.jti))) {
          return next(new UnauthorizedError('Token has been revoked'));
        }

        // Verify the token is for this specific file
        if (payload.filename !== filename) {
          return next(new ForbiddenError('Token not valid for this file'));
        }

        visitorId = payload.visitorId;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          return next(new UnauthorizedError('File access token expired', 'TOKEN_EXPIRED'));
        }
        return next(new UnauthorizedError('Invalid file access token'));
      }
    }

    // Validate access using the service
    try {
      await fileAccessService.canAccessFile(filename, userId, visitorId);
      // Access granted, continue to file serving
      next();
    } catch (err) {
      // Service will throw ForbiddenError if access denied
      next(err);
    }
  } catch (err) {
    next(err);
  }
}
