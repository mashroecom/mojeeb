import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { auditLogService } from '../../services/auditLog.service';

const router: Router = Router();

// GET / - List all knowledge bases
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const orgId = req.query.orgId as string | undefined;

    const where: any = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (orgId) where.orgId = orgId;

    const [knowledgeBases, total] = await Promise.all([
      prisma.knowledgeBase.findMany({
        where,
        include: {
          org: { select: { id: true, name: true } },
          _count: { select: { documents: true, agents: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.knowledgeBase.count({ where }),
    ]);

    res.json({
      success: true,
      data: { knowledgeBases, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Knowledge base statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalKBs, totalDocs, totalChunks, byEmbeddingStatus] = await Promise.all([
      prisma.knowledgeBase.count(),
      prisma.kBDocument.count(),
      prisma.kBChunk.count(),
      prisma.kBDocument.groupBy({ by: ['embeddingStatus'], _count: true }),
    ]);

    res.json({
      success: true,
      data: { totalKBs, totalDocs, totalChunks, byEmbeddingStatus },
    });
  } catch (err) {
    next(err);
  }
});

// GET /:kbId - Knowledge base detail
router.get('/:kbId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kbId } = req.params as { kbId: string };
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      include: {
        org: { select: { id: true, name: true } },
        documents: {
          select: {
            id: true,
            title: true,
            contentType: true,
            embeddingStatus: true,
            createdAt: true,
            _count: { select: { chunks: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        agents: {
          include: { agent: { select: { id: true, name: true, isActive: true } } },
        },
      },
    });

    if (!kb) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    res.json({ success: true, data: kb });
  } catch (err) {
    next(err);
  }
});

// DELETE /:kbId - Delete knowledge base
router.delete('/:kbId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kbId } = req.params as { kbId: string };
    const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!kb) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    await prisma.knowledgeBase.delete({ where: { id: kbId } });

    await auditLogService.log({
      userId: req.user!.userId,
      action: 'ADMIN_KB_DELETED',
      targetType: 'KnowledgeBase',
      targetId: kbId,
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
