import { Router } from 'express';
import { z } from 'zod';
import { notificationService } from '../services/notification.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';

interface OrgParams {
  orgId: string;
  [key: string]: string;
}

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// GET /api/v1/organizations/:orgId/notifications
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const userId = req.user!.userId;
    const { page, limit, unreadOnly } = req.query as Record<string, string>;
    const result = await notificationService.list(userId, orgId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/notifications/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const userId = req.user!.userId;
    const count = await notificationService.getUnreadCount(userId, orgId);
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/organizations/:orgId/notifications/:notificationId/read
router.patch('/:notificationId/read', async (req, res, next) => {
  try {
    const { notificationId } = req.params as OrgParams & { notificationId: string };
    const userId = req.user!.userId;
    await notificationService.markAsRead(userId, notificationId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/notifications/mark-all-read
router.post('/mark-all-read', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const userId = req.user!.userId;
    await notificationService.markAllAsRead(userId, orgId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/organizations/:orgId/notifications/:notificationId
router.delete('/:notificationId', async (req, res, next) => {
  try {
    const { notificationId } = req.params as OrgParams & { notificationId: string };
    const userId = req.user!.userId;
    await notificationService.delete(userId, notificationId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/notifications/preferences
router.get('/preferences', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const userId = req.user!.userId;
    const preferences = await notificationService.getPreferences(userId, orgId);
    res.json({ success: true, data: preferences });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/organizations/:orgId/notifications/preferences
router.put(
  '/preferences',
  validate({
    body: z.object({
      emailNewConversation: z.boolean().optional(),
      emailHandoff: z.boolean().optional(),
      emailLeadExtracted: z.boolean().optional(),
      emailUsageWarning: z.boolean().optional(),
      emailWeeklyDigest: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const userId = req.user!.userId;
      const {
        emailNewConversation,
        emailHandoff,
        emailLeadExtracted,
        emailUsageWarning,
        emailWeeklyDigest,
      } = req.body;
      const preferences = await notificationService.updatePreferences(userId, orgId, {
        emailNewConversation,
        emailHandoff,
        emailLeadExtracted,
        emailUsageWarning,
        emailWeeklyDigest,
      });
      res.json({ success: true, data: preferences });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
