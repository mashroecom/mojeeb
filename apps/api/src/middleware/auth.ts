import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/database';
import { tokenBlacklistService } from '../services/tokenBlacklist.service';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export interface JwtPayload {
  userId: string;
  email: string;
  jti?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      org?: {
        id: string;
        role: string;
      };
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid authorization header'));
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    if (payload.jti && await tokenBlacklistService.isBlacklisted(payload.jti)) {
      return next(new UnauthorizedError('Token has been revoked'));
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return next(err);
    }
    if (err instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Token expired', 'TOKEN_EXPIRED'));
    }
    return next(new UnauthorizedError('Invalid token'));
  }
}

export function orgContext(req: Request, _res: Response, next: NextFunction) {
  const orgId = (req.params as { orgId?: string }).orgId;
  if (!orgId || !req.user) {
    return next();
  }

  prisma.orgMembership
    .findUnique({
      where: {
        userId_orgId: {
          userId: req.user.userId,
          orgId,
        },
      },
    })
    .then((membership) => {
      if (!membership) {
        throw new ForbiddenError('Not a member of this organization');
      }
      req.org = { id: orgId, role: membership.role };
      next();
    })
    .catch(next);
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.org) {
      return next(new ForbiddenError('Organization context required'));
    }
    if (!roles.includes(req.org.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}
