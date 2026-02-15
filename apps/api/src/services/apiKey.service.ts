import crypto from 'crypto';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export class ApiKeyService {
  /**
   * Create a new API key for an organization.
   * Returns the raw key only once on creation.
   */
  async create(data: { name: string; orgId: string; userId: string; scopes?: string[] }) {
    // Generate a random API key: "mj_" prefix + 40 hex chars
    const rawKey = `mj_${crypto.randomBytes(20).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 10);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        name: data.name,
        orgId: data.orgId,
        userId: data.userId,
        keyHash,
        keyPrefix,
        scopes: data.scopes || ['*'],
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * List all API keys for an organization (without exposing the hash).
   */
  async list(orgId: string) {
    const keys = await prisma.apiKey.findMany({
      where: { orgId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys;
  }

  /**
   * Revoke an API key (soft delete by setting revokedAt).
   */
  async revoke(keyId: string, orgId: string) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    if (apiKey.orgId !== orgId) {
      throw new ForbiddenError('API key does not belong to this organization');
    }

    if (apiKey.revokedAt) {
      throw new NotFoundError('API key already revoked');
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }
}

export const apiKeyService = new ApiKeyService();
