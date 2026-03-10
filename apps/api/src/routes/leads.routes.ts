import { Router } from 'express';
import { z } from 'zod';
import { leadsService } from '../services/leads.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { prisma } from '../config/database';

interface OrgParams {
  orgId: string;
  [key: string]: string;
}

const VALID_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'] as const;

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// GET /api/v1/organizations/:orgId/leads
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const { page, limit, status, search } = req.query as Record<string, string>;
    const result = await leadsService.list(orgId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status || undefined,
      search: search || undefined,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/leads
const createLeadSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(VALID_LEAD_STATUSES).optional(),
});

router.post('/', validate({ body: createLeadSchema }), async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const lead = await leadsService.create(orgId, req.body);
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/leads/stats
router.get('/stats', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const stats = await leadsService.getStats(orgId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/leads/:leadId
router.get('/:leadId', async (req, res, next) => {
  try {
    const { orgId, leadId } = req.params as OrgParams & { leadId: string };
    const lead = await leadsService.getById(orgId, leadId);
    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/organizations/:orgId/leads/:leadId
const updateLeadSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(VALID_LEAD_STATUSES).optional(),
});

router.patch('/:leadId', validate({ body: updateLeadSchema }), async (req, res, next) => {
  try {
    const { orgId, leadId } = req.params as OrgParams & { leadId: string };
    const lead = await leadsService.update(orgId, leadId, req.body);
    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/organizations/:orgId/leads/:leadId/status
router.patch(
  '/:leadId/status',
  validate({
    body: z.object({
      status: z.enum(VALID_LEAD_STATUSES),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, leadId } = req.params as OrgParams & { leadId: string };
      const { status } = req.body;
      const lead = await leadsService.updateStatus(orgId, leadId, status);
      res.json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/organizations/:orgId/leads/:leadId/assign
router.patch(
  '/:leadId/assign',
  validate({
    body: z.object({
      assignedTo: z.string().uuid().nullable().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, leadId } = req.params as OrgParams & { leadId: string };
      const { assignedTo } = req.body;

      const lead = await leadsService.getById(orgId, leadId);

      // If assigning to someone, verify they're in the org
      if (assignedTo) {
        const membership = await prisma.orgMembership.findUnique({
          where: { userId_orgId: { userId: assignedTo, orgId } },
        });
        if (!membership) {
          return res
            .status(400)
            .json({ success: false, error: 'User is not a member of this organization' });
        }
      }

      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: { assignedTo: assignedTo || null },
        include: {
          conversation: { select: { id: true, customerName: true } },
          assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/organizations/:orgId/leads/:leadId/activities
router.get('/:leadId/activities', async (req, res, next) => {
  try {
    const { orgId, leadId } = req.params as OrgParams & { leadId: string };
    // Verify lead belongs to org
    await leadsService.getById(orgId, leadId);

    const activities = await prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: activities });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/leads/:leadId/activities
router.post(
  '/:leadId/activities',
  validate({
    body: z.object({
      action: z.string().min(1).max(200).trim(),
      metadata: z.record(z.unknown()).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, leadId } = req.params as OrgParams & { leadId: string };
      const { action, metadata } = req.body;
      // Verify lead belongs to org
      await leadsService.getById(orgId, leadId);

      const activity = await prisma.leadActivity.create({
        data: {
          leadId,
          userId: (req as any).user?.userId || null,
          action,
          metadata: metadata || undefined,
        },
      });
      res.status(201).json({ success: true, data: activity });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/organizations/:orgId/leads/:leadId
router.delete('/:leadId', async (req, res, next) => {
  try {
    const { orgId, leadId } = req.params as OrgParams & { leadId: string };
    await leadsService.delete(orgId, leadId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

export default router;
