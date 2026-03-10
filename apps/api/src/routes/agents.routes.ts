import { Router } from 'express';
import { agentService } from '../services/agent.service';
import { channelService } from '../services/channel.service';
import { validate } from '../middleware/validate';
import { authenticate, orgContext } from '../middleware/auth';
import { createAgentSchema } from '@mojeeb/shared-utils';
import { z } from 'zod';

interface OrgParams {
  orgId: string;
  [key: string]: string;
}
interface AgentParams {
  orgId: string;
  agentId: string;
  [key: string]: string;
}
interface AgentKBParams extends AgentParams {
  knowledgeBaseId: string;
}

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// POST /api/v1/organizations/:orgId/agents
router.post('/', validate({ body: createAgentSchema }), async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const agent = await agentService.create(orgId, req.body);
    res.status(201).json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/agents
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const agents = await agentService.list(orgId);
    res.json({ success: true, data: agents });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/agents/:agentId
router.get('/:agentId', async (req, res, next) => {
  try {
    const { orgId, agentId } = req.params as AgentParams;
    const agent = await agentService.getById(orgId, agentId);
    res.json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/organizations/:orgId/agents/:agentId
router.patch(
  '/:agentId',
  validate({ body: createAgentSchema.partial() }),
  async (req, res, next) => {
    try {
      const { orgId, agentId } = req.params as AgentParams;
      const agent = await agentService.update(orgId, agentId, req.body);
      res.json({ success: true, data: agent });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/organizations/:orgId/agents/:agentId
router.delete('/:agentId', async (req, res, next) => {
  try {
    const { orgId, agentId } = req.params as AgentParams;
    await agentService.delete(orgId, agentId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/agents/:agentId/test
router.post(
  '/:agentId/test',
  validate({
    body: z.object({
      message: z.string().min(1),
      history: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
          }),
        )
        .optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, agentId } = req.params as AgentParams;
      const result = await agentService.test(orgId, agentId, req.body.message, req.body.history);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/organizations/:orgId/agents/:agentId/knowledge-bases
router.post(
  '/:agentId/knowledge-bases',
  validate({ body: z.object({ knowledgeBaseId: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const { orgId, agentId } = req.params as AgentParams;
      const link = await agentService.linkKnowledgeBase(orgId, agentId, req.body.knowledgeBaseId);
      res.status(201).json({ success: true, data: link });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/organizations/:orgId/agents/:agentId/knowledge-bases/:knowledgeBaseId
router.delete('/:agentId/knowledge-bases/:knowledgeBaseId', async (req, res, next) => {
  try {
    const { orgId, agentId, knowledgeBaseId } = req.params as AgentKBParams;
    await agentService.unlinkKnowledgeBase(orgId, agentId, knowledgeBaseId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/agents/:agentId/channels
// Connect a new channel and assign the agent as primary in one call
router.post(
  '/:agentId/channels',
  validate({
    body: z.object({
      type: z.enum(['WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'WEBCHAT']),
      name: z.string().min(1).max(100),
      credentials: z.record(z.string()).default({}),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, agentId } = req.params as AgentParams;
      const { type, name, credentials } = req.body;

      // 1. Create the channel
      const channel = await channelService.connect(orgId, { type, name, credentials });

      // 2. Assign the agent as primary
      await channelService.assignAgent(channel.id, agentId, true);

      // 3. Invalidate agent cache so next fetch includes the new channel
      const { cache } = await import('../config/cache');
      await cache.del(`agent:${agentId}`);

      // 4. Return channel with agent info
      const fullChannel = await channelService.getById(orgId, channel.id);
      res.json({ success: true, data: fullChannel });
    } catch (error: any) {
      next(error);
    }
  },
);

export default router;
