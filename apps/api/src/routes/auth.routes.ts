import { Router } from 'express';
import argon2 from 'argon2';
import { authService } from '../services/auth.service';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  authLimiter,
  tokenRefreshLimiter,
  destructiveActionLimiter,
} from '../middleware/rateLimiter';
import { registerSchema, loginSchema, passwordSchema } from '@mojeeb/shared-utils';
import { z } from 'zod';
import { prisma } from '../config/database';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { verificationService } from '../services/verification.service';
import { auditLogService } from '../services/auditLog.service';
import { loginActivityService } from '../services/loginActivity.service';
import { ipBlockService } from '../services/ipBlock.service';
import { logger } from '../config/logger';

const router: Router = Router();

// POST /api/v1/auth/register
router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  async (req, res, next) => {
    try {
      const result = await authService.register(req.body);

      // Audit log: successful registration (fire-and-forget)
      auditLogService
        .log({
          userId: result.user.id,
          action: 'AUTH_REGISTER',
          targetType: 'User',
          targetId: result.user.id,
          metadata: { email: result.user.email },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        })
        .catch((err) => logger.warn({ err }, 'Audit log failed'));

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/auth/login
router.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);

    // Audit log: successful login (fire-and-forget)
    auditLogService
      .log({
        userId: result.user.id,
        action: 'AUTH_LOGIN',
        targetType: 'User',
        targetId: result.user.id,
        metadata: { email: result.user.email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
      .catch((err) => logger.warn({ err }, 'Audit log failed'));

    // Login activity: success (fire-and-forget)
    loginActivityService
      .log({
        userId: result.user.id,
        email: req.body.email,
        success: true,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
      .catch(() => {});

    res.json({ success: true, data: result });
  } catch (err) {
    // Log failed login attempt
    if (err instanceof UnauthorizedError) {
      loginActivityService
        .log({
          email: req.body.email,
          success: false,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          failReason: 'INVALID_CREDENTIALS',
        })
        .catch(() => {});
      if (req.ip) ipBlockService.autoBlockCheck(req.ip, 'system').catch(() => {});
    }
    next(err);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', tokenRefreshLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }
    const result = await authService.refreshToken(refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const accessToken = req.headers.authorization?.substring(7);
    if (refreshToken) {
      await authService.logout(refreshToken, accessToken);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/forgot-password
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: z.object({ email: z.string().email() }) }),
  async (req, res, next) => {
    try {
      await authService.forgotPassword(req.body.email);
      res.json({
        success: true,
        data: { message: 'If the email exists, a reset link has been sent' },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/auth/reset-password
router.post(
  '/reset-password',
  authLimiter,
  validate({
    body: z.object({
      token: z.string(),
      password: passwordSchema,
    }),
  }),
  async (req, res, next) => {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      res.json({ success: true, data: { message: 'Password reset successfully' } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/auth/verify-email
router.post(
  '/verify-email',
  validate({ body: z.object({ token: z.string() }) }),
  async (req, res, next) => {
    try {
      await authService.verifyEmail(req.body.token);
      res.json({ success: true, data: { message: 'Email verified successfully' } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/auth/resend-verification
router.post('/resend-verification', authLimiter, authenticate, async (req, res, next) => {
  try {
    await verificationService.resendVerificationEmail(req.user!.userId);
    res.json({ success: true, data: { message: 'Verification email sent' } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/google
router.post(
  '/google',
  authLimiter,
  validate({ body: z.object({ idToken: z.string() }) }),
  async (req, res, next) => {
    try {
      const result = await authService.googleSignIn(req.body.idToken);

      // Audit log: Google sign-in (fire-and-forget)
      auditLogService
        .log({
          userId: result.user.id,
          action: 'AUTH_GOOGLE_SIGNIN',
          targetType: 'User',
          targetId: result.user.id,
          metadata: { email: result.user.email },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        })
        .catch((err) => logger.warn({ err }, 'Audit log failed'));

      // Login activity: Google sign-in success (fire-and-forget)
      loginActivityService
        .log({
          userId: result.user.id,
          email: result.user.email,
          success: true,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        })
        .catch(() => {});

      res.json({ success: true, data: result });
    } catch (err) {
      // Log failed Google sign-in attempt
      if (err instanceof UnauthorizedError) {
        loginActivityService
          .log({
            email: req.body.idToken ? 'google-oauth' : 'unknown',
            success: false,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            failReason: 'GOOGLE_AUTH_FAILED',
          })
          .catch(() => {});
      }
      next(err);
    }
  },
);

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user!.userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/auth/me - update profile
router.patch(
  '/me',
  authenticate,
  validate({
    body: z.object({
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { firstName, lastName } = req.body;
      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          emailVerified: true,
          createdAt: true,
        },
      });
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/auth/me/password - change password
router.patch(
  '/me/password',
  authenticate,
  validate({
    body: z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }),
  }),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
      });
      if (!user) throw new NotFoundError('User not found');

      const validPassword = await argon2.verify(user.passwordHash, currentPassword);
      if (!validPassword) {
        throw new BadRequestError('Current password is incorrect');
      }

      const newHash = await argon2.hash(newPassword);
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { passwordHash: newHash },
      });

      // Audit log: password changed (fire-and-forget)
      auditLogService
        .log({
          userId: req.user!.userId,
          action: 'AUTH_PASSWORD_CHANGED',
          targetType: 'User',
          targetId: req.user!.userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        })
        .catch((err) => logger.warn({ err }, 'Audit log failed'));

      res.json({ success: true, data: { message: 'Password updated successfully' } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/auth/sessions - list user's active sessions
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.userId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/auth/sessions/:sessionId - revoke a specific session
router.delete(
  '/sessions/:sessionId',
  destructiveActionLimiter,
  authenticate,
  async (req, res, next) => {
    try {
      const sessionId = req.params.sessionId as string;
      const session = await prisma.session.findFirst({
        where: { id: sessionId, userId: req.user!.userId },
      });
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      await prisma.session.delete({ where: { id: sessionId } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/auth/me - delete account
router.delete('/me', destructiveActionLimiter, authenticate, async (req, res, next) => {
  try {
    // Audit log BEFORE deletion (user will be gone after)
    await auditLogService
      .log({
        userId: req.user!.userId,
        action: 'AUTH_ACCOUNT_DELETED',
        targetType: 'User',
        targetId: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
      .catch((err) => logger.warn({ err }, 'Audit log failed'));

    await authService.deleteAccount(req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
