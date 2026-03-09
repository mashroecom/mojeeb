import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';
import { subscriptionService } from '../../services/subscription.service';
import { validate } from '../../middleware/validate';

const router: Router = Router();

// GET / - List all agents with pagination
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const orgId = req.query.orgId as string | undefined;
    const provider = req.query.provider as string | undefined;
    const status = req.query.status as string | undefined;

    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (orgId) where.orgId = orgId;
    if (provider) where.aiProvider = provider;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        include: {
          org: { select: { id: true, name: true } },
          _count: { select: { channels: true, conversations: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.agent.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        agents,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Agent statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, active, inactive, byProvider] = await Promise.all([
      prisma.agent.count(),
      prisma.agent.count({ where: { isActive: true } }),
      prisma.agent.count({ where: { isActive: false } }),
      prisma.agent.groupBy({ by: ['aiProvider'], _count: true }),
    ]);

    res.json({
      success: true,
      data: { total, active, inactive, byProvider },
    });
  } catch (err) {
    next(err);
  }
});

// GET /:agentId - Agent detail
router.get('/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params as { agentId: string };
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        org: { select: { id: true, name: true, slug: true } },
        channels: {
          include: { channel: { select: { id: true, name: true, type: true } } },
        },
        knowledgeBases: {
          include: { knowledgeBase: { select: { id: true, name: true } } },
        },
      },
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    res.json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

const updateAgentSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
  aiProvider: z.enum(['OPENAI', 'ANTHROPIC']).optional(),
  aiModel: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32000).optional(),
  language: z.string().max(10).optional(),
});

// PATCH /:agentId - Update agent
router.patch(
  '/:agentId',
  validate({ body: updateAgentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params as { agentId: string };
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent) {
        return res.status(404).json({ success: false, message: 'Agent not found' });
      }

      const updated = await prisma.agent.update({
        where: { id: agentId },
        data: req.body,
      });

      await auditLogService.log({
        userId: req.user!.userId,
        action: 'ADMIN_AGENT_UPDATED',
        targetType: 'Agent',
        targetId: agentId,
        metadata: req.body,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:agentId - Delete agent
router.delete('/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params as { agentId: string };
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    await prisma.agent.delete({ where: { id: agentId } });

    // Decrement agent usage counter and clear subscription cache
    await subscriptionService.decrementUsage(agent.orgId, 'agents');

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ADMIN_AGENT_DELETED',
      targetType: 'Agent',
      targetId: agentId,
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
