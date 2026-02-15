import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminService } from '../../services/admin.service';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';

const bulkOrgIdsSchema = z.object({
  orgIds: z.array(z.string().min(1)).min(1).max(100),
});

const router: Router = Router();

// GET / - List organizations with pagination
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    const data = await adminService.listOrganizations({ page, limit, search, status });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /bulk-suspend - Bulk suspend organizations
router.post(
  '/bulk-suspend',
  validate({ body: bulkOrgIdsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgIds } = req.body as z.infer<typeof bulkOrgIdsSchema>;
      const data = await adminService.bulkSuspendOrgs(orgIds);

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ORGS_BULK_SUSPENDED',
        targetType: 'Organization',
        targetId: orgIds.join(','),
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /:orgId - Organization detail
router.get('/:orgId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params as { orgId: string };
    const data = await adminService.getOrganizationDetail(orgId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /:orgId/members - Organization members
router.get('/:orgId/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params as { orgId: string };
    const data = await adminService.getOrganizationMembers(orgId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /:orgId/suspend - Toggle organization suspension
router.patch('/:orgId/suspend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params as { orgId: string };
    const data = await adminService.toggleOrgSuspension(orgId);

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ORG_SUSPENDED',
      targetType: 'Organization',
      targetId: orgId,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /:orgId - Delete organization
router.delete('/:orgId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params as { orgId: string };
    const data = await adminService.deleteOrganization(orgId);

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ORG_DELETED',
      targetType: 'Organization',
      targetId: orgId,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
