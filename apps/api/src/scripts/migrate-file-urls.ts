#!/usr/bin/env node
/**
 * Database migration script to update file URLs from /uploads/* to /files/*
 *
 * This script updates the Message.content field to replace the old /uploads/ prefix
 * with the new authenticated /files/ endpoint.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-file-urls.ts [--dry-run]
 *
 * Options:
 *   --dry-run  Show what would be updated without making changes
 */

import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface MigrationResult {
  messagesScanned: number;
  messagesUpdated: number;
  errors: number;
}

async function migrateFileUrls(dryRun: boolean = false): Promise<MigrationResult> {
  const result: MigrationResult = {
    messagesScanned: 0,
    messagesUpdated: 0,
    errors: 0,
  };

  try {
    logger.info({ dryRun }, 'Starting file URL migration');

    // Find all messages with file content types that contain /uploads/
    const messages = await prisma.message.findMany({
      where: {
        AND: [
          {
            contentType: {
              in: ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'],
            },
          },
          {
            content: {
              contains: '/uploads/',
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        content: true,
        contentType: true,
        conversationId: true,
      },
    });

    result.messagesScanned = messages.length;
    logger.info({ count: messages.length }, 'Found messages with /uploads/ URLs');

    // Process each message
    for (const message of messages) {
      try {
        // Replace /uploads/ with /files/ in the content
        const oldContent = message.content;
        const newContent = oldContent.replace(/\/uploads\//gi, '/files/');

        // Skip if no actual change (in case the message has both old and new URLs)
        if (oldContent === newContent) {
          logger.debug({ messageId: message.id }, 'No changes needed for message');
          continue;
        }

        if (dryRun) {
          logger.info(
            {
              messageId: message.id,
              contentType: message.contentType,
              oldContent,
              newContent,
            },
            '[DRY RUN] Would update message',
          );
          result.messagesUpdated++;
        } else {
          // Update the message in the database
          await prisma.message.update({
            where: { id: message.id },
            data: { content: newContent },
          });

          logger.info(
            {
              messageId: message.id,
              contentType: message.contentType,
              conversationId: message.conversationId,
            },
            'Updated message file URL',
          );
          result.messagesUpdated++;
        }
      } catch (error) {
        result.errors++;
        logger.error(
          {
            error,
            messageId: message.id,
            content: message.content,
          },
          'Error updating message',
        );
      }
    }

    logger.info(
      {
        scanned: result.messagesScanned,
        updated: result.messagesUpdated,
        errors: result.errors,
        dryRun,
      },
      'Migration completed',
    );

    return result;
  } catch (error) {
    logger.error({ error }, 'Fatal error during migration');
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    const result = await migrateFileUrls(dryRun);

    if (dryRun) {
      console.log('\n=== DRY RUN COMPLETE ===');
      console.log(`Messages scanned: ${result.messagesScanned}`);
      console.log(`Messages that would be updated: ${result.messagesUpdated}`);
      console.log(`Errors: ${result.errors}`);
      console.log('\nRun without --dry-run to apply changes');
    } else {
      console.log('\n=== MIGRATION COMPLETE ===');
      console.log(`Messages scanned: ${result.messagesScanned}`);
      console.log(`Messages updated: ${result.messagesUpdated}`);
      console.log(`Errors: ${result.errors}`);
    }

    process.exit(result.errors > 0 ? 1 : 0);
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { migrateFileUrls };
