import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';
import { webhookService } from './webhook.service';

export class LeadsService {
  async list(
    orgId: string,
    params: { page?: number; limit?: number; status?: string; search?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { orgId };
    if (params.status) {
      where.status = params.status;
    }
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
        { company: { contains: params.search, mode: 'insensitive' } },
        { source: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          conversation: { select: { id: true, customerName: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(orgId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId },
      include: {
        conversation: {
          select: { id: true, customerName: true, status: true, createdAt: true },
        },
      },
    });
    if (!lead) throw new NotFoundError('Lead not found');
    return lead;
  }

  async updateStatus(orgId: string, leadId: string, status: string) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) throw new NotFoundError('Lead not found');

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: { status: status as any },
    });

    await webhookService.dispatch(orgId, 'lead.updated', updatedLead);

    return updatedLead;
  }

  async create(
    orgId: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      source?: string;
      notes?: string;
      status?: string;
    },
  ) {
    return prisma.lead.create({
      data: {
        orgId,
        name: data.name || null,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        source: data.source || 'MANUAL',
        notes: data.notes || null,
        status: (data.status as any) || 'NEW',
        confidence: 1.0,
      },
      include: {
        conversation: { select: { id: true, customerName: true } },
      },
    });
  }

  async update(
    orgId: string,
    leadId: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      source?: string;
      notes?: string;
      status?: string;
    },
  ) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) throw new NotFoundError('Lead not found');

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(data.name !== undefined && { name: data.name || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.company !== undefined && { company: data.company || null }),
        ...(data.source !== undefined && { source: data.source || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.status !== undefined && { status: data.status as any }),
      },
      include: {
        conversation: { select: { id: true, customerName: true } },
      },
    });

    await webhookService.dispatch(orgId, 'lead.updated', updatedLead);

    return updatedLead;
  }

  async delete(orgId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) throw new NotFoundError('Lead not found');

    return prisma.lead.delete({ where: { id: leadId } });
  }

  async getStats(orgId: string) {
    const [total, byStatus] = await Promise.all([
      prisma.lead.count({ where: { orgId } }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { orgId },
        _count: true,
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const item of byStatus) {
      statusMap[item.status] = item._count;
    }

    return {
      total,
      new: statusMap['NEW'] || 0,
      contacted: statusMap['CONTACTED'] || 0,
      qualified: statusMap['QUALIFIED'] || 0,
      converted: statusMap['CONVERTED'] || 0,
      lost: statusMap['LOST'] || 0,
    };
  }
}

export const leadsService = new LeadsService();
