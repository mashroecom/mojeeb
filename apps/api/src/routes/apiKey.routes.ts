import { Router } from 'express';
import { z } from 'zod';
import { apiKeyService } from '../services/apiKey.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { prisma } from '../config/database';
import { planConfigService } from '../services/planConfig.service';
import { ForbiddenError } from '../utils/errors';
import type { SubscriptionPlan } from '@mojeeb/shared-types';

interface OrgParams {
  orgId: string;
  [key: string]: string;
}

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).optional(),
});

/** Whether the organization's plan includes API access (keys only work if it does). */
async function getApiAccess(orgId: string): Promise<{ apiAccess: boolean; plan: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { orgId },
    select: { plan: true },
  });
  const plan = (subscription?.plan ?? 'FREE') as SubscriptionPlan;
  const limits = await planConfigService.getLimits(plan);
  return { apiAccess: Boolean(limits.apiAccess), plan };
}

// GET /api/v1/organizations/:orgId/api-keys/access
// Lets the dashboard explain up front when the plan does not include API access
router.get('/access', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    res.json({ success: true, data: await getApiAccess(orgId) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/api-keys
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const keys = await apiKeyService.list(orgId);
    res.json({ success: true, data: keys });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/api-keys
router.post('/', validate({ body: createApiKeySchema }), async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const { name, scopes } = req.body;

    // A key that can never authenticate is worse than no key: refuse to create one
    // on a plan without API access (the same rule is enforced when a key is used)
    const { apiAccess } = await getApiAccess(orgId);
    if (!apiAccess) {
      throw new ForbiddenError(
        'API access is not included in your current plan',
        'API_ACCESS_NOT_IN_PLAN',
      );
    }
    const result = await apiKeyService.create({
      name: name || 'Untitled Key',
      orgId,
      userId: req.user!.userId,
      scopes,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/organizations/:orgId/api-keys/:keyId
router.delete('/:keyId', async (req, res, next) => {
  try {
    const { orgId, keyId } = req.params as OrgParams & { keyId: string };
    await apiKeyService.revoke(keyId, orgId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
