import { prisma } from '../config/database';
import { cache } from '../config/cache';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../config/logger';
import crypto from 'crypto';

type ChannelType = 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM' | 'WEBCHAT';

export class ChannelService {
  /**
   * List all channels for an organization.
   */
  async list(orgId: string) {
    return prisma.channel.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        agents: {
          include: {
            agent: { select: { id: true, name: true, isActive: true } },
          },
        },
        _count: { select: { conversations: true } },
      },
    });
  }

  /**
   * Get a single channel by ID with agents.
   */
  async getById(orgId: string, channelId: string) {
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, orgId },
      include: {
        agents: {
          include: {
            agent: { select: { id: true, name: true, isActive: true } },
          },
        },
        _count: { select: { conversations: true } },
      },
    });
    if (!channel) throw new NotFoundError('Channel not found');

    // Decrypt sensitive credential values before returning
    if (channel.credentials && typeof channel.credentials === 'object') {
      (channel as any).credentials = this.decryptCredentials(
        channel.credentials as Record<string, string>,
      );
    }

    return channel;
  }

  /**
   * Connect (create) a new channel for an organization.
   */
  async connect(
    orgId: string,
    data: {
      type: ChannelType;
      name: string;
      credentials: Record<string, string>;
    },
  ) {
    // Validate required credentials per channel type
    this.validateCredentials(data.type, data.credentials);

    // Derive externalId based on channel type
    const externalId = this.deriveExternalId(data.type, data.credentials);

    // Check for duplicate channel of same type + externalId
    if (externalId) {
      const existing = await prisma.channel.findUnique({
        where: {
          orgId_type_externalId: {
            orgId,
            type: data.type,
            externalId,
          },
        },
      });
      if (existing) {
        throw new ConflictError(
          `A ${data.type} channel with this identifier already exists`,
        );
      }
    }

    // Generate webhookSecret for authentication
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Encrypt sensitive credential values before storing
    const encryptedCredentials = this.encryptCredentials(data.credentials);

    return prisma.channel.create({
      data: {
        orgId,
        type: data.type,
        name: data.name,
        isActive: true,
        credentials: encryptedCredentials,
        webhookSecret,
        externalId,
      },
      include: {
        agents: {
          include: {
            agent: { select: { id: true, name: true, isActive: true } },
          },
        },
        _count: { select: { conversations: true } },
      },
    });
  }

  /**
   * Disconnect (delete) a channel.
   * Deletes related conversations (and their messages/notes/tags/ratings via cascade)
   * and channel-agent links before removing the channel itself.
   */
  async disconnect(orgId: string, channelId: string) {
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, orgId },
      include: { agents: { select: { agentId: true } } },
    });
    if (!channel) throw new NotFoundError('Channel not found');

    // Collect agent IDs before deletion so we can invalidate their caches
    const agentIds = channel.agents.map((a) => a.agentId);

    await prisma.$transaction([
      prisma.conversation.deleteMany({ where: { channelId } }),
      prisma.channelAgent.deleteMany({ where: { channelId } }),
      prisma.channel.delete({ where: { id: channelId } }),
    ]);

    // Invalidate all affected agent caches
    await Promise.all(agentIds.map((id) => cache.del(`agent:${id}`)));
  }

  /**
   * Toggle a channel's active/inactive status.
   */
  async toggleActive(orgId: string, channelId: string) {
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, orgId },
      include: { agents: { select: { agentId: true } } },
    });
    if (!channel) throw new NotFoundError('Channel not found');

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: { isActive: !channel.isActive },
      include: {
        agents: {
          include: {
            agent: { select: { id: true, name: true, isActive: true } },
          },
        },
        _count: { select: { conversations: true } },
      },
    });

    // Invalidate agent caches so the new isActive value is reflected
    await Promise.all(
      channel.agents.map((ca) => cache.del(`agent:${ca.agentId}`)),
    );

    return updated;
  }

  /**
   * Assign an agent to a channel.
   * If isPrimary is true, unset any existing primary agent first.
   * Enforces: each agent can have at most one channel of each type.
   */
  async assignAgent(
    channelId: string,
    agentId: string,
    isPrimary: boolean,
  ) {
    // Verify channel and agent exist
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundError('Channel not found');

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, orgId: channel.orgId },
    });
    if (!agent) throw new NotFoundError('Agent not found');

    // Enforce one-channel-per-type rule:
    // Check if this agent already has a DIFFERENT channel of the same type
    const existing = await prisma.channelAgent.findFirst({
      where: {
        agentId,
        channel: { type: channel.type },
        channelId: { not: channelId },
      },
      include: { channel: { select: { name: true } } },
    });
    if (existing) {
      throw new ConflictError(
        `This agent already has a ${channel.type} channel connected ("${existing.channel.name}"). Each agent can only have one channel of each type. Please disconnect the existing one first.`,
      );
    }

    // If setting as primary, unset existing primary first
    if (isPrimary) {
      await prisma.channelAgent.updateMany({
        where: { channelId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Upsert the channel-agent link
    const result = await prisma.channelAgent.upsert({
      where: {
        channelId_agentId: { channelId, agentId },
      },
      create: { channelId, agentId, isPrimary },
      update: { isPrimary },
      include: {
        agent: { select: { id: true, name: true, isActive: true } },
      },
    });

    await cache.del(`agent:${agentId}`);
    return result;
  }

  /**
   * Update a channel's settings (merges into credentials JSON).
   */
  async updateSettings(
    orgId: string,
    channelId: string,
    settings: { primaryColor?: string; greeting?: string; position?: string },
  ) {
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, orgId },
    });
    if (!channel) throw new NotFoundError('Channel not found');

    const existingCredentials =
      (channel.credentials as Record<string, string>) || {};

    const mergedCredentials = { ...existingCredentials, ...settings };

    return prisma.channel.update({
      where: { id: channelId },
      data: { credentials: mergedCredentials },
      include: {
        agents: {
          include: {
            agent: { select: { id: true, name: true, isActive: true } },
          },
        },
        _count: { select: { conversations: true } },
      },
    });
  }

  /**
   * Remove an agent from a channel.
   */
  async removeAgent(channelId: string, agentId: string) {
    const link = await prisma.channelAgent.findUnique({
      where: { channelId_agentId: { channelId, agentId } },
    });
    if (!link) throw new NotFoundError('Agent assignment not found');

    await prisma.channelAgent.delete({
      where: { channelId_agentId: { channelId, agentId } },
    });

    await cache.del(`agent:${agentId}`);
  }

  // ---------------------------------------------------------------------------
  // Credential encryption helpers
  // ---------------------------------------------------------------------------

  /**
   * Keys in the credentials object that contain sensitive tokens/secrets
   * and should be stored encrypted at rest.
   */
  private static readonly SENSITIVE_KEYS = new Set([
    'accessToken',
    'appSecret',
    'verifyToken',
    'pageAccessToken',
  ]);

  /**
   * Encrypt sensitive values in a credentials object before persisting.
   */
  private encryptCredentials(
    credentials: Record<string, string>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      result[key] = ChannelService.SENSITIVE_KEYS.has(key)
        ? encrypt(value)
        : value;
    }
    return result;
  }

  /**
   * Decrypt sensitive values in a credentials object after loading.
   */
  private decryptCredentials(
    credentials: Record<string, string>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (ChannelService.SENSITIVE_KEYS.has(key)) {
        try {
          result[key] = decrypt(value);
        } catch {
          // Value may not be encrypted yet (legacy data) — return as-is
          logger.warn({ key }, 'Failed to decrypt credential key, returning raw value');
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private validateCredentials(
    type: ChannelType,
    credentials: Record<string, string>,
  ) {
    switch (type) {
      case 'WHATSAPP': {
        const required = [
          'phoneNumberId',
          'accessToken',
          'appSecret',
          'verifyToken',
        ];
        for (const key of required) {
          if (!credentials[key]?.trim()) {
            throw new BadRequestError(`Missing required field: ${key}`);
          }
        }
        break;
      }
      case 'MESSENGER': {
        const required = ['pageId', 'pageAccessToken'];
        for (const key of required) {
          if (!credentials[key]?.trim()) {
            throw new BadRequestError(`Missing required field: ${key}`);
          }
        }
        break;
      }
      case 'INSTAGRAM': {
        const required = ['accountId', 'accessToken'];
        for (const key of required) {
          if (!credentials[key]?.trim()) {
            throw new BadRequestError(`Missing required field: ${key}`);
          }
        }
        break;
      }
      case 'WEBCHAT':
        // WebChat needs no credentials
        break;
      default:
        throw new BadRequestError(`Unknown channel type: ${type}`);
    }
  }

  private deriveExternalId(
    type: ChannelType,
    credentials: Record<string, string>,
  ): string | null {
    switch (type) {
      case 'WHATSAPP':
        return credentials.phoneNumberId || null;
      case 'MESSENGER':
        return credentials.pageId || null;
      case 'INSTAGRAM':
        return credentials.accountId || null;
      case 'WEBCHAT':
        // Each webchat channel gets a unique ID from cuid, no external ID needed
        return null;
      default:
        return null;
    }
  }
}

export const channelService = new ChannelService();
