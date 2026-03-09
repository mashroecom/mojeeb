import crypto from 'crypto';
import argon2 from 'argon2';
import { prisma } from '../config/database';
import { emailQueue } from '../queues';
import { logger } from '../config/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';

export class VerificationService {
  /**
   * Create an email verification token for a user.
   * Returns the raw token string to be included in the verification email link.
   */
  async createEmailVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');

    await prisma.verificationToken.create({
      data: {
        token,
        type: 'EMAIL_VERIFY',
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return token;
  }

  /**
   * Verify a user's email using the token from the verification link.
   * Marks the token as used and updates the user's email verification status.
   * Also sends a welcome email after successful verification.
   */
  async verifyEmail(token: string): Promise<void> {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new NotFoundError('Invalid verification token');
    }

    if (verificationToken.usedAt) {
      throw new BadRequestError('Verification token has already been used');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestError('Verification token has expired');
    }

    if (verificationToken.type !== 'EMAIL_VERIFY') {
      throw new BadRequestError('Invalid token type');
    }

    // Update user and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerifyToken: null, // Clear legacy token if present
        },
      }),
      prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Send welcome email (non-blocking)
    // TODO: Implement emailService.sendWelcomeEmail when email service is available
    // emailService
    //   .sendWelcomeEmail(verificationToken.user.email, verificationToken.user.firstName)
    //   .catch((err: Error) => logger.warn({ err }, 'Failed to send welcome email'));
  }

  /**
   * Resend a verification email for the given user.
   * Deletes any existing EMAIL_VERIFY tokens and creates a new one.
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestError('Email is already verified');
    }

    // Delete any existing EMAIL_VERIFY tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        userId,
        type: 'EMAIL_VERIFY',
      },
    });

    // Create new token and send email
    const token = await this.createEmailVerificationToken(userId);
    await emailQueue.add('verification', { type: 'verification', to: user.email, verifyToken: token });
  }

  /**
   * Create a password reset token and send the reset email.
   * Silently returns if the email is not found (security: don't reveal if email exists).
   */
  async createPasswordResetToken(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal whether email exists
      return;
    }

    // Delete any existing PASSWORD_RESET tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
      },
    });

    const token = crypto.randomBytes(32).toString('hex');

    await prisma.verificationToken.create({
      data: {
        token,
        type: 'PASSWORD_RESET',
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Also update the legacy fields for backward compatibility
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await emailQueue.add('passwordReset', { type: 'passwordReset', to: user.email, resetToken: token });
  }

  /**
   * Reset a user's password using the token from the password reset link.
   * Validates the token, hashes the new password, and invalidates all sessions.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    if (verificationToken.usedAt) {
      throw new BadRequestError('Reset token has already been used');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestError('Reset token has expired');
    }

    if (verificationToken.type !== 'PASSWORD_RESET') {
      throw new BadRequestError('Invalid token type');
    }

    const passwordHash = await argon2.hash(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      }),
      prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId: verificationToken.userId },
    });
  }
}

export const verificationService = new VerificationService();
