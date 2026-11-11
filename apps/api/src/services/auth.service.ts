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
import { adminNotificationService } from './adminNotification.service';
import { logger } from '../config/logger';
import { systemSettings, type NewOrgDefaults } from './systemSettings.service';
import { loginLockoutService } from './loginLockout.service';

/** Message of the error thrown for a wrong email or password (also used for lockout). */
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

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

/** Parse a JWT lifetime such as "15m", "1h" or "900" (seconds). Null when unparseable. */
export function parseDurationSeconds(value: string): number | null {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(value.trim());
  if (!match) return null;
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] ?? 's'] ?? 1;
  return Number(match[1]) * unit;
}

/**
 * Create an organization owned by `userId`, with its subscription, applying the admin
 * "Org defaults" settings (default plan, timezone, message/agent limits).
 */
async function createOwnedOrganization(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationName: string,
  defaults: NewOrgDefaults,
) {
  let slug = slugify(organizationName);
  const existingSlug = await tx.organization.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
  }

  const organization = await tx.organization.create({
    data: {
      name: organizationName,
      slug,
      ...(defaults.timezone ? { timezone: defaults.timezone } : {}),
    },
  });

  // Create membership as OWNER
  await tx.orgMembership.create({
    data: { userId, orgId: organization.id, role: 'OWNER' },
  });

  // Create the initial subscription on the default plan
  const limits = await planConfigService.getLimits(defaults.plan);
  await tx.subscription.create({
    data: {
      orgId: organization.id,
      plan: defaults.plan,
      status: 'ACTIVE',
      messagesLimit: defaults.messagesLimit ?? safeLimit(limits.messagesPerMonth),
      agentsLimit: defaults.agentsLimit ?? safeLimit(limits.maxAgents),
      integrationsLimit: safeLimit(limits.maxChannels),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  return organization;
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

      const orgDefaults = await systemSettings.newOrgDefaults();

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
            onboardingCompleted: false,
          },
        });

        const organization = await createOwnedOrganization(
          tx,
          user.id,
          data.organizationName,
          orgDefaults,
        );

        return { user, organization };
      });

      // Send verification email (non-blocking)
      verificationService
        .resendVerificationEmail(result.user.id)
        .catch((err) => logger.warn({ err }, 'Background task failed'));

      // Notify admins (fire-and-forget)
      adminNotificationService
        .notifyRegistration(data)
        .catch((err) => logger.debug({ err }, 'Admin notification failed'));

      const tokens = await this.generateTokens(result.user.id, result.user.email);

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          avatarUrl: result.user.avatarUrl,
          onboardingCompleted: result.user.onboardingCompleted,
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
    const orgDefaults = await systemSettings.newOrgDefaults();

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

      const organization = await createOwnedOrganization(
        tx,
        user.id,
        data.organizationName,
        orgDefaults,
      );

      return { user, organization };
    });

    // Send verification email (non-blocking) via the VerificationToken model
    verificationService
      .resendVerificationEmail(result.user.id)
      .catch((err) => logger.warn({ err }, 'Background task failed'));

    // Notify admins (fire-and-forget)
    adminNotificationService
      .notifyRegistration(data)
      .catch((err) => logger.debug({ err }, 'Admin notification failed'));

    // Generate tokens
    const tokens = await this.generateTokens(result.user.id, result.user.email);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        avatarUrl: result.user.avatarUrl,
        onboardingCompleted: result.user.onboardingCompleted,
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
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
    }

    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
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
        onboardingCompleted: user.onboardingCompleted,
      },
      tokens,
      organization: org ? { id: org.id, name: org.name, slug: org.slug } : null,
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

    // A session is rotated on every refresh, so its age is the time since it was last
    // used. Besides its stored expiry it must also satisfy the *current* session timeout,
    // so lowering SESSION_TIMEOUT_MINUTES takes effect for sessions that already exist.
    const { sessionTimeoutMinutes } = await systemSettings.security();
    const idleDeadline = new Date(session.createdAt.getTime() + sessionTimeoutMinutes * 60_000);
    const now = new Date();
    if (session.expiresAt < now || idleDeadline < now) {
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
        const decoded = jwt.decode(accessToken) as (JwtPayload & { exp?: number }) | null;
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
      // Proving control of the mailbox lifts a login lockout.
      const owner = await prisma.user.findUnique({
        where: { id: verificationToken.userId },
        select: { email: true },
      });
      if (owner) await loginLockoutService.clear(owner.email);
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

    // Proving control of the mailbox lifts a login lockout.
    await loginLockoutService.clear(user.email);
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
    emailQueue
      .add('welcome', { type: 'welcome', to: user.email, firstName: user.firstName })
      .catch((err) => logger.warn({ err }, 'Failed to queue welcome email'));
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
        onboardingCompleted: true,
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

    // Check if the user's primary org has any agents
    const primaryOrg = user.memberships[0]?.org;
    let hasAgents = false;
    if (primaryOrg) {
      const agentCount = await prisma.agent.count({
        where: { orgId: primaryOrg.id },
      });
      hasAgents = agentCount > 0;
    }

    return { ...user, hasAgents };
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
          ...(!existingUser.emailVerified
            ? { emailVerified: true, emailVerifiedAt: new Date() }
            : {}),
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
          onboardingCompleted: existingUser.onboardingCompleted,
        },
        tokens,
        organization: org ? { id: org.id, name: org.name, slug: org.slug } : null,
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
    const orgDefaults = await systemSettings.newOrgDefaults();

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
      const organization = await createOwnedOrganization(tx, user.id, orgName, orgDefaults);

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
  private async generateTokensInTx(
    tx: Prisma.TransactionClient | typeof prisma,
    userId: string,
    email: string,
  ) {
    const { sessionTimeoutMinutes, maxSessionsPerUser } = await systemSettings.security();
    const sessionSeconds = sessionTimeoutMinutes * 60;

    // The access token never outlives the session timeout.
    const configuredAccessSeconds = parseDurationSeconds(config.jwt.accessExpiry);
    const expiresIn =
      configuredAccessSeconds !== null && configuredAccessSeconds > sessionSeconds
        ? `${sessionSeconds}s`
        : config.jwt.accessExpiry;

    const jti = crypto.randomUUID();
    const payload: JwtPayload = { userId, email, jti };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn,
    } as jwt.SignOptions);

    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Store refresh token in session; it lives for SESSION_TIMEOUT_MINUTES and is renewed
    // on every refresh, so the setting acts as an inactivity timeout.
    await tx.session.create({
      data: {
        userId,
        refreshToken,
        expiresAt: new Date(Date.now() + sessionSeconds * 1000),
      },
    });

    // Enforce MAX_SESSIONS_PER_USER: drop expired sessions, then the oldest ones beyond
    // the limit (the session just created is the newest and always survives).
    await tx.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    const surplus = await tx.session.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: maxSessionsPerUser,
      select: { id: true },
    });
    if (surplus.length > 0) {
      await tx.session.deleteMany({ where: { id: { in: surplus.map((x) => x.id) } } });
    }

    return { accessToken, refreshToken, expiresIn };
  }
}

export const authService = new AuthService();
