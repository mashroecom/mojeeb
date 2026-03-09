import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { inboundQueue } from '../../queues';
import { getChannelAdapter } from '../../channels';
import { webhookLimiter } from '../../middleware/rateLimiter';

const router: Router = Router({ mergeParams: true });

router.use(webhookLimiter);

// ── Multer config for file uploads ──
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '../../../uploads'),
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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = new Set([
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
      'text/plain',
    ]);
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

/**
 * Generate a signed URL for visitor file access
 * @param filename - The uploaded file's filename
 * @param visitorId - The visitor's ID
 * @returns Signed file URL with token query parameter
 */
function generateSignedFileUrl(filename: string, visitorId: string): string {
  const payload = {
    visitorId,
    filename,
  };

  // Sign token with 7-day expiration
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '7d' });

  return `/files/${filename}?token=${token}`;
}

/**
 * Middleware: Validate that the channelId exists, is active, and is a WEBCHAT channel.
 * Attaches the channel to req for downstream handlers.
 */
async function validateChannel(req: Request, res: Response, next: NextFunction) {
  const channelId = req.params.channelId as string;

  if (!channelId) {
    return res.status(400).json({ success: false, error: 'channelId is required' });
  }

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        agents: {
          where: { isPrimary: true },
          include: { agent: true },
        },
      },
    });

    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    if (channel.type !== 'WEBCHAT') {
      return res.status(400).json({ success: false, error: 'Channel is not a webchat channel' });
    }

    if (!channel.isActive) {
      return res.status(403).json({ success: false, error: 'Channel is not active' });
    }

    (req as any).channel = channel;
    next();
  } catch (err) {
    logger.error({ err, channelId }, 'Error validating webchat channel');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ──────────────────────────────────────────────────────────
// GET /api/v1/webchat/discover
// Public endpoint - returns the first active webchat channel
// Used by the ChatWidget component to auto-detect channel
// ──────────────────────────────────────────────────────────
router.get('/discover', async (_req: Request, res: Response) => {
  try {
    const channel = await prisma.channel.findFirst({
      where: { type: 'WEBCHAT', isActive: true },
      include: {
        agents: {
          where: { isPrimary: true },
          include: { agent: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!channel) {
      return res.status(404).json({ success: false, error: 'No active webchat channel found' });
    }

    const credentials = channel.credentials as Record<string, any> || {};
    const primaryAgent = channel.agents?.[0]?.agent;

    const agentLang = primaryAgent?.language || 'ar';
    const defaultDirection = agentLang === 'ar' ? 'rtl' : 'ltr';
    const defaultGreeting = agentLang === 'ar'
      ? 'أهلاً! 😊 كيف أقدر أساعدك؟'
      : 'Hi! How can I help you today? 😊';

    res.json({
      success: true,
      data: {
        channelId: channel.id,
        agentName: primaryAgent?.name || credentials.agentName || 'Support Agent',
        greeting: credentials.greeting || defaultGreeting,
        primaryColor: credentials.primaryColor || '#6366f1',
        position: credentials.position || 'bottom-right',
        direction: credentials.direction || defaultDirection,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Error discovering webchat channel');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Apply channel validation to all routes with :channelId
router.use('/:channelId', validateChannel as any);

// ──────────────────────────────────────────────────────────
// GET /api/v1/webchat/:channelId/config
// Public endpoint - returns widget configuration
// ──────────────────────────────────────────────────────────
router.get('/:channelId/config', async (req: Request, res: Response) => {
  try {
    const channel = (req as any).channel;
    const credentials = channel.credentials as Record<string, any> || {};
    const primaryAgent = channel.agents?.[0]?.agent;

    // Derive direction from agent language if not explicitly set
    const agentLang = primaryAgent?.language || 'ar';
    const defaultDirection = agentLang === 'ar' ? 'rtl' : 'ltr';
    const defaultGreeting = agentLang === 'ar'
      ? 'أهلاً! 😊 كيف أقدر أساعدك؟'
      : 'Hi! How can I help you today? 😊';

    res.json({
      success: true,
      data: {
        agentName: primaryAgent?.name || credentials.agentName || 'Support Agent',
        greeting: credentials.greeting || defaultGreeting,
        primaryColor: credentials.primaryColor || '#6366f1',
        position: credentials.position || 'bottom-right',
        direction: credentials.direction || defaultDirection,
        frontendUrl: process.env.FRONTEND_URL || 'https://mojeeb.app',
      },
    });
  } catch (err) {
    logger.error({ err }, 'Error fetching webchat config');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────
// POST /api/v1/webchat/:channelId/conversations
// Start or continue a conversation. Body: { visitorId, visitorName?, message }
// ──────────────────────────────────────────────────────────
router.post('/:channelId/conversations', async (req: Request, res: Response) => {
  try {
    const channel = (req as any).channel;
    const { visitorId, visitorName, message, forceNew } = req.body;

    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ success: false, error: 'visitorId is required' });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    if (message.length > 4000) {
      return res.status(400).json({ success: false, error: 'message exceeds maximum length of 4000 characters' });
    }

    // Find or create conversation in a transaction to avoid race conditions
    const conversation = await prisma.$transaction(async (tx) => {
      let conv = null;

      // If forceNew is true, skip searching for existing conversation
      if (!forceNew) {
        conv = await tx.conversation.findFirst({
          where: {
            channelId: channel.id,
            customerId: visitorId,
            status: { in: ['ACTIVE', 'WAITING', 'HANDED_OFF'] },
          },
        });
      }

      if (!conv) {
        const primaryAgentId = channel.agents?.[0]?.agentId || null;
        conv = await tx.conversation.create({
          data: {
            orgId: channel.orgId,
            channelId: channel.id,
            customerId: visitorId,
            customerName: visitorName || null,
            agentId: primaryAgentId,
            status: 'ACTIVE',
          },
        });
      }
      return conv;
    });

    // Parse the message through the webchat adapter
    const adapter = getChannelAdapter('WEBCHAT');
    const parsed = adapter.parseInbound({
      senderId: visitorId,
      senderName: visitorName || undefined,
      content: message,
      timestamp: new Date().toISOString(),
    });

    const inboundMessage = parsed[0]!;
    const messageId = inboundMessage.externalMessageId;

    // Queue for processing — pass conversationId so the worker uses the correct conversation
    await inboundQueue.add('process-message', {
      channelType: 'WEBCHAT',
      channelId: channel.id,
      orgId: channel.orgId,
      message: inboundMessage,
      receivedAt: new Date().toISOString(),
      conversationId: conversation.id,
    });

    res.status(200).json({
      success: true,
      data: {
        conversationId: conversation.id,
        messageId,
        status: conversation.status,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Error processing webchat message');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/v1/webchat/:channelId/conversations/:conversationId/messages
// Get paginated messages for a conversation
// Query: { limit?, cursor? }
// ──────────────────────────────────────────────────────────
router.get(
  '/:channelId/conversations/:conversationId/messages',
  async (req: Request, res: Response) => {
    try {
      const channel = (req as any).channel;
      const conversationId = req.params.conversationId as string;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const cursor = req.query.cursor as string | undefined;

      // Verify the conversation belongs to this channel.
      // Note: no visitor ownership check here — the channel match is sufficient
      // since conversation IDs are unguessable CUIDs and this is a read-only endpoint.
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          channelId: channel.id,
        },
      });

      if (!conversation) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }

      // Build the query for cursor-based pagination
      const messages = await prisma.message.findMany({
        where: {
          conversationId,
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // fetch one extra to determine if there are more
        select: {
          id: true,
          role: true,
          content: true,
          contentType: true,
          createdAt: true,
          metadata: true,
        },
      });

      const hasMore = messages.length > limit;
      const results = hasMore ? messages.slice(0, limit) : messages;
      const nextCursor = hasMore && results.length > 0 ? results[results.length - 1]!.createdAt.toISOString() : null;

      res.json({
        success: true,
        data: {
          messages: results.reverse(), // return in chronological order
          pagination: {
            hasMore,
            nextCursor,
          },
        },
      });
    } catch (err) {
      logger.error({ err }, 'Error fetching webchat messages');
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/v1/webchat/:channelId/conversations/visitor/:visitorId/list
// Get ALL conversations for a visitor (for conversation list in widget)
// ──────────────────────────────────────────────────────────
router.get(
  '/:channelId/conversations/visitor/:visitorId/list',
  async (req: Request, res: Response) => {
    try {
      const channel = (req as any).channel;
      const visitorId = req.params.visitorId as string;

      const conversations = await prisma.conversation.findMany({
        where: {
          channelId: channel.id,
          customerId: visitorId,
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 20,
        select: {
          id: true,
          status: true,
          lastMessageAt: true,
          messageCount: true,
          createdAt: true,
          summary: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              content: true,
              role: true,
            },
          },
        },
      });

      const data = conversations.map((conv: any) => {
        const lastMsg = conv.messages?.[0];
        let preview = conv.summary || '';
        if (!preview && lastMsg) {
          preview = lastMsg.content.length > 60
            ? lastMsg.content.slice(0, 60) + '...'
            : lastMsg.content;
        }
        return {
          id: conv.id,
          status: conv.status,
          lastMessageAt: conv.lastMessageAt,
          messageCount: conv.messageCount,
          createdAt: conv.createdAt,
          preview,
        };
      });

      res.json({
        success: true,
        data: { conversations: data },
      });
    } catch (err) {
      logger.error({ err }, 'Error fetching visitor conversation list');
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/v1/webchat/:channelId/conversations/by-visitor/:visitorId
// Get the active conversation for a visitor (used by widget on reconnect)
// ──────────────────────────────────────────────────────────
router.get(
  '/:channelId/conversations/by-visitor/:visitorId',
  async (req: Request, res: Response) => {
    try {
      const channel = (req as any).channel;
      const visitorId = req.params.visitorId as string;

      const conversation = await prisma.conversation.findFirst({
        where: {
          channelId: channel.id,
          customerId: visitorId,
          status: { in: ['ACTIVE', 'WAITING', 'HANDED_OFF'] },
        },
        orderBy: { lastMessageAt: 'desc' },
        select: {
          id: true,
          status: true,
          messageCount: true,
          lastMessageAt: true,
          createdAt: true,
        },
      });

      if (!conversation) {
        return res.status(404).json({ success: false, error: 'No active conversation found' });
      }

      res.json({
        success: true,
        data: { conversation },
      });
    } catch (err) {
      logger.error({ err }, 'Error fetching visitor conversation');
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// POST /api/v1/webchat/:channelId/conversations/:conversationId/rate
// Submit a CSAT rating for a conversation
// ──────────────────────────────────────────────────────────
router.post('/:channelId/conversations/:conversationId/rate', async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const { rating, feedback, customerId } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'rating must be between 1 and 5' });
    }

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customerId is required' });
    }

    const result = await prisma.conversationRating.upsert({
      where: {
        conversationId_customerId: { conversationId, customerId },
      },
      create: { conversationId, rating, feedback, customerId },
      update: { rating, feedback },
    });

    res.json({ success: true, data: { id: result.id } });
  } catch (err) {
    logger.error({ err }, 'Error saving rating');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────
// POST /api/v1/webchat/:channelId/upload
// Upload a file and send it as a message
// Body (multipart): file, visitorId, visitorName?
// ──────────────────────────────────────────────────────────
router.post('/:channelId/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const channel = (req as any).channel;
    const file = req.file;
    const { visitorId, visitorName } = req.body;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    if (!visitorId || typeof visitorId !== 'string') {
      return res.status(400).json({ success: false, error: 'visitorId is required' });
    }

    // Determine content type from mimetype
    let contentType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' = 'DOCUMENT';
    if (file.mimetype.startsWith('image/')) contentType = 'IMAGE';
    else if (file.mimetype.startsWith('video/')) contentType = 'VIDEO';
    else if (file.mimetype.startsWith('audio/')) contentType = 'AUDIO';

    // Generate signed URL for visitor access
    const signedFileUrl = generateSignedFileUrl(file.filename, visitorId);

    // Find or create conversation (wrapped in transaction to prevent race condition duplicates)
    const conversation = await prisma.$transaction(async (tx) => {
      let conv = await tx.conversation.findFirst({
        where: {
          channelId: channel.id,
          customerId: visitorId,
          status: { in: ['ACTIVE', 'WAITING', 'HANDED_OFF'] },
        },
      });

      if (!conv) {
        const primaryAgentId = channel.agents?.[0]?.agentId || null;
        conv = await tx.conversation.create({
          data: {
            orgId: channel.orgId,
            channelId: channel.id,
            customerId: visitorId,
            customerName: visitorName || null,
            agentId: primaryAgentId,
            status: 'ACTIVE',
          },
        });
      }

      return conv;
    }, { isolationLevel: 'ReadCommitted' });

    // Queue the file message for processing (pass conversationId to avoid duplicate creation in worker)
    await inboundQueue.add('process-message', {
      channelType: 'WEBCHAT',
      channelId: channel.id,
      orgId: channel.orgId,
      conversationId: conversation.id,
      message: {
        externalMessageId: `webchat_file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        senderId: visitorId,
        senderName: visitorName || undefined,
        content: signedFileUrl,
        contentType,
        rawPayload: {
          fileUrl: signedFileUrl,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      },
      receivedAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      data: {
        conversationId: conversation.id,
        fileUrl: signedFileUrl,
        contentType,
        fileName: file.originalname,
        fileSize: file.size,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Error uploading file');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
