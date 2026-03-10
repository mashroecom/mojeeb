import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { bulkEmailQueue } from '../queues';

interface TargetFilter {
  plan?: string;
  status?: string;
  emailVerified?: boolean;
}

export class BulkEmailService {
  async create(data: {
    subject: string;
    bodyHtml: string;
    targetFilter: TargetFilter;
    createdBy: string;
  }) {
    return prisma.bulkEmailCampaign.create({
      data: {
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        targetFilter: data.targetFilter as any,
        status: 'DRAFT',
        createdBy: data.createdBy,
      },
    });
  }

  async send(campaignId: string) {
    const campaign = await prisma.bulkEmailCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'DRAFT') {
      throw new Error('Campaign can only be sent from DRAFT status');
    }

    const targetFilter = campaign.targetFilter as unknown as TargetFilter;

    // Build user query
    const where: Record<string, unknown> = {};

    if (targetFilter.emailVerified !== undefined) {
      where.emailVerified = targetFilter.emailVerified;
    }

    // Filter by plan/status via subscription relation
    if (targetFilter.plan || targetFilter.status) {
      where.memberships = {
        some: {
          organization: {
            subscription: {
              ...(targetFilter.plan ? { plan: targetFilter.plan } : {}),
              ...(targetFilter.status ? { status: targetFilter.status } : {}),
            },
          },
        },
      };
    }

    // Exclude suspended users
    where.suspendedAt = null;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
      },
    });

    // Update campaign status
    await prisma.bulkEmailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENDING',
        totalRecipients: users.length,
        startedAt: new Date(),
      },
    });

    // Add individual jobs to queue
    const jobs = users.map((user) => ({
      name: `send-${campaignId}-${user.id}`,
      data: {
        campaignId,
        email: user.email,
        firstName: user.firstName,
        subject: campaign.subject,
        bodyHtml: campaign.bodyHtml,
      },
    }));

    if (jobs.length > 0) {
      await bulkEmailQueue.addBulk(jobs);
    }

    logger.info({ campaignId, recipientCount: users.length }, 'Bulk email campaign started');

    // If no recipients, mark as completed immediately
    if (users.length === 0) {
      await prisma.bulkEmailCampaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

    return { recipientCount: users.length };
  }

  async list(params: { page: number; limit: number }) {
    const { page, limit } = params;

    const [campaigns, total] = await Promise.all([
      prisma.bulkEmailCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.bulkEmailCampaign.count(),
    ]);

    return { campaigns, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    const campaign = await prisma.bulkEmailCampaign.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Calculate progress percentage
    const progress =
      campaign.totalRecipients > 0
        ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalRecipients) * 100)
        : 0;

    // Auto-complete if all sent
    if (
      campaign.status === 'SENDING' &&
      campaign.totalRecipients > 0 &&
      campaign.sentCount + campaign.failedCount >= campaign.totalRecipients
    ) {
      await prisma.bulkEmailCampaign.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      (campaign as any).status = 'COMPLETED';
    }

    return { ...campaign, progress };
  }

  async cancel(id: string) {
    const campaign = await prisma.bulkEmailCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    return prisma.bulkEmailCampaign.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }

  async getRecipientCount(targetFilter: TargetFilter) {
    const where: Record<string, unknown> = {};

    if (targetFilter.emailVerified !== undefined) {
      where.emailVerified = targetFilter.emailVerified;
    }

    if (targetFilter.plan || targetFilter.status) {
      where.memberships = {
        some: {
          organization: {
            subscription: {
              ...(targetFilter.plan ? { plan: targetFilter.plan } : {}),
              ...(targetFilter.status ? { status: targetFilter.status } : {}),
            },
          },
        },
      };
    }

    where.suspendedAt = null;

    return prisma.user.count({ where });
  }
}

export const bulkEmailService = new BulkEmailService();
