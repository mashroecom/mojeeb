import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

/**
 * Authenticate requests using an API key passed via X-API-Key header.
 * Sets req.org and req.user (minimal) on success.
 */
export async function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    return next(new UnauthorizedError('Missing X-API-Key header'));
  }

  try {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const record = await prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      include: { org: { select: { id: true } } },
    });

    if (!record) {
      return next(new UnauthorizedError('Invalid API key'));
    }

    if (!record.userId) {
      return next(new UnauthorizedError('Invalid API key record'));
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      return next(new UnauthorizedError('API key has expired'));
    }

    // Set org context
    req.org = { id: record.orgId, role: 'API_KEY' };
    req.user = { userId: record.userId, email: '' };

    // Update last used timestamp (fire-and-forget)
    prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    // Store scopes on request for downstream checks
    (req as any).apiKeyScopes = record.scopes;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware to enforce API key scopes.
 * Use after apiKeyAuth. Allows wildcard '*' scope.
 *
 * @param requiredScope - The scope needed for this route (e.g. 'read', 'write', 'admin')
 */
export function requireScope(requiredScope: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const scopes: string[] = (req as any).apiKeyScopes;

    // If authenticated via JWT (no scopes), allow all
    if (!scopes) return next();

    if (scopes.includes('*') || scopes.includes(requiredScope)) {
      return next();
    }

    return next(new ForbiddenError(
      `API key missing required scope: ${requiredScope}`,
    ));
  };
}
