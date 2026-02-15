import { prisma } from '../config/database';

export class AuditLogService {
  async log(params: {
    userId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: (params.metadata as any) ?? undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async list(params: {
    page: number;
    limit: number;
    action?: string;
    targetType?: string;
    userId?: string;
    targetId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, action, targetType, userId, targetId, startDate, endDate } = params;
    const where: Record<string, unknown> = {};

    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (userId) where.userId = userId;
    if (targetId) where.targetId = targetId;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export const auditLogService = new AuditLogService();
