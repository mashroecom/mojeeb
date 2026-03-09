import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Prisma } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../config/database';
import { configService } from './config.service';
import { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors';
import type { JwtPayload } from '../middleware/auth';
import { slugify } from '@mojeeb/shared-utils';
import { SubscriptionPlan } from '@mojeeb/shared-types';
import { planConfigService } from './planConfig.service';
import { emailQueue } from '../queues';
import { verificationService } from './verification.service';
import { logger } from '../config/logger';
import { adminNotificationService } from './adminNotification.service';

// Cached Google OAuth client that is recreated when the client ID changes
let cachedGoogleClient: OAuth2Client = new OAuth2Client(config.google.clientId);
let cachedGoogleClientId: string = config.google.clientId;

/**
 * Get or lazily create the Google OAuth2 client.
 * Recreates the client if the client ID has changed (e.g. updated via admin dashboard).
 * Falls back to static config if configService fails.
 * Also returns the current clientId for use as audience in verifyIdToken.
 */
async function getGoogleClient(): Promise<{ client: OAuth2Client; clientId: string }> {
  let clientId: string;
  try {
    clientId = await configService.get('GOOGLE_CLIENT_ID');
  } catch {
    clientId = config.google.clientId;
  }
  if (!clientId) {
    clientId = config.google.clientId;
  }

  if (clientId !== cachedGoogleClientId) {
    cachedGoogleClient = new OAuth2Client(clientId);
    cachedGoogleClientId = clientId;
  }

  return { client: cachedGoogleClient, clientId };
}

function safeLimit(value: number): number {
  return Number.isFinite(value) ? value : 999999;
}

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
  }) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      // Check if this user was created via team invite (not a real registered user).
      // Invited users are never OWNER of any organization.
      const isOwnerOfAnyOrg = await prisma.orgMembership.findFirst({
        where: { userId: existingUser.id, role: 'OWNER' },
      });

      if (isOwnerOfAnyOrg) {
        // Real registered user - can't register again
        throw new ConflictError('Email already registered');
      }

      // User was created by invite - let them complete registration.
      // Update their profile and create their own organization,
      // while keeping their existing team memberships.
      const passwordHash = await argon2.hash(data.password);

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
          },
        });

        let slug = slugify(data.organizationName);
        const existingSlug = await tx.organization.findUnique({ where: { slug } });
        if (existingSlug) {
          slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
        }

        const organization = await tx.organization.create({
          data: { name: data.organizationName, slug },
        });

        await tx.orgMembership.create({
          data: { userId: user.id, orgId: organization.id, role: 'OWNER' },
        });

        const limits = await planConfigService.getLimits(SubscriptionPlan.FREE);
        await tx.subscription.create({
          data: {
            orgId: organization.id,
            plan: 'FREE',
            status: 'ACTIVE',
            messagesLimit: safeLimit(limits.messagesPerMonth),
            agentsLimit: safeLimit(limits.maxAgents),
            integrationsLimit: safeLimit(limits.maxChannels),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        return { user, organization };
      });

      // Send verification email (non-blocking)
      verificationService.resendVerificationEmail(result.user.id).catch(err => logger.warn({ err }, 'Background task failed'));

      const tokens = await this.generateTokens(result.user.id, result.user.email);

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          avatarUrl: result.user.avatarUrl,
        },
        tokens,
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
        },
      };
    }

    // Hash password
    const passwordHash = await argon2.hash(data.password);

    // Create user + organization in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });

      // Create organization
      let slug = slugify(data.organizationName);
      const existingSlug = await tx.organization.findUnique({ where: { slug } });
      if (existingSlug) {
        slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
      }

      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug,
        },
      });

      // Create membership as OWNER
      await tx.orgMembership.create({
        data: {
          userId: user.id,
          orgId: organization.id,
          role: 'OWNER',
        },
      });

      // Create free subscription
      const limits = await planConfigService.getLimits(SubscriptionPlan.FREE);
      await tx.subscription.create({
        data: {
          orgId: organization.id,
          plan: 'FREE',
          status: 'ACTIVE',
          messagesLimit: safeLimit(limits.messagesPerMonth),
          agentsLimit: safeLimit(limits.maxAgents),
          integrationsLimit: safeLimit(limits.maxChannels),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      return { user, organization };
    });

    // Send verification email (non-blocking) via the VerificationToken model
    verificationService.resendVerificationEmail(result.user.id).catch(err => logger.warn({ err }, 'Background task failed'));

    // Generate tokens
    const tokens = await this.generateTokens(result.user.id, result.user.email);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        avatarUrl: result.user.avatarUrl,
      },
      tokens,
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
    };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          include: { org: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.suspendedAt) {
      throw new UnauthorizedError('Account has been suspended');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    const org = user.memberships[0]?.org;

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        isSuperAdmin: user.isSuperAdmin,
      },
      tokens,
      organization: org
        ? { id: org.id, name: org.name, slug: org.slug }
        : null,
      organizations: user.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        org: { id: m.org.id, name: m.org.name, slug: m.org.slug },
      })),
    };
  }

  async refreshToken(refreshToken: string) {
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedError('Refresh token expired');
    }

    // Verify the user account is still valid
    if (session.user.suspendedAt) {
      await prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedError('Account has been suspended');
    }

    // Rotate refresh token atomically — delete old + create new in a transaction
    // to prevent race conditions with concurrent refresh requests
    const newTokens = await prisma.$transaction(async (tx) => {
      await tx.session.delete({ where: { id: session.id } });
      return this.generateTokensInTx(tx, session.user.id, session.user.email);
    });

    return { tokens: newTokens };
  }

  async logout(refreshToken: string, accessToken?: string) {
    await prisma.session.deleteMany({
      where: { refreshToken },
    });

    // Blacklist the access token if provided (prevents reuse after logout)
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as JwtPayload & { exp?: number } | null;
        if (decoded?.jti && decoded.exp) {
          const { tokenBlacklistService } = await import('./tokenBlacklist.service');
          await tokenBlacklistService.blacklist(decoded.jti, decoded.exp);
        }
      } catch {
        // Best-effort blacklisting — don't fail logout
      }
    }
  }

  async forgotPassword(email: string) {
    await verificationService.createPasswordResetToken(email);
  }

  async resetPassword(token: string, newPassword: string) {
    // First try the new VerificationToken model
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (verificationToken) {
      await verificationService.resetPassword(token, newPassword);
      return;
    }

    // Fallback: try the legacy resetPasswordToken field on User
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });
  }

  async verifyEmail(token: string) {
    // First try the new VerificationToken model
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (verificationToken) {
      await verificationService.verifyEmail(token);
      return;
    }

    // Fallback: try the legacy emailVerifyToken field on User
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      throw new NotFoundError('Invalid verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
      },
    });

    // Send welcome email (non-blocking)
    emailQueue.add('welcome', { type: 'welcome', to: user.email, firstName: user.firstName }).catch(err => logger.warn({ err }, 'Failed to queue welcome email'));
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isSuperAdmin: true,
        emailVerified: true,
        createdAt: true,
        memberships: {
          include: {
            org: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user is OWNER of any organization
    const ownedOrgs = await prisma.orgMembership.findFirst({
      where: { userId, role: 'OWNER' },
    });

    if (ownedOrgs) {
      throw new BadRequestError('Transfer ownership before deleting account');
    }

    // Delete in a transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      // Delete user's sessions
      await tx.session.deleteMany({
        where: { userId },
      });

      // Delete user's org memberships (where not OWNER — already verified none exist)
      await tx.orgMembership.deleteMany({
        where: { userId },
      });

      // Delete the user record
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { success: true };
  }

  async googleSignIn(idToken: string) {
    // Verify Google ID token using dynamic config
    const { client: googleClient, clientId: googleClientId } = await getGoogleClient();
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
    } catch {
      throw new UnauthorizedError('Invalid Google ID token');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedError('Invalid Google token payload');
    }

    const email = payload.email.toLowerCase();
    const firstName = payload.given_name || payload.name?.split(' ')[0] || 'User';
    const lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '';
    const avatarUrl = payload.picture || null;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { org: true },
        },
      },
    });

    if (existingUser) {
      if (existingUser.suspendedAt) {
        throw new UnauthorizedError('Account has been suspended');
      }
      // User exists - log them in
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          lastLoginAt: new Date(),
          ...(avatarUrl && !existingUser.avatarUrl ? { avatarUrl } : {}),
          ...(!existingUser.emailVerified ? { emailVerified: true, emailVerifiedAt: new Date() } : {}),
        },
      });

      const tokens = await this.generateTokens(existingUser.id, existingUser.email);
      const org = existingUser.memberships[0]?.org;

      return {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          avatarUrl: existingUser.avatarUrl || avatarUrl,
          isSuperAdmin: existingUser.isSuperAdmin,
        },
        tokens,
        organization: org
          ? { id: org.id, name: org.name, slug: org.slug }
          : null,
        organizations: existingUser.memberships.map((m) => ({
          id: m.id,
          role: m.role,
          org: { id: m.org.id, name: m.org.name, slug: m.org.slug },
        })),
      };
    }

    // New user - register with Google (no password needed)
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await argon2.hash(randomPassword);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          avatarUrl,
          emailVerified: true, // Google already verified the email
          emailVerifiedAt: new Date(),
        },
      });

      // Create organization using the user's name
      const orgName = `${firstName}'s Organization`;
      let slug = slugify(orgName);
      const existingSlug = await tx.organization.findUnique({ where: { slug } });
      if (existingSlug) {
        slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
      }

      const organization = await tx.organization.create({
        data: {
          name: orgName,
          slug,
        },
      });

      // Create membership as OWNER
      await tx.orgMembership.create({
        data: {
          userId: user.id,
          orgId: organization.id,
          role: 'OWNER',
        },
      });

      // Create free subscription
      const limits = await planConfigService.getLimits(SubscriptionPlan.FREE);
      await tx.subscription.create({
        data: {
          orgId: organization.id,
          plan: 'FREE',
          status: 'ACTIVE',
          messagesLimit: safeLimit(limits.messagesPerMonth),
          agentsLimit: safeLimit(limits.maxAgents),
          integrationsLimit: safeLimit(limits.maxChannels),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return { user, organization };
    });

    const tokens = await this.generateTokens(result.user.id, result.user.email);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        avatarUrl: result.user.avatarUrl,
      },
      tokens,
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
    };
  }

  private async generateTokens(userId: string, email: string) {
    return this.generateTokensInTx(prisma, userId, email);
  }

  /** Generate tokens using a specific Prisma client (or transaction). */
  private async generateTokensInTx(tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>, userId: string, email: string) {
    const jti = crypto.randomUUID();
    const payload: JwtPayload = { userId, email, jti };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiry,
    } as jwt.SignOptions);

    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Store refresh token in session
    await tx.session.create({
      data: {
        userId,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
