import crypto from 'crypto';
import type { Request } from 'express';
import { prisma } from '../config/database';
import { planConfigService } from '../services/planConfig.service';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import type { SubscriptionPlan } from '@mojeeb/shared-types';

/**
 * API-key authentication.
 *
 * Organizations create keys under Dashboard -> API Keys and send them exactly like
 * a session token: `Authorization: Bearer mj_...` (or `X-API-Key: mj_...`).
 * A key is a much narrower credential than a signed-in user:
 *
 *   - it works only on its own organization's resources (/organizations/<orgId>/...);
 *     never on account, admin, billing-independent or other organizations' routes;
 *   - it cannot manage API keys;
 *   - its scopes decide what it may do: without `write`/`admin`/`*` it is read-only,
 *     and it gets admin-level organization permissions only with `admin`/`*`
 *     (never owner-level: ownership actions need a signed-in owner);
 *   - the organization's plan must include API access.
 */

export const API_KEY_PREFIX = 'mj_';

export interface ApiKeyContext {
  id: string;
  orgId: string;
  userId: string;
  scopes: string[];
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyContext;
    }
  }
}

/** The raw API key carried by a request, if any. */
export function extractApiKey(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.substring(7).trim();
    if (token.startsWith(API_KEY_PREFIX)) return token;
  }
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.startsWith(API_KEY_PREFIX)) return xApiKey.trim();
  return null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function hasWriteScope(scopes: string[]): boolean {
  return scopes.includes('*') || scopes.includes('write') || scopes.includes('admin');
}

export function hasAdminScope(scopes: string[]): boolean {
  return scopes.includes('*') || scopes.includes('admin');
}

/**
 * Organization role an API key acts with: the role of the member who created it,
 * capped at ADMIN, and reduced to MEMBER unless the key has the admin scope.
 */
export function apiKeyRole(memberRole: string, scopes: string[]): string {
  if (!hasAdminScope(scopes)) return 'MEMBER';
  return memberRole === 'OWNER' ? 'ADMIN' : memberRole;
}

/**
 * Why an API key may not make this request, or null when it may.
 * `path` is the request path without the query string.
 */
export function apiKeyRequestDenial(
  key: Pick<ApiKeyContext, 'orgId' | 'scopes'>,
  method: string,
  path: string,
): string | null {
  const match = /^\/api\/v1\/organizations\/([^/]+)(\/.*)?$/.exec(path);
  if (!match || decodeURIComponent(match[1]!) !== key.orgId) {
    return "API keys can only access their own organization's resources";
  }

  const rest = match[2] ?? '';
  if (rest === '/api-keys' || rest.startsWith('/api-keys/')) {
    return 'API keys cannot be managed with an API key';
  }

  if (!SAFE_METHODS.has(method.toUpperCase()) && !hasWriteScope(key.scopes)) {
    return 'This API key is read-only';
  }

  return null;
}

/**
 * Authenticate a request by API key. Resolves to the key's context, or throws
 * Unauthorized (bad/revoked/expired key) or Forbidden (key not allowed here).
 */
export async function authenticateApiKey(req: Request, rawKey: string): Promise<ApiKeyContext> {
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const record = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    select: {
      id: true,
      orgId: true,
      userId: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      org: {
        select: { suspendedAt: true, subscription: { select: { plan: true, status: true } } },
      },
    },
  });

  // One message for unknown, revoked and expired keys: nothing to probe
  if (!record || (record.expiresAt && record.expiresAt < new Date())) {
    throw new UnauthorizedError('Invalid API key');
  }

  if (record.org.suspendedAt) {
    throw new ForbiddenError('Organization is suspended');
  }

  const context: ApiKeyContext = {
    id: record.id,
    orgId: record.orgId,
    userId: record.userId,
    scopes: record.scopes,
  };

  const path = (req.originalUrl || req.url).split('?')[0]!;
  const denial = apiKeyRequestDenial(context, req.method, path);
  if (denial) throw new ForbiddenError(denial);

  const plan = (record.org.subscription?.plan ?? 'FREE') as SubscriptionPlan;
  const limits = await planConfigService.getLimits(plan);
  if (!limits.apiAccess) {
    throw new ForbiddenError(
      'API access is not included in your current plan',
      'API_ACCESS_NOT_IN_PLAN',
    );
  }

  // Record usage at most once a minute per key (fire-and-forget)
  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
    prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return context;
}
