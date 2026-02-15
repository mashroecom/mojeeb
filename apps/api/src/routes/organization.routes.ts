import { Router } from 'express';
import { z } from 'zod';
import { organizationService } from '../services/organization.service';
import { authenticate, orgContext, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

interface OrgParams { orgId: string; [key: string]: string; }
interface MemberParams extends OrgParams { memberId: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// GET /api/v1/organizations/:orgId
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const org = await organizationService.getById(orgId);
    res.json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/organizations/:orgId
router.patch(
  '/',
  validate({
    body: z.object({
      name: z.string().min(1).max(200).trim().optional(),
      slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
      websiteUrl: z.string().url().max(500).optional().or(z.literal('')),
      timezone: z.string().max(100).optional(),
      defaultLanguage: z.string().max(10).optional(),
    }).refine((d) => Object.values(d).some(v => v !== undefined), {
      message: 'At least one field is required',
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const org = await organizationService.update(orgId, req.body);
      res.json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/organizations/:orgId/members
router.get('/members', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const members = await organizationService.listMembers(orgId);
    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/members/invite
router.post(
  '/members/invite',
  requireRole('OWNER', 'ADMIN'),
  validate({
    body: z.object({
      email: z.string().email().max(254).trim().toLowerCase(),
      role: z.enum(['ADMIN', 'MEMBER']),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const { email, role } = req.body;
      const member = await organizationService.inviteMember(orgId, email, role, req.user!.userId);
      res.status(201).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/organizations/:orgId/members/:memberId/role
router.patch(
  '/members/:memberId/role',
  requireRole('OWNER', 'ADMIN'),
  validate({
    body: z.object({
      role: z.enum(['ADMIN', 'MEMBER']),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, memberId } = req.params as MemberParams;
      const { role } = req.body;
      const member = await organizationService.updateMemberRole(orgId, memberId, role, req.org!.role);
      res.json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/organizations/:orgId/members/:memberId
router.delete('/members/:memberId', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { orgId, memberId } = req.params as MemberParams;
    const result = await organizationService.removeMember(orgId, memberId, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/members/transfer-ownership
router.post('/members/transfer-ownership', requireRole('OWNER'), async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const { membershipId } = req.body;
    const result = await organizationService.transferOwnership(orgId, membershipId, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/organizations/:orgId
router.delete('/', requireRole('OWNER'), async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const result = await organizationService.deleteOrganization(orgId, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
