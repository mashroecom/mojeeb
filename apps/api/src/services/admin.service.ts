import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';

export class AdminService {
  // ========================
  // PLATFORM OVERVIEW
  // ========================

  async getPlatformOverview() {
    const [
      totalUsers,
      totalOrgs,
      totalConversations,
      totalMessages,
      activeSubscriptions,
      revenue,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE', plan: { not: 'FREE' } } }),
      prisma.invoice.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalUsers,
      totalOrgs,
      totalConversations,
      totalMessages,
      activeSubscriptions,
      totalRevenue: revenue._sum.amount?.toNumber() ?? 0,
    };
  }

  async getPlatformGrowth(params: { startDate?: string; endDate?: string; groupBy?: string }) {
    const { startDate, endDate } = params;
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const [users, orgs, conversations] = await Promise.all([
      prisma.user.findMany({
        where: dateWhere,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.organization.findMany({
        where: dateWhere,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.conversation.findMany({
        where: dateWhere,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Group by day
    const dailyMap = new Map<string, { users: number; orgs: number; conversations: number }>();

    const addToDay = (date: Date, key: 'users' | 'orgs' | 'conversations') => {
      const day = date.toISOString().split('T')[0]!;
      const entry = dailyMap.get(day) || { users: 0, orgs: 0, conversations: 0 };
      entry[key]++;
      dailyMap.set(day, entry);
    };

    users.forEach((u) => addToDay(u.createdAt, 'users'));
    orgs.forEach((o) => addToDay(o.createdAt, 'orgs'));
    conversations.forEach((c) => addToDay(c.createdAt, 'conversations'));

    const growth = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    return { growth };
  }

  // ========================
  // USERS MANAGEMENT
  // ========================

  async listUsers(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }) {
    const { page, limit, search, status } = params;
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'suspended') {
      where.suspendedAt = { not: null };
    } else if (status === 'active') {
      where.suspendedAt = null;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          isSuperAdmin: true,
          suspendedAt: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: { memberships: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isSuperAdmin: true,
        suspendedAt: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: {
          include: {
            org: {
              select: {
                id: true,
                name: true,
                slug: true,
                _count: { select: { conversations: true, agents: true } },
              },
            },
          },
        },
        _count: {
          select: { sentMessages: true, apiKeys: true },
        },
      },
    });

    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async toggleUserSuspension(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { suspendedAt: true },
    });
    if (!user) throw new NotFoundError('User not found');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: user.suspendedAt ? null : new Date() },
      select: { id: true, suspendedAt: true },
    });

    return updated;
  }

  async deleteUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  async bulkSuspendUsers(userIds: string[]) {
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds }, suspendedAt: null },
      data: { suspendedAt: new Date() },
    });
    return { count: result.count };
  }

  async bulkUnsuspendUsers(userIds: string[]) {
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds }, suspendedAt: { not: null } },
      data: { suspendedAt: null },
    });
    return { count: result.count };
  }

  // ========================
  // ORGANIZATIONS MANAGEMENT
  // ========================

  async listOrganizations(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }) {
    const { page, limit, search, status } = params;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'suspended') {
      where.suspendedAt = { not: null };
    } else if (status === 'active') {
      where.suspendedAt = null;
    }

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          industry: true,
          suspendedAt: true,
          createdAt: true,
          subscription: {
            select: { plan: true, status: true },
          },
          _count: {
            select: { members: true, conversations: true, agents: true, channels: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    return { organizations: orgs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOrganizationDetail(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        subscription: true,
        _count: {
          select: {
            members: true,
            conversations: true,
            agents: true,
            channels: true,
            leads: true,
            knowledgeBases: true,
          },
        },
      },
    });

    if (!org) throw new NotFoundError('Organization not found');
    return org;
  }

  async getOrganizationMembers(orgId: string) {
    const members = await prisma.orgMembership.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            lastLoginAt: true,
          },
        },
      },
    });

    return { members };
  }

  async toggleOrgSuspension(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { suspendedAt: true },
    });
    if (!org) throw new NotFoundError('Organization not found');

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { suspendedAt: org.suspendedAt ? null : new Date() },
      select: { id: true, suspendedAt: true },
    });

    return updated;
  }

  async deleteOrganization(orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundError('Organization not found');

    await prisma.organization.delete({ where: { id: orgId } });
    return { success: true };
  }

  async bulkSuspendOrgs(orgIds: string[]) {
    const result = await prisma.organization.updateMany({
      where: { id: { in: orgIds }, suspendedAt: null },
      data: { suspendedAt: new Date() },
    });
    return { count: result.count };
  }

  // ========================
  // SUBSCRIPTIONS MANAGEMENT
  // ========================

  async listSubscriptions(params: {
    page: number;
    limit: number;
    plan?: string;
    status?: string;
  }) {
    const { page, limit, plan, status } = params;
    const where: any = {};

    if (plan) where.plan = plan;
    if (status) where.status = status;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          org: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: { invoices: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscription.count({ where }),
    ]);

    return { subscriptions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getSubscriptionDetail(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        org: {
          select: { id: true, name: true, slug: true },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!subscription) throw new NotFoundError('Subscription not found');
    return subscription;
  }

  async updateSubscription(subscriptionId: string, data: {
    plan?: string;
    messagesLimit?: number;
    agentsLimit?: number;
    integrationsLimit?: number;
  }) {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundError('Subscription not found');

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        ...(data.plan && { plan: data.plan as any }),
        ...(data.messagesLimit !== undefined && { messagesLimit: data.messagesLimit }),
        ...(data.agentsLimit !== undefined && { agentsLimit: data.agentsLimit }),
        ...(data.integrationsLimit !== undefined && { integrationsLimit: data.integrationsLimit }),
      },
    });

    return updated;
  }

  // ========================
  // REVENUE ANALYTICS
  // ========================

  async getRevenueAnalytics() {
    const [planDistribution, recentInvoices, monthlyRevenue] = await Promise.all([
      prisma.subscription.groupBy({
        by: ['plan'],
        _count: true,
      }),
      prisma.invoice.findMany({
        where: { status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take: 20,
        include: {
          subscription: {
            include: {
              org: { select: { name: true } },
            },
          },
        },
      }),
      prisma.invoice.groupBy({
        by: ['currency'],
        where: { status: 'PAID' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return { planDistribution, recentInvoices, monthlyRevenue };
  }

  // ========================
  // TOP ORGANIZATIONS
  // ========================

  async getTopOrganizations(limit = 5) {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        subscription: {
          select: { plan: true },
        },
        _count: {
          select: {
            conversations: true,
            members: true,
            agents: true,
          },
        },
      },
      orderBy: {
        conversations: { _count: 'desc' },
      },
      take: limit,
    });

    // Get message counts per org
    const orgIds = orgs.map((o) => o.id);
    const messageCounts = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversation: { orgId: { in: orgIds } },
      },
      _count: true,
    });

    // Aggregate message counts by org via conversations
    const conversations = await prisma.conversation.findMany({
      where: { orgId: { in: orgIds } },
      select: { id: true, orgId: true },
    });
    const convOrgMap = new Map(conversations.map((c) => [c.id, c.orgId]));
    const orgMessageCounts = new Map<string, number>();
    for (const mc of messageCounts) {
      const orgId = convOrgMap.get(mc.conversationId);
      if (orgId) {
        orgMessageCounts.set(orgId, (orgMessageCounts.get(orgId) ?? 0) + mc._count);
      }
    }

    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.subscription?.plan ?? 'FREE',
      conversations: org._count.conversations,
      messages: orgMessageCounts.get(org.id) ?? 0,
      members: org._count.members,
      agents: org._count.agents,
    }));
  }

  // ========================
  // RECENT ACTIVITY
  // ========================

  async getRecentActivity(limit = 15) {
    const [recentUsers, recentOrgs, recentConversations] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.conversation.findMany({
        select: {
          id: true,
          status: true,
          createdAt: true,
          org: { select: { name: true } },
          channel: { select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    // Merge and sort by createdAt desc
    const activities: Array<{
      type: 'user_joined' | 'org_created' | 'conversation_created';
      id: string;
      description: string;
      createdAt: Date;
    }> = [];

    for (const u of recentUsers) {
      activities.push({
        type: 'user_joined',
        id: u.id,
        description: `${u.firstName} ${u.lastName} (${u.email})`,
        createdAt: u.createdAt,
      });
    }

    for (const o of recentOrgs) {
      activities.push({
        type: 'org_created',
        id: o.id,
        description: o.name,
        createdAt: o.createdAt,
      });
    }

    for (const c of recentConversations) {
      activities.push({
        type: 'conversation_created',
        id: c.id,
        description: `${c.org.name} (${c.channel?.type ?? 'unknown'})`,
        createdAt: c.createdAt,
      });
    }

    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return activities.slice(0, limit);
  }

  // ========================
  // DAILY REVENUE (last 30 days)
  // ========================

  async getDailyRevenue() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'PAID',
        paidAt: { gte: thirtyDaysAgo },
      },
      select: {
        amount: true,
        paidAt: true,
      },
      orderBy: { paidAt: 'asc' },
    });

    // Aggregate by day
    const dailyMap = new Map<string, number>();
    for (const inv of invoices) {
      if (!inv.paidAt) continue;
      const day = inv.paidAt.toISOString().split('T')[0]!;
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + inv.amount.toNumber());
    }

    // Fill in all 30 days
    const result: Array<{ date: string; revenue: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().split('T')[0]!;
      result.push({ date: day, revenue: dailyMap.get(day) ?? 0 });
    }

    return result;
  }
}

export const adminService = new AdminService();
