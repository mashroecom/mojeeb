import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { conversationService } from '../services/conversation.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paginationSchema, sendMessageSchema } from '@mojeeb/shared-utils';
import { emitToOrg, emitToConversation } from '../websocket';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config';

const uploadStorage = multer.diskStorage({
  destination: path.resolve(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv',
  '.mp4', '.webm', '.mov',
  '.mp3', '.ogg', '.wav',
]);

const dashboardUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = new Set([
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
    ]);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowedTypes.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext));
  },
});

/**
 * Generate a signed URL for dashboard file access
 * @param filename - The uploaded file's filename
 * @param userId - The user's ID
 * @returns Signed file URL with token query parameter
 */
function generateSignedFileUrl(filename: string, userId: string): string {
  const payload = {
    userId,
    filename,
  };

  // Sign token with 7-day expiration
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '7d' });

  return `/files/${filename}?token=${token}`;
}

interface OrgParams { orgId: string; [key: string]: string; }
interface ConvParams { orgId: string; convId: string; [key: string]: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// GET /api/v1/organizations/:orgId/conversations
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const result = await conversationService.list(orgId, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string,
      channelId: req.query.channelId as string,
      search: req.query.search as string,
    });
    res.json({ success: true, data: result.conversations, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/conversations/bulk-archive
// NOTE: This must be registered before /:convId routes to avoid matching "bulk-archive" as a convId.
router.post('/bulk-archive', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const { conversationIds } = req.body as { conversationIds: string[] };

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'conversationIds must be a non-empty array',
      });
    }

    const result = await conversationService.bulkArchive(orgId, conversationIds);
    emitToOrg(orgId, 'conversations:bulk-updated', {
      conversationIds,
      status: 'ARCHIVED',
      archivedCount: result.archivedCount,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/conversations/:convId
router.get('/:convId', async (req, res, next) => {
  try {
    const { orgId, convId } = req.params as ConvParams;
    const conversation = await conversationService.getById(orgId, convId);
    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/conversations/:convId/messages
router.get('/:convId/messages', async (req, res, next) => {
  try {
    const { orgId, convId } = req.params as ConvParams;
    // Verify conversation belongs to this organization
    const conversation = await prisma.conversation.findFirst({
      where: { id: convId, orgId },
      select: { id: true },
    });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    const result = await conversationService.getMessages(convId, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ success: true, data: result.messages, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/conversations/:convId/messages
router.post(
  '/:convId/messages',
  validate({ body: sendMessageSchema }),
  async (req, res, next) => {
    try {
      const { orgId, convId } = req.params as ConvParams;
      // Verify conversation belongs to this organization
      const conv = await prisma.conversation.findFirst({
        where: { id: convId, orgId },
        select: { id: true },
      });
      if (!conv) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }
      const message = await conversationService.sendHumanMessage(
        convId,
        req.user!.userId,
        req.body.content
      );

      // Emit via WebSocket
      emitToConversation(convId, 'message:new', {
        messageId: message.id,
        conversationId: convId,
        role: message.role,
        content: message.content,
        contentType: message.contentType,
        createdAt: message.createdAt,
      });

      res.status(201).json({ success: true, data: message });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/organizations/:orgId/conversations/:convId/handoff
router.post('/:convId/handoff', async (req, res, next) => {
  try {
    const { orgId, convId } = req.params as ConvParams;
    // Verify conversation belongs to this organization
    const existing = await prisma.conversation.findFirst({ where: { id: convId, orgId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, error: 'Conversation not found' });
    const conversation = await conversationService.handoff(convId, req.user!.userId);
    const handoffPayload = {
      conversationId: conversation!.id,
      status: conversation!.status,
    };
    emitToOrg(orgId, 'conversation:updated', handoffPayload);
    emitToConversation(convId, 'conversation:updated', handoffPayload);
    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/conversations/:convId/return-to-ai
router.post('/:convId/return-to-ai', async (req, res, next) => {
  try {
    const { orgId, convId } = req.params as ConvParams;
    const existing = await prisma.conversation.findFirst({ where: { id: convId, orgId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, error: 'Conversation not found' });
    const conversation = await conversationService.returnToAI(convId);
    const returnPayload = {
      conversationId: conversation.id,
      status: conversation.status,
    };
    emitToOrg(orgId, 'conversation:updated', returnPayload);
    emitToConversation(convId, 'conversation:updated', returnPayload);
    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/conversations/:convId/resolve
router.post('/:convId/resolve', async (req, res, next) => {
  try {
    const { orgId, convId } = req.params as ConvParams;
    const existing = await prisma.conversation.findFirst({ where: { id: convId, orgId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, error: 'Conversation not found' });
    const conversation = await conversationService.resolve(convId);
    const resolvePayload = {
      conversationId: conversation.id,
      status: conversation.status,
    };
    emitToOrg(orgId, 'conversation:updated', resolvePayload);
    emitToConversation(convId, 'conversation:updated', resolvePayload);
    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/conversations/:convId/upload
// Upload a file from the dashboard (human agent)
router.post(
  '/:convId/upload',
  dashboardUpload.single('file'),
  async (req, res, next) => {
    try {
      const { orgId, convId } = req.params as ConvParams;
      // Verify conversation belongs to this organization
      const existingConv = await prisma.conversation.findFirst({ where: { id: convId, orgId }, select: { id: true } });
      if (!existingConv) return res.status(404).json({ success: false, error: 'Conversation not found' });
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      let contentType: 'IMAGE' | 'DOCUMENT' = 'DOCUMENT';
      if (file.mimetype.startsWith('image/')) contentType = 'IMAGE';

      const fileUrl = generateSignedFileUrl(file.filename, req.user!.userId);

      const message = await prisma.message.create({
        data: {
          conversationId: convId,
          role: 'HUMAN_AGENT',
          content: fileUrl,
          contentType,
          humanAgentId: req.user!.userId,
        },
      });

      await prisma.conversation.update({
        where: { id: convId },
        data: {
          messageCount: { increment: 1 },
          lastMessageAt: new Date(),
          status: 'ACTIVE',
        },
      });

      emitToConversation(convId, 'message:new', {
        messageId: message.id,
        conversationId: convId,
        role: message.role,
        content: message.content,
        contentType: message.contentType,
        createdAt: message.createdAt,
      });

      res.status(201).json({ success: true, data: message });
    } catch (err) {
      logger.error({ err }, 'Error uploading file from dashboard');
      next(err);
    }
  }
);

// POST /api/v1/organizations/:orgId/conversations/:convId/archive
router.post('/:convId/archive', async (req, res, next) => {
  try {
    const { orgId, convId } = req.params as ConvParams;
    const conversation = await conversationService.archive(orgId, convId);
    emitToOrg(orgId, 'conversation:updated', {
      conversationId: conversation.id,
      status: conversation.status,
    });
    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/organizations/:orgId/conversations/:convId
router.delete('/:convId', async (req, res, next) => {
  try {
    const { orgId, convId } = req.params as ConvParams;
    await conversationService.delete(orgId, convId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

export default router;
