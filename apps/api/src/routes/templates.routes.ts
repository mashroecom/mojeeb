import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

// GET / - List templates for the authenticated user's organization
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const isShared = req.query.isShared as string | undefined;

    // Get user's orgId from their membership
    const membership = await prisma.orgMembership.findFirst({
      where: { userId },
      select: { orgId: true },
    });

    if (!membership) {
      return res.status(400).json({ success: false, message: 'User organization not found' });
    }

    const orgId = membership.orgId;

    const where: any = {
      orgId,
      isActive: true,
    };

    // Filter by search term (searches title and content)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { titleAr: { contains: search, mode: 'insensitive' } },
        { contentAr: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by category
    if (category) {
      where.category = category;
    }

    // Filter by shared/personal
    if (isShared === 'true') {
      where.isShared = true;
    } else if (isShared === 'false') {
      where.OR = [
        { isShared: false, userId },
        { isShared: true }, // Include shared templates for everyone
      ];
    } else {
      // Default: show both shared templates and user's personal templates
      where.OR = [
        { isShared: true },
        { userId },
      ];
    }

    const templates = await prisma.messageTemplate.findMany({
      where,
      select: {
        id: true,
        title: true,
        titleAr: true,
        content: true,
        contentAr: true,
        category: true,
        shortcut: true,
        variables: true,
        isShared: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      success: true,
      data: templates,
    });
  } catch (err) {
    next(err);
  }
});

// GET /:templateId - Get a specific template
router.get('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params as { templateId: string };
    const userId = req.user!.userId;

    // Get user's orgId from their membership
    const membership = await prisma.orgMembership.findFirst({
      where: { userId },
      select: { orgId: true },
    });

    if (!membership) {
      return res.status(400).json({ success: false, message: 'User organization not found' });
    }

    const orgId = membership.orgId;

    const template = await prisma.messageTemplate.findFirst({
      where: {
        id: templateId,
        orgId,
        isActive: true,
        OR: [
          { isShared: true },
          { userId },
        ],
      },
      select: {
        id: true,
        title: true,
        titleAr: true,
        content: true,
        contentAr: true,
        category: true,
        shortcut: true,
        variables: true,
        isShared: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

// POST /:templateId/use - Track template usage
router.post('/:templateId/use', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params as { templateId: string };
    const userId = req.user!.userId;

    // Get user's orgId from their membership
    const membership = await prisma.orgMembership.findFirst({
      where: { userId },
      select: { orgId: true },
    });

    if (!membership) {
      return res.status(400).json({ success: false, message: 'User organization not found' });
    }

    const orgId = membership.orgId;

    // Verify template exists and user has access
    const template = await prisma.messageTemplate.findFirst({
      where: {
        id: templateId,
        orgId,
        isActive: true,
        OR: [
          { isShared: true },
          { userId },
        ],
      },
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Increment usage count
    const updated = await prisma.messageTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        usageCount: updated.usageCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
