import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { adminService } from '../../services/admin.service';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { emailQueue } from '../../queues';
import { NotFoundError } from '../../utils/errors';
import argon2 from 'argon2';

const bulkUserIdsSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100),
});

const sendEmailSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  newPassword: z.string().min(8).max(100).optional(),
});

const router: Router = Router();

// GET / - List all users with pagination
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    const data = await adminService.listUsers({ page, limit, search, status });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /bulk-suspend - Bulk suspend users
router.post(
  '/bulk-suspend',
  validate({ body: bulkUserIdsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds } = req.body as z.infer<typeof bulkUserIdsSchema>;
      const data = await adminService.bulkSuspendUsers(userIds);

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'USERS_BULK_SUSPENDED',
        targetType: 'User',
        targetId: userIds.join(','),
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// POST /bulk-delete - Bulk delete users
router.post(
  '/bulk-delete',
  validate({ body: bulkUserIdsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds } = req.body as z.infer<typeof bulkUserIdsSchema>;
      const data = await adminService.bulkDeleteUsers(userIds);

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'USERS_BULK_DELETED',
        targetType: 'User',
        targetId: userIds.join(','),
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// POST /bulk-unsuspend - Bulk unsuspend users
router.post(
  '/bulk-unsuspend',
  validate({ body: bulkUserIdsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds } = req.body as z.infer<typeof bulkUserIdsSchema>;
      const data = await adminService.bulkUnsuspendUsers(userIds);

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'USERS_BULK_UNSUSPENDED',
        targetType: 'User',
        targetId: userIds.join(','),
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// GET /:userId - Get user detail
router.get('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const data = await adminService.getUserDetail(userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /:userId/suspend - Toggle user suspension
router.patch('/:userId/suspend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const data = await adminService.toggleUserSuspension(userId);

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'USER_SUSPENDED',
      targetType: 'User',
      targetId: userId,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /:userId - Delete user
router.delete('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const data = await adminService.deleteUser(userId);

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'USER_DELETED',
      targetType: 'User',
      targetId: userId,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /:userId/toggle-superadmin - Toggle superadmin role
router.patch(
  '/:userId/toggle-superadmin',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      // Prevent self-demotion
      if (userId === req.user!.userId) {
        return res
          .status(400)
          .json({ success: false, error: 'Cannot modify your own superadmin status' });
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isSuperAdmin: true },
      });
      if (!user) throw new NotFoundError('User not found');

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isSuperAdmin: !user.isSuperAdmin },
        select: { id: true, isSuperAdmin: true },
      });

      auditLogService
        .log({
          userId: req.user!.userId,
          action: updated.isSuperAdmin ? 'USER_PROMOTED_SUPERADMIN' : 'USER_DEMOTED_SUPERADMIN',
          targetType: 'User',
          targetId: userId,
        })
        .catch(() => {});

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// POST /:userId/reset-password - Send password reset email
router.post('/:userId/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundError('User not found');

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: userId },
      data: { resetPasswordToken: resetToken, resetPasswordExpires: expires },
    });

    await emailQueue.add('passwordReset', { type: 'passwordReset', to: user.email, resetToken });

    auditLogService
      .log({
        userId: req.user!.userId,
        action: 'USER_PASSWORD_RESET_SENT',
        targetType: 'User',
        targetId: userId,
      })
      .catch(() => {});

    res.json({ success: true, data: { message: 'Password reset email sent' } });
  } catch (err) {
    next(err);
  }
});

// POST /:userId/send-email - Send custom email to user
router.post(
  '/:userId/send-email',
  validate({ body: sendEmailSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      const { subject, body: emailBody } = req.body as z.infer<typeof sendEmailSchema>;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true },
      });
      if (!user) throw new NotFoundError('User not found');

      await emailQueue.add('custom', {
        type: 'custom',
        to: user.email,
        subject,
        body: emailBody,
        firstName: user.firstName,
      });

      auditLogService
        .log({
          userId: req.user!.userId,
          action: 'USER_EMAIL_SENT',
          targetType: 'User',
          targetId: userId,
          metadata: { subject },
        })
        .catch(() => {});

      res.json({ success: true, data: { message: 'Email sent' } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /:userId/impersonate - Generate short-lived token for user
router.post('/:userId/impersonate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, isSuperAdmin: true },
    });
    if (!user) throw new NotFoundError('User not found');

    // Generate a short-lived access token (1 hour)
    const token = jwt.sign(
      { userId: user.id, email: user.email, impersonatedBy: req.user!.userId },
      config.jwt.secret,
      { expiresIn: '1h' },
    );

    auditLogService
      .log({
        userId: req.user!.userId,
        action: 'USER_IMPERSONATED',
        targetType: 'User',
        targetId: userId,
      })
      .catch(() => {});

    res.json({
      success: true,
      data: {
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /:userId/profile - Update user profile (name, email)
router.patch(
  '/:userId/profile',
  validate({ body: updateProfileSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };
      const updates = req.body as z.infer<typeof updateProfileSchema>;

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) throw new NotFoundError('User not found');

      // If email is being changed, check for duplicates
      if (updates.email) {
        const existing = await prisma.user.findFirst({
          where: { email: updates.email, id: { not: userId } },
          select: { id: true },
        });
        if (existing) {
          return res.status(400).json({ success: false, error: 'Email already in use' });
        }
      }

      // Build update data, handle password separately
      const { newPassword, ...profileUpdates } = updates;
      const data: Record<string, unknown> = { ...profileUpdates };
      if (newPassword) {
        data.passwordHash = await argon2.hash(newPassword);
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      auditLogService
        .log({
          userId: req.user!.userId,
          action: newPassword ? 'USER_PASSWORD_CHANGED' : 'USER_PROFILE_UPDATED',
          targetType: 'User',
          targetId: userId,
          metadata: { ...profileUpdates, passwordChanged: !!newPassword },
        })
        .catch(() => {});

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// POST /:userId/verify-email - Manually verify user email
router.post('/:userId/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailVerified: true },
    });
    if (!user) throw new NotFoundError('User not found');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: !user.emailVerified },
      select: { id: true, emailVerified: true },
    });

    auditLogService
      .log({
        userId: req.user!.userId,
        action: updated.emailVerified ? 'USER_EMAIL_VERIFIED' : 'USER_EMAIL_UNVERIFIED',
        targetType: 'User',
        targetId: userId,
      })
      .catch(() => {});

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /:userId/api-keys - List user's API keys
router.get('/:userId/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const where = { userId };
    const [keys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
          org: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.apiKey.count({ where }),
    ]);

    res.json({
      success: true,
      data: { keys, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /:userId/conversations - List conversations where user was human agent
router.get('/:userId/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const where = { assignedToHuman: userId };
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        select: {
          id: true,
          customerName: true,
          customerEmail: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          org: { select: { id: true, name: true } },
          channel: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    res.json({
      success: true,
      data: { conversations, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /:userId/leads - List leads assigned to user
router.get('/:userId/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const where = { assignedTo: userId };
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          status: true,
          interests: true,
          createdAt: true,
          org: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      success: true,
      data: { leads, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /:userId/notifications - List notifications for user
router.get('/:userId/notifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as { userId: string };
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const where = { userId };
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          isRead: true,
          metadata: true,
          createdAt: true,
          organization: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      success: true,
      data: { notifications, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
