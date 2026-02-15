import { Router } from 'express';
import { z } from 'zod';
import { apiKeyService } from '../services/apiKey.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';

interface OrgParams { orgId: string; [key: string]: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).optional(),
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
