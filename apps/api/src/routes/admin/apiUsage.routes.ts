import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

const router: Router = Router();

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A usable key with no request in this many days counts as inactive */
const INACTIVE_THRESHOLD_DAYS = 30;
const TOP_ORGS_LIMIT = 10;
const RECENT_ACTIVITY_LIMIT = 10;

type KeyStatus = 'active' | 'expired' | 'revoked';

function keyStatus(key: { revokedAt: Date | null; expiresAt: Date | null }, now: Date): KeyStatus {
  if (key.revokedAt) return 'revoked';
  if (key.expiresAt && key.expiresAt.getTime() < now.getTime()) return 'expired';
  return 'active';
}

// GET /stats - API key usage overview.
// The schema records one `lastUsedAt` timestamp per key (no per-request log), so usage is
// expressed as "keys used within a window" rather than request counts.
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const inactiveCutoff = new Date(now.getTime() - INACTIVE_THRESHOLD_DAYS * DAY_MS);

    // Usable = not revoked and not past its expiry date
    const usable: Prisma.ApiKeyWhereInput = {
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    };

    const [
      totalKeys,
      revokedKeys,
      expiredKeys,
      usableKeys,
      activeKeys,
      neverUsedKeys,
      usedLast24h,
      usedLast7d,
      orgGroups,
      recentKeys,
    ] = await Promise.all([
      prisma.apiKey.count(),
      prisma.apiKey.count({ where: { revokedAt: { not: null } } }),
      prisma.apiKey.count({ where: { revokedAt: null, expiresAt: { lt: now } } }),
      prisma.apiKey.count({ where: usable }),
      prisma.apiKey.count({ where: { ...usable, lastUsedAt: { gte: inactiveCutoff } } }),
      prisma.apiKey.count({ where: { ...usable, lastUsedAt: null } }),
      prisma.apiKey.count({ where: { lastUsedAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
      prisma.apiKey.count({
        where: { lastUsedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
      }),
      prisma.apiKey.groupBy({
        by: ['orgId'],
        _count: { _all: true },
        _max: { lastUsedAt: true },
        orderBy: [{ _count: { orgId: 'desc' } }, { orgId: 'asc' }],
        take: TOP_ORGS_LIMIT,
      }),
      prisma.apiKey.findMany({
        where: { lastUsedAt: { not: null } },
        orderBy: { lastUsedAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          org: { select: { id: true, name: true } },
        },
      }),
    ]);

    const topOrgIds = orgGroups.map((g) => g.orgId);
    const [orgs, usableByOrg] = await Promise.all([
      topOrgIds.length > 0
        ? prisma.organization.findMany({
            where: { id: { in: topOrgIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      topOrgIds.length > 0
        ? prisma.apiKey.groupBy({
            by: ['orgId'],
            where: { ...usable, orgId: { in: topOrgIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
    const orgNames = new Map(orgs.map((o) => [o.id, o.name]));
    const usableCounts = new Map(usableByOrg.map((g) => [g.orgId, g._count._all]));

    res.json({
      success: true,
      data: {
        totalKeys,
        // Usable keys that made at least one request in the last INACTIVE_THRESHOLD_DAYS days
        activeKeys,
        // Usable keys with no request in that window (includes keys never used)
        inactiveKeys: usableKeys - activeKeys,
        revokedKeys,
        expiredKeys,
        neverUsedKeys,
        usedLast24h,
        usedLast7d,
        inactiveThresholdDays: INACTIVE_THRESHOLD_DAYS,
        topOrgs: orgGroups.map((g) => ({
          orgId: g.orgId,
          orgName: orgNames.get(g.orgId) ?? null,
          keyCount: g._count._all,
          usableKeyCount: usableCounts.get(g.orgId) ?? 0,
          lastUsedAt: g._max.lastUsedAt,
        })),
        recentActivity: recentKeys.map((key) => ({
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          scopes: key.scopes,
          orgId: key.org.id,
          orgName: key.org.name,
          lastUsedAt: key.lastUsedAt,
          status: keyStatus(key, now),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
