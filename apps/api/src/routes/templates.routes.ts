import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { templateSuggestionPipeline } from '../ai/pipelines/templateSuggestion.pipeline';
import { decodeTemplateVariables } from '../utils/templateVariables';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

const TEMPLATE_SELECT = {
  id: true,
  title: true,
  titleAr: true,
  contentEn: true,
  contentAr: true,
  category: true,
  shortcut: true,
  variables: true,
  isShared: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.MessageTemplateSelect;

type TemplateRow = Prisma.MessageTemplateGetPayload<{ select: typeof TEMPLATE_SELECT }>;

/**
 * Shape used by the reply-template picker: `content` mirrors the English content
 * and `variables` is the flat list of variable keys.
 */
function toPickerTemplate(template: TemplateRow) {
  return {
    ...template,
    content: template.contentEn,
    variables: decodeTemplateVariables(template.variables).map((v) => v.key),
  };
}

/**
 * Resolve which organization the request is about: the `orgId` query/body value when
 * the user is a member of it, otherwise the user's first organization.
 */
async function resolveOrgId(req: Request): Promise<string | null> {
  const userId = req.user!.userId;
  const requested =
    (typeof req.query.orgId === 'string' && req.query.orgId) ||
    (typeof req.body?.orgId === 'string' && req.body.orgId) ||
    undefined;

  const membership = await prisma.orgMembership.findFirst({
    where: { userId, ...(requested && { orgId: requested }) },
    orderBy: { createdAt: 'asc' },
    select: { orgId: true },
  });
  return membership?.orgId ?? null;
}

/**
 * Templates a member may use: organization-wide templates (shared, or created from
 * the templates page without a personal owner) plus the member's own.
 */
function visibleTo(userId: string): Prisma.MessageTemplateWhereInput {
  return { OR: [{ isShared: true }, { userId: null }, { userId }] };
}

// GET / - List templates for the authenticated user's organization
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const isShared = req.query.isShared as string | undefined;

    const orgId = await resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'User organization not found' });
    }

    const filters: Prisma.MessageTemplateWhereInput[] = [];

    // Shared-only, personal-only, or (default) everything the member may use
    if (isShared === 'true') {
      filters.push({ isShared: true });
    } else if (isShared === 'false') {
      filters.push({ isShared: false, userId });
    } else {
      filters.push(visibleTo(userId));
    }

    // Search in titles and contents (both languages) and the shortcut
    if (search) {
      filters.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { titleAr: { contains: search, mode: 'insensitive' } },
          { contentEn: { contains: search, mode: 'insensitive' } },
          { contentAr: { contains: search, mode: 'insensitive' } },
          { shortcut: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const templates = await prisma.messageTemplate.findMany({
      where: {
        orgId,
        isActive: true,
        ...(category && { category }),
        AND: filters,
      },
      select: TEMPLATE_SELECT,
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: templates.map(toPickerTemplate) });
  } catch (err) {
    next(err);
  }
});

// GET /:templateId - Get a specific template
router.get('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params as { templateId: string };
    const userId = req.user!.userId;

    const orgId = await resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'User organization not found' });
    }

    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, orgId, isActive: true, ...visibleTo(userId) },
      select: TEMPLATE_SELECT,
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({ success: true, data: toPickerTemplate(template) });
  } catch (err) {
    next(err);
  }
});

// POST /:templateId/use - Track template usage
router.post('/:templateId/use', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params as { templateId: string };
    const userId = req.user!.userId;

    const orgId = await resolveOrgId(req);
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'User organization not found' });
    }

    // Verify template exists and user has access
    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, orgId, isActive: true, ...visibleTo(userId) },
      select: { id: true },
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const updated = await prisma.messageTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    res.json({ success: true, data: { id: updated.id, usageCount: updated.usageCount } });
  } catch (err) {
    next(err);
  }
});

const suggestTemplatesSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
  orgId: z.string().min(1).optional(),
});

// POST /suggest - Get AI-suggested templates based on conversation context
router.post(
  '/suggest',
  validate({ body: suggestTemplatesSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.body as { conversationId: string };
      const userId = req.user!.userId;

      const orgId = await resolveOrgId(req);
      if (!orgId) {
        return res.status(400).json({ success: false, message: 'User organization not found' });
      }

      // Verify user has access to the conversation
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          channel: {
            orgId,
          },
        },
      });

      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      // Get AI suggestions (ranked template ids), then return them in the same shape
      // as the template list so the picker can render and insert them directly
      const ranked = await templateSuggestionPipeline.suggest({
        conversationId,
        orgId,
        userId,
      });

      const rows = ranked.length
        ? await prisma.messageTemplate.findMany({
            where: {
              id: { in: ranked.map((r) => r.id) },
              orgId,
              isActive: true,
              ...visibleTo(userId),
            },
            select: TEMPLATE_SELECT,
          })
        : [];
      const byId = new Map(rows.map((row) => [row.id, row]));

      const suggestions = ranked.flatMap((r) => {
        const row = byId.get(r.id);
        return row
          ? [
              {
                template: toPickerTemplate(row),
                relevance: r.relevanceScore,
                reasoning: r.reasoning,
              },
            ]
          : [];
      });

      res.json({
        success: true,
        data: {
          suggestions,
          conversationId,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
