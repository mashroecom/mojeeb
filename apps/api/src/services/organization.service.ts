import crypto from 'crypto';
import argon2 from 'argon2';
import { prisma } from '../config/database';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
  UsageLimitError,
} from '../utils/errors';
import { SubscriptionPlan } from '@mojeeb/shared-types';
import { planConfigService } from './planConfig.service';

export class OrganizationService {
  async getById(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: { select: { members: true, agents: true, channels: true } },
      },
    });
    if (!org) throw new NotFoundError('Organization not found');
    return org;
  }

  async update(
    orgId: string,
    data: {
      name?: string;
      slug?: string;
      websiteUrl?: string;
      timezone?: string;
      defaultLanguage?: string;
      dateFormat?: string;
      primaryColor?: string;
      secondaryColor?: string;
      customCss?: string | null;
      contactEmail?: string;
    },
  ) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundError('Organization not found');

    return prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.defaultLanguage !== undefined && { defaultLanguage: data.defaultLanguage }),
        ...(data.dateFormat !== undefined && { dateFormat: data.dateFormat }),
        ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
        ...(data.secondaryColor !== undefined && { secondaryColor: data.secondaryColor }),
        ...(data.customCss !== undefined && { customCss: data.customCss }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail || null }),
      },
      include: {
        _count: { select: { members: true, agents: true, channels: true } },
      },
    });
  }

  async listMembers(orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundError('Organization not found');

    const memberships = await prisma.orgMembership.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user,
    }));
  }

  async inviteMember(
    orgId: string,
    email: string,
    role: 'ADMIN' | 'MEMBER',
    invitedByUserId: string,
  ) {
    // Check plan limits
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });
    const plan = subscription?.plan ?? SubscriptionPlan.FREE;
    const limits = await planConfigService.getLimits(plan as SubscriptionPlan);

    const currentMemberCount = await prisma.orgMembership.count({
      where: { orgId },
    });

    if (currentMemberCount >= limits.maxTeamMembers) {
      throw new UsageLimitError(
        `Team member limit reached (${limits.maxTeamMembers}). Upgrade your plan to add more members.`,
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await argon2.hash(randomPassword);

      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          firstName: email.split('@')[0] || email,
          lastName: '',
        },
      });
    }

    // Check if already a member
    const existing = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });

    if (existing) {
      throw new ConflictError('User is already a member of this organization');
    }

    // Create membership
    const membership = await prisma.orgMembership.create({
      data: {
        userId: user.id,
        orgId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: membership.id,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.createdAt,
      user: membership.user,
    };
  }

  async updateMemberRole(
    orgId: string,
    membershipId: string,
    newRole: 'ADMIN' | 'MEMBER',
    requestingUserRole: string,
  ) {
    const membership = await prisma.orgMembership.findFirst({
      where: { id: membershipId, orgId },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    // Cannot change OWNER role
    if (membership.role === 'OWNER') {
      throw new ForbiddenError('Cannot change the role of the organization owner');
    }

    // Only OWNER can promote to ADMIN
    if (newRole === 'ADMIN' && requestingUserRole !== 'OWNER') {
      throw new ForbiddenError('Only the owner can promote members to admin');
    }

    // ADMIN can only set MEMBER role
    if (requestingUserRole === 'ADMIN' && newRole !== 'MEMBER') {
      throw new ForbiddenError('Admins can only set the member role');
    }

    const updated = await prisma.orgMembership.update({
      where: { id: membershipId },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      role: updated.role,
      joinedAt: updated.createdAt,
      user: updated.user,
    };
  }

  async removeMember(orgId: string, membershipId: string, requestingUserId: string) {
    const membership = await prisma.orgMembership.findFirst({
      where: { id: membershipId, orgId },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    // Cannot remove OWNER
    if (membership.role === 'OWNER') {
      throw new ForbiddenError('Cannot remove the organization owner');
    }

    // Cannot remove yourself
    if (membership.userId === requestingUserId) {
      throw new BadRequestError('Cannot remove yourself. Use a leave method instead.');
    }

    await prisma.orgMembership.delete({
      where: { id: membershipId },
    });

    return { success: true };
  }

  async transferOwnership(orgId: string, newOwnerMembershipId: string, currentOwnerId: string) {
    // Verify the requesting user is the current OWNER
    const currentOwnerMembership = await prisma.orgMembership.findFirst({
      where: { orgId, userId: currentOwnerId, role: 'OWNER' },
    });

    if (!currentOwnerMembership) {
      throw new ForbiddenError('Only the current owner can transfer ownership');
    }

    // Verify the new owner membership exists and belongs to this org
    const newOwnerMembership = await prisma.orgMembership.findFirst({
      where: { id: newOwnerMembershipId, orgId },
    });

    if (!newOwnerMembership) {
      throw new NotFoundError('Target membership not found');
    }

    if (newOwnerMembership.role === 'OWNER') {
      throw new BadRequestError('This member is already the owner');
    }

    // Use a transaction to atomically transfer ownership
    await prisma.$transaction([
      prisma.orgMembership.update({
        where: { id: newOwnerMembershipId },
        data: { role: 'OWNER' },
      }),
      prisma.orgMembership.update({
        where: { id: currentOwnerMembership.id },
        data: { role: 'ADMIN' },
      }),
    ]);

    return { success: true };
  }
  async deleteOrganization(orgId: string, requestingUserId: string) {
    // Verify the requesting user is the OWNER
    const ownerMembership = await prisma.orgMembership.findFirst({
      where: { orgId, userId: requestingUserId, role: 'OWNER' },
    });

    if (!ownerMembership) {
      throw new ForbiddenError('Only the organization owner can delete the organization');
    }

    // Delete in order: cascading deletes handle most relations via onDelete: Cascade
    await prisma.organization.delete({
      where: { id: orgId },
    });

    return { success: true };
  }
}

export const organizationService = new OrganizationService();
