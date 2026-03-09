import { prisma } from '../config/database';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';

interface FileOwnership {
  conversationId: string;
  messageId: string;
  orgId: string;
  customerId: string;
  contentType: string;
}

export class FileAccessService {
  /**
   * Check if a user or visitor can access a file
   * @param filename - The filename to check access for
   * @param userId - Optional authenticated user ID
   * @param visitorId - Optional visitor/customer ID
   * @returns true if access is allowed, throws ForbiddenError otherwise
   */
  async canAccessFile(
    filename: string,
    userId?: string,
    visitorId?: string
  ): Promise<boolean> {
    // Check if file is public (landing page assets, etc.)
    if (await this.isPublicFile(filename)) {
      return true;
    }

    // Get file ownership information
    const ownership = await this.getFileOwnership(filename);

    if (!ownership) {
      // File not found in database - could be admin upload or orphaned file
      // For admin files, we'll require authentication
      if (!userId) {
        throw new ForbiddenError('Authentication required to access this file');
      }

      // Check if user is super admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isSuperAdmin: true },
      });

      if (user?.isSuperAdmin) {
        return true;
      }

      throw new ForbiddenError('File not found or access denied');
    }

    // Check visitor access
    if (visitorId) {
      if (ownership.customerId === visitorId) {
        logger.debug({ filename, visitorId, conversationId: ownership.conversationId }, 'Visitor file access granted');
        return true;
      }
      throw new ForbiddenError('Access denied to this file');
    }

    // Check authenticated user access
    if (userId) {
      // Check if user is member of the organization that owns the conversation
      const membership = await prisma.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId,
            orgId: ownership.orgId,
          },
        },
      });

      if (membership) {
        logger.debug({ filename, userId, orgId: ownership.orgId }, 'User file access granted');
        return true;
      }

      // Check if user is super admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isSuperAdmin: true },
      });

      if (user?.isSuperAdmin) {
        logger.debug({ filename, userId }, 'Super admin file access granted');
        return true;
      }

      throw new ForbiddenError('Not a member of this organization');
    }

    throw new ForbiddenError('Authentication required to access this file');
  }

  /**
   * Get file ownership information from database
   * @param filename - The filename to look up
   * @returns FileOwnership object or null if not found
   */
  async getFileOwnership(filename: string): Promise<FileOwnership | null> {
    try {
      // Search for messages that contain this filename in their content
      // Files are stored with paths like /uploads/{filename} or just {filename}
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { content: { contains: filename, mode: 'insensitive' } },
            { content: { contains: `/uploads/${filename}`, mode: 'insensitive' } },
            { content: { contains: `/files/${filename}`, mode: 'insensitive' } },
          ],
          contentType: { in: ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'] },
        },
        include: {
          conversation: {
            select: {
              id: true,
              orgId: true,
              customerId: true,
            },
          },
        },
        take: 1,
      });

      if (messages.length === 0) {
        return null;
      }

      const message = messages[0];
      if (!message) {
        return null;
      }

      return {
        conversationId: message.conversation.id,
        messageId: message.id,
        orgId: message.conversation.orgId,
        customerId: message.conversation.customerId,
        contentType: message.contentType,
      };
    } catch (err) {
      logger.error({ err, filename }, 'Error getting file ownership');
      return null;
    }
  }

  /**
   * Check if a file is publicly accessible (landing page assets, etc.)
   * @param filename - The filename to check
   * @returns true if file is public
   */
  async isPublicFile(filename: string): Promise<boolean> {
    // Define patterns for public files
    // These are typically landing page assets, logos, etc.
    const publicPatterns = [
      /^logo-/i,
      /^favicon-/i,
      /^og-image-/i,
      /^landing-/i,
      /^hero-/i,
      /^feature-/i,
    ];

    // Check if filename matches any public pattern
    const isPublicPattern = publicPatterns.some(pattern => pattern.test(filename));

    if (isPublicPattern) {
      logger.debug({ filename }, 'File matched public pattern');
      return true;
    }

    // Additional check: files not associated with any message and older than a certain threshold
    // could be considered public (uploaded via admin panel for landing pages)
    // For now, we'll be conservative and require authentication for all non-pattern files
    return false;
  }
}

export const fileAccessService = new FileAccessService();
