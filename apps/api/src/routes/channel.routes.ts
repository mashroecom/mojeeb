import { Router } from 'express';
import { channelService } from '../services/channel.service';
import { validate } from '../middleware/validate';
import { authenticate, orgContext } from '../middleware/auth';
import { z } from 'zod';

interface OrgParams {
  orgId: string;
  [key: string]: string;
}

interface ChannelParams {
  orgId: string;
  channelId: string;
  [key: string]: string;
}

interface AgentParams {
  orgId: string;
  channelId: string;
  agentId: string;
  [key: string]: string;
}

const connectSchema = z.object({
  type: z.enum(['WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'WEBCHAT']),
  name: z.string().min(1).max(100),
  credentials: z.record(z.string()).default({}),
});

const updateSettingsSchema = z.object({
  primaryColor: z.string().optional(),
  greeting: z.string().optional(),
  position: z.enum(['bottom-right', 'bottom-left']).optional(),
});

const assignAgentSchema = z.object({
  agentId: z.string().min(1),
  isPrimary: z.boolean().default(true),
});

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// GET /api/v1/organizations/:orgId/channels
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const channels = await channelService.list(orgId);
    res.json({ success: true, data: channels });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/channels
router.post('/', validate({ body: connectSchema }), async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const channel = await channelService.connect(orgId, req.body);
    res.status(201).json({ success: true, data: channel });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/channels/:channelId
router.get('/:channelId', async (req, res, next) => {
  try {
    const { orgId, channelId } = req.params as ChannelParams;
    const channel = await channelService.getById(orgId, channelId);
    res.json({ success: true, data: channel });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/organizations/:orgId/channels/:channelId
router.delete('/:channelId', async (req, res, next) => {
  try {
    const { orgId, channelId } = req.params as ChannelParams;
    await channelService.disconnect(orgId, channelId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/organizations/:orgId/channels/:channelId/toggle
router.patch('/:channelId/toggle', async (req, res, next) => {
  try {
    const { orgId, channelId } = req.params as ChannelParams;
    const channel = await channelService.toggleActive(orgId, channelId);
    res.json({ success: true, data: channel });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/organizations/:orgId/channels/:channelId/settings
router.patch(
  '/:channelId/settings',
  validate({ body: updateSettingsSchema }),
  async (req, res, next) => {
    try {
      const { orgId, channelId } = req.params as ChannelParams;
      const channel = await channelService.updateSettings(orgId, channelId, req.body);
      res.json({ success: true, data: channel });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/organizations/:orgId/channels/:channelId/agents
router.post('/:channelId/agents', validate({ body: assignAgentSchema }), async (req, res, next) => {
  try {
    const { orgId, channelId } = req.params as ChannelParams;
    // Verify channel belongs to this org
    const channel = await channelService.getById(orgId, channelId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });
    const { agentId, isPrimary } = req.body;
    const assignment = await channelService.assignAgent(channelId, agentId, isPrimary);
    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/organizations/:orgId/channels/:channelId/agents/:agentId
router.delete('/:channelId/agents/:agentId', async (req, res, next) => {
  try {
    const { orgId, channelId, agentId } = req.params as AgentParams;
    // Verify channel belongs to this org
    const channel = await channelService.getById(orgId, channelId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });
    await channelService.removeAgent(channelId, agentId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
