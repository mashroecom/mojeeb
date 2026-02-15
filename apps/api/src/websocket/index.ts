import { Server as HttpServer } from 'http';
import { Namespace, Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../config/logger';
import type { JwtPayload } from '../middleware/auth';

let io: Server;
let webchatNs: Namespace;
let adminNs: Namespace;

// ── Rate limiting for WebSocket events ──────────────────────────────
const eventRateMap = new Map<string, number>();
const RATE_LIMIT_MS = 500;
const RATE_MAP_MAX_SIZE = 10000; // Safety cap to prevent unbounded growth

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const last = eventRateMap.get(key);
  if (last && now - last < RATE_LIMIT_MS) {
    return true;
  }
  // If map exceeds max size, clear oldest half to free memory
  if (eventRateMap.size >= RATE_MAP_MAX_SIZE) {
    const entries = [...eventRateMap.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    for (const [k] of toRemove) eventRateMap.delete(k);
  }
  eventRateMap.set(key, now);
  return false;
}

// Clean up stale rate-limit entries every 60s
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [k, v] of eventRateMap) {
    if (v < cutoff) eventRateMap.delete(k);
  }
}, 60000).unref();

// Validate ID format (CUID / UUID)
const SAFE_ID = /^[a-zA-Z0-9_-]{10,50}$/;

// ── Online presence tracking ──────────────────────────────
const onlineUsers = new Map<string, Set<string>>(); // orgId -> Set of userIds

function setUserOnline(orgId: string, userId: string) {
  if (!onlineUsers.has(orgId)) onlineUsers.set(orgId, new Set());
  onlineUsers.get(orgId)!.add(userId);
}

function setUserOffline(orgId: string, userId: string) {
  onlineUsers.get(orgId)?.delete(userId);
  if (onlineUsers.get(orgId)?.size === 0) onlineUsers.delete(orgId);
}

function getOnlineUsers(orgId: string): string[] {
  return Array.from(onlineUsers.get(orgId) || []);
}

export function setupWebSocket(httpServer: HttpServer) {
  const allowedOrigins = [config.frontendUrl];
  if (config.nodeEnv === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:4000');
  }

  io = new Server(httpServer, {
    cors: {
      // Open CORS required: webchat namespace is embedded on any customer site.
      // Each namespace enforces its own auth (JWT for dashboard, channelId for webchat).
      origin: true,
      credentials: true,
    },
    path: '/ws',
  });

  // ── Default namespace (dashboard - requires origin check + JWT) ──
  io.use((socket, next) => {
    // Verify origin for dashboard connections in production
    const origin = socket.handshake.headers.origin;
    if (origin && config.nodeEnv !== 'development' && !allowedOrigins.includes(origin)) {
      return next(new Error('Origin not allowed'));
    }

    const token = socket.handshake.auth.token as string;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user?.userId;
    logger.info({ userId }, 'WebSocket client connected');

    socket.on('join:org', async (orgId: string) => {
      if (typeof orgId !== 'string' || !SAFE_ID.test(orgId)) return;
      // Verify user belongs to this organization
      try {
        const { prisma } = await import('../config/database');
        const membership = await prisma.orgMembership.findUnique({
          where: { userId_orgId: { userId, orgId } },
          select: { id: true },
        });
        if (!membership) return;
        socket.join(`org:${orgId}`);
      } catch (err) {
        logger.warn({ err, userId, orgId }, 'Failed to verify org membership for WebSocket');
      }
    });

    socket.on('presence:online', (orgId: string) => {
      if (typeof orgId !== 'string' || !SAFE_ID.test(orgId)) return;
      setUserOnline(orgId, userId);
      socket.to(`org:${orgId}`).emit('presence:update', {
        userId,
        status: 'online',
      });
    });

    socket.on('presence:offline', (orgId: string) => {
      if (typeof orgId !== 'string' || !SAFE_ID.test(orgId)) return;
      setUserOffline(orgId, userId);
      socket.to(`org:${orgId}`).emit('presence:update', {
        userId,
        status: 'offline',
      });
    });

    socket.on('presence:list', (orgId: string) => {
      if (typeof orgId !== 'string' || !SAFE_ID.test(orgId)) return;
      socket.emit('presence:list', getOnlineUsers(orgId));
    });

    socket.on('join:conversation', async (conversationId: string) => {
      if (typeof conversationId !== 'string' || !SAFE_ID.test(conversationId)) return;
      // Verify conversation belongs to an org the user is a member of
      try {
        const { prisma } = await import('../config/database');
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { orgId: true },
        });
        if (!conversation) return;
        const membership = await prisma.orgMembership.findUnique({
          where: { userId_orgId: { userId, orgId: conversation.orgId } },
          select: { id: true },
        });
        if (!membership) return;
        socket.join(`conv:${conversationId}`);
      } catch (err) {
        logger.warn({ err, userId, conversationId }, 'Failed to verify conversation access for WebSocket');
      }
    });

    socket.on('leave:conversation', (conversationId: string) => {
      if (typeof conversationId !== 'string' || !SAFE_ID.test(conversationId)) return;
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('typing:start', (conversationId: string) => {
      if (typeof conversationId !== 'string' || !SAFE_ID.test(conversationId)) return;
      if (isRateLimited(`typing:${userId}`)) return;
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        userId,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      if (typeof conversationId !== 'string' || !SAFE_ID.test(conversationId)) return;
      if (isRateLimited(`typing:${userId}`)) return;
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId,
      });
    });

    socket.on('disconnect', () => {
      // Clean up presence from all orgs
      for (const [orgId, users] of onlineUsers) {
        if (users.has(userId)) {
          users.delete(userId);
          io.to(`org:${orgId}`).emit('presence:update', { userId, status: 'offline' });
          if (users.size === 0) onlineUsers.delete(orgId);
        }
      }
      logger.info({ userId }, 'WebSocket client disconnected');
    });
  });

  // ── Webchat namespace (public - visitors authenticate via channelId+visitorId) ──
  webchatNs = io.of('/webchat');

  webchatNs.use(async (socket, next) => {
    const { channelId } = socket.handshake.auth as { channelId?: string };
    if (!channelId || !SAFE_ID.test(channelId)) {
      return next(new Error('channelId is required'));
    }
    try {
      const { prisma } = await import('../config/database');
      const channel = await prisma.channel.findFirst({
        where: { id: channelId, isActive: true },
        select: { id: true },
      });
      if (!channel) {
        return next(new Error('Invalid or inactive channel'));
      }
      next();
    } catch (err) {
      next(new Error('Connection validation failed'));
    }
  });

  webchatNs.on('connection', (socket) => {
    const { channelId, visitorId } = socket.handshake.auth as { channelId?: string; visitorId?: string };

    if (!channelId || !visitorId) {
      socket.disconnect();
      return;
    }

    socket.data.channelId = channelId;
    socket.data.visitorId = visitorId;
    logger.info({ channelId, visitorId }, 'Webchat visitor connected');

    socket.on('join:conversation', async (conversationId: string) => {
      if (typeof conversationId !== 'string' || !SAFE_ID.test(conversationId)) return;
      // Verify visitor owns this conversation
      try {
        const { prisma } = await import('../config/database');
        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, channelId, customerId: visitorId },
          select: { id: true },
        });
        if (!conversation) return;
        socket.join(`conv:${conversationId}`);
        logger.debug({ conversationId, visitorId }, 'Visitor joined conversation room');
      } catch (err) {
        logger.warn({ err, visitorId, conversationId }, 'Failed to verify conversation ownership for webchat');
      }
    });

    socket.on('leave:conversation', (conversationId: string) => {
      if (typeof conversationId !== 'string' || !SAFE_ID.test(conversationId)) return;
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('typing:start', (conversationId: string) => {
      if (typeof conversationId !== 'string' || !SAFE_ID.test(conversationId)) return;
      if (isRateLimited(`typing:visitor:${visitorId}`)) return;
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        isVisitor: true,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      if (typeof conversationId !== 'string' || !SAFE_ID.test(conversationId)) return;
      if (isRateLimited(`typing:visitor:${visitorId}`)) return;
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        isVisitor: true,
      });
    });

    socket.on('disconnect', () => {
      logger.debug({ visitorId }, 'Webchat visitor disconnected');
    });
  });

  // ── Admin namespace (super admin - real-time monitoring) ──
  adminNs = io.of('/admin');

  adminNs.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      const { prisma } = await import('../config/database');
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { isSuperAdmin: true },
      });
      if (!user?.isSuperAdmin) return next(new Error('Admin access required'));
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  adminNs.on('connection', (socket) => {
    socket.join('admin:feed');
    logger.info({ userId: socket.data.user?.userId }, 'Admin connected to live feed');
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('WebSocket not initialized');
  }
  return io;
}

// Helper to emit events to an organization
export function emitToOrg(orgId: string, event: string, data: unknown) {
  if (io) {
    io.to(`org:${orgId}`).emit(event, data);
  }
}

// Helper to emit events to a conversation (both dashboard + webchat namespaces)
export function emitToConversation(conversationId: string, event: string, data: unknown) {
  if (io) {
    io.to(`conv:${conversationId}`).emit(event, data);
  }
  if (webchatNs) {
    webchatNs.to(`conv:${conversationId}`).emit(event, data);
  }
}

// Helper to emit events to all connected admin users
export function emitToAdmin(event: string, data: unknown) {
  if (adminNs) {
    adminNs.to('admin:feed').emit(event, data);
  }
}
