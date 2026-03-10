import { Server as HttpServer } from 'http';
import { Namespace, Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
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
async function setUserOnline(orgId: string, userId: string) {
  try {
    await redis.sadd(`online:${orgId}`, userId);
  } catch (err) {
    logger.error({ err, orgId, userId }, 'Failed to set user online');
  }
}

async function setUserOffline(orgId: string, userId: string) {
  try {
    await redis.srem(`online:${orgId}`, userId);
  } catch (err) {
    logger.error({ err, orgId, userId }, 'Failed to set user offline');
  }
}

async function getOnlineUsers(orgId: string): Promise<string[]> {
  try {
    return await redis.smembers(`online:${orgId}`);
  } catch (err) {
    logger.error({ err, orgId }, 'Failed to get online users');
    return [];
  }
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

  // ── Configure Redis adapter for horizontal scaling ──
  const pubClient = redis;
  const subClient = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  subClient.on('connect', () => {
    logger.info('Redis subscriber connected for Socket.IO');
  });

  subClient.on('error', (err) => {
    logger.error({ err }, 'Redis subscriber connection error');
  });

  io.adapter(createAdapter(pubClient, subClient));
  logger.info('Socket.IO configured with Redis adapter');

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
    socket.data.onlineOrgs = new Set<string>(); // Track which orgs user is online in
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

    socket.on('presence:online', async (orgId: string) => {
      if (typeof orgId !== 'string' || !SAFE_ID.test(orgId)) return;
      await setUserOnline(orgId, userId);
      socket.data.onlineOrgs.add(orgId);
      socket.to(`org:${orgId}`).emit('presence:update', {
        userId,
        status: 'online',
      });
    });

    socket.on('presence:offline', async (orgId: string) => {
      if (typeof orgId !== 'string' || !SAFE_ID.test(orgId)) return;
      await setUserOffline(orgId, userId);
      socket.data.onlineOrgs.delete(orgId);
      socket.to(`org:${orgId}`).emit('presence:update', {
        userId,
        status: 'offline',
      });
    });

    socket.on('presence:list', async (orgId: string) => {
      if (typeof orgId !== 'string' || !SAFE_ID.test(orgId)) return;
      const users = await getOnlineUsers(orgId);
      socket.emit('presence:list', users);
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
        logger.warn(
          { err, userId, conversationId },
          'Failed to verify conversation access for WebSocket',
        );
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

    socket.on('disconnect', async () => {
      // Clean up presence from all orgs user was online in
      const onlineOrgs = socket.data.onlineOrgs as Set<string>;
      if (onlineOrgs) {
        for (const orgId of onlineOrgs) {
          await setUserOffline(orgId, userId);
          io.to(`org:${orgId}`).emit('presence:update', { userId, status: 'offline' });
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
    const { channelId, visitorId } = socket.handshake.auth as {
      channelId?: string;
      visitorId?: string;
    };

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
        logger.warn(
          { err, visitorId, conversationId },
          'Failed to verify conversation ownership for webchat',
        );
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

    // Team performance real-time metrics subscription
    let metricsInterval: NodeJS.Timeout | null = null;

    socket.on('team:metrics:subscribe', async (orgId: string) => {
      if (typeof orgId !== 'string' || !SAFE_ID.test(orgId)) return;

      // Clear any existing interval
      if (metricsInterval) {
        clearInterval(metricsInterval);
      }

      // Send initial metrics immediately
      try {
        const { teamPerformanceService } = await import('../services/teamPerformance.service');
        const metrics = await teamPerformanceService.getRealTimeMetrics(orgId);
        socket.emit('team:metrics:update', metrics);
      } catch (err) {
        logger.warn({ err, orgId }, 'Failed to fetch initial team metrics');
      }

      // Poll and emit metrics every 5 seconds
      metricsInterval = setInterval(async () => {
        try {
          const { teamPerformanceService } = await import('../services/teamPerformance.service');
          const metrics = await teamPerformanceService.getRealTimeMetrics(orgId);
          socket.emit('team:metrics:update', metrics);
        } catch (err) {
          logger.warn({ err, orgId }, 'Failed to fetch team metrics');
        }
      }, 5000);
    });

    socket.on('team:metrics:unsubscribe', () => {
      if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
      }
    });

    socket.on('disconnect', () => {
      if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
      }
    });
  });

  // Global error handlers — catch transport/protocol errors
  io.engine.on('connection_error', (err: Error) => {
    logger.error({ err }, 'WebSocket engine connection error');
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
