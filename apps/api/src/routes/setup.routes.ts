import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { createAgentSchema, connectChannelSchema } from '@mojeeb/shared-utils';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { prisma } from '../config/database';
import { agentService } from '../services/agent.service';
import { channelService } from '../services/channel.service';
import { knowledgeBaseService } from '../services/knowledgeBase.service';
import { organizationService } from '../services/organization.service';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';

/**
 * Onboarding ("setup wizard") routes.
 *
 * These endpoints are org-less on purpose: a freshly registered user does not
 * need to know their organization id — it is resolved from their membership.
 * Every step is optional and idempotent enough to be retried or resumed.
 */

const router: Router = Router();

router.use(authenticate);

const DEFAULT_KB_NAME = 'Knowledge Base';

const companySchema = z.object({
  name: z.string().trim().min(1).max(100),
  industry: z.string().trim().max(100).optional(),
  websiteUrl: z.string().trim().max(500).optional(),
});

const setupAgentSchema = createAgentSchema.pick({
  name: true,
  description: true,
  aiProvider: true,
  aiModel: true,
  systemPrompt: true,
  templateType: true,
  temperature: true,
  maxTokens: true,
  language: true,
  enableEmotionDetection: true,
  enableLeadExtraction: true,
  enableHumanHandoff: true,
  handoffThreshold: true,
});

const setupChannelSchema = connectChannelSchema.pick({ type: true, name: true }).extend({
  credentials: z.record(z.string()).optional().default({}),
  agentId: z.string().min(1).optional(),
});

const setupKnowledgeBaseSchema = z.object({
  agentId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  documents: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(500),
        content: z.string().max(500_000).optional(),
        contentType: z.enum(['TEXT', 'PDF', 'URL']).optional().default('TEXT'),
        sourceUrl: z.string().url().max(2000).optional(),
        fileBase64: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

/**
 * Resolve the organization the onboarding wizard should act on: the first
 * organization the user owns or administers.
 */
async function resolveSetupOrg(req: Request): Promise<{ orgId: string; userId: string }> {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('Authentication required');

  const memberships = await prisma.orgMembership.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { orgId: true, role: true },
  });
  if (memberships.length === 0) throw new NotFoundError('Organization not found');

  const manageable = memberships.find((m) => m.role === 'OWNER' || m.role === 'ADMIN');
  if (!manageable) throw new ForbiddenError('Insufficient permissions');

  return { orgId: manageable.orgId, userId };
}

function normalizeWebsiteUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return undefined;
  }
}

// GET /api/v1/setup/status — what has already been set up (used to resume the wizard)
router.get('/status', async (req, res, next) => {
  try {
    const { orgId, userId } = await resolveSetupOrg(req);

    const [org, user, agent, channelCount, kbDocCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, industry: true, websiteUrl: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { onboardingCompleted: true } }),
      prisma.agent.findFirst({
        where: { orgId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.channel.count({ where: { orgId } }),
      prisma.kBDocument.count({ where: { knowledgeBase: { orgId } } }),
    ]);

    res.json({
      success: true,
      data: {
        orgId,
        company: Boolean(org?.industry || org?.websiteUrl),
        organization: org,
        agentId: agent?.id ?? null,
        agentName: agent?.name ?? null,
        channel: channelCount > 0,
        knowledgeBase: kbDocCount > 0,
        completed: user?.onboardingCompleted ?? false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/setup/company — save company profile onto the organization
router.post('/company', validate({ body: companySchema }), async (req, res, next) => {
  try {
    const { orgId } = await resolveSetupOrg(req);
    const { name, industry, websiteUrl } = req.body as z.infer<typeof companySchema>;

    const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
    await organizationService.update(orgId, {
      name,
      ...(normalizedUrl !== undefined && { websiteUrl: normalizedUrl }),
    });
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { ...(industry !== undefined && { industry }) },
      select: { id: true, name: true, slug: true, industry: true, websiteUrl: true },
    });

    res.json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/setup/agent — create the first AI agent
router.post('/agent', validate({ body: setupAgentSchema }), async (req, res, next) => {
  try {
    const { orgId } = await resolveSetupOrg(req);
    const agent = await agentService.create(orgId, req.body);
    res.status(201).json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/setup/knowledge-base — add documents to the org's starter knowledge
// base (created on first use) and link it to the agent
router.post(
  '/knowledge-base',
  validate({ body: setupKnowledgeBaseSchema }),
  async (req, res, next) => {
    try {
      const { orgId } = await resolveSetupOrg(req);
      const { agentId, name, documents } = req.body as z.infer<typeof setupKnowledgeBaseSchema>;

      if (agentId) {
        const agent = await prisma.agent.findFirst({
          where: { id: agentId, orgId },
          select: { id: true },
        });
        if (!agent) throw new NotFoundError('Agent not found');
      }

      // Reuse the KB already linked to this agent (or the org's first KB) so that
      // repeated wizard submissions keep adding to the same knowledge base.
      let kb = agentId
        ? await prisma.knowledgeBase.findFirst({
            where: { orgId, agents: { some: { agentId } } },
            orderBy: { createdAt: 'asc' },
          })
        : null;
      if (!kb) {
        kb = await prisma.knowledgeBase.findFirst({
          where: { orgId },
          orderBy: { createdAt: 'asc' },
        });
      }
      if (!kb) {
        kb = await knowledgeBaseService.create(orgId, { name: name || DEFAULT_KB_NAME });
      }

      if (agentId) {
        await agentService.linkKnowledgeBase(orgId, agentId, kb.id);
      }

      const created = [];
      for (const doc of documents) {
        created.push(await knowledgeBaseService.addDocument(kb.id, doc));
      }

      res.status(201).json({
        success: true,
        data: {
          knowledgeBase: { id: kb.id, name: kb.name },
          documents: created.map((d) => ({
            id: d.id,
            title: d.title,
            contentType: d.contentType,
            embeddingStatus: d.embeddingStatus,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/setup/channel — connect the first channel and attach the agent to it
router.post('/channel', validate({ body: setupChannelSchema }), async (req, res, next) => {
  try {
    const { orgId } = await resolveSetupOrg(req);
    const { type, name, credentials, agentId } = req.body as z.infer<typeof setupChannelSchema>;

    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, orgId },
        select: { id: true },
      });
      if (!agent) throw new NotFoundError('Agent not found');
    }

    const channel = await channelService.connect(orgId, { type, name, credentials });
    if (agentId) {
      await channelService.assignAgent(channel.id, agentId, true);
    }

    const result = await channelService.getById(orgId, channel.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/setup/complete — mark onboarding as completed
router.post('/complete', async (req, res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { onboardingCompleted: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
