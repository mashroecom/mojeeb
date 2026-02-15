import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { adminNotificationService } from '../../services/adminNotification.service';

const router: Router = Router();

// GET / — List notifications for the current admin user
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await adminNotificationService.list(userId, {
      page,
      limit,
      unreadOnly,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /unread-count — Get unread count for the current admin user
router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const count = await adminNotificationService.getUnreadCount(userId);
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/read — Mark a single notification as read
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const notification = await adminNotificationService.markAsRead(userId, id);

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
});

// POST /mark-all-read — Mark all notifications as read for the current admin user
router.post('/mark-all-read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const result = await adminNotificationService.markAllAsRead(userId);
    res.json({ success: true, data: { updated: result.count } });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — Delete a single notification
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const notification = await adminNotificationService.delete(userId, id);

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
});

export default router;
