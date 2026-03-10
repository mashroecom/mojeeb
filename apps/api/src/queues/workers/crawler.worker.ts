import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { moveToDeadLetterQueue } from '../dlq';
import { crawlerService } from '../../services/crawler.service';
import { crawlerQueue } from '../index';

interface CrawlJobData {
  jobId?: string; // Optional - will be created for scheduled jobs
  kbId: string;
  orgId: string;
  startUrl: string;
  configId?: string; // For scheduled crawls
  config?: {
    maxDepth?: number;
    urlPatterns?: string[];
  };
}

interface QueuedUrl {
  url: string;
  depth: number;
}

type CrawlFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/**
 * Convert CrawlFrequency to cron pattern
 */
function frequencyToCronPattern(frequency: CrawlFrequency): string {
  switch (frequency) {
    case 'DAILY':
      return '0 0 * * *'; // Every day at midnight
    case 'WEEKLY':
      return '0 0 * * 0'; // Every Sunday at midnight
    case 'MONTHLY':
      return '0 0 1 * *'; // First day of every month at midnight
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Schedule a repeatable crawl job for a CrawlConfig
 */
export async function scheduleRepeatableCrawl(configId: string): Promise<void> {
  try {
    // Fetch the config from database
    const config = await prisma.crawlConfig.findUnique({
      where: { id: configId },
      include: {
        knowledgeBase: true,
        jobs: {
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!config) {
      logger.error({ configId }, 'CrawlConfig not found, cannot schedule repeatable job');
      return;
    }

    if (!config.scheduleEnabled || !config.scheduleFrequency) {
      logger.warn({ configId }, 'Schedule is not enabled or frequency is missing');
      return;
    }

    // Get start URL from the most recent completed job, or skip if no jobs exist
    const lastJob = config.jobs[0];
    if (!lastJob || !lastJob.startUrl) {
      logger.warn({ configId }, 'No previous crawl job found, cannot schedule repeatable job');
      return;
    }

    const cronPattern = frequencyToCronPattern(config.scheduleFrequency);

    // Add repeatable job to BullMQ
    await crawlerQueue.add(
      `scheduled-crawl-${configId}`,
      {
        kbId: config.knowledgeBaseId,
        orgId: config.knowledgeBase.orgId,
        startUrl: lastJob.startUrl,
        configId: config.id,
        config: {
          maxDepth: config.maxDepth,
          urlPatterns: config.urlPattern
            ? config.urlPattern
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean)
            : [],
        },
      },
      {
        repeat: {
          pattern: cronPattern,
        },
        jobId: `scheduled-crawl-${configId}`, // Use configId as jobId for idempotency
      },
    );

    logger.info(
      { configId, kbId: config.knowledgeBaseId, frequency: config.scheduleFrequency, cronPattern },
      'Repeatable crawl job scheduled',
    );

    // Update nextCrawlAt in the database
    const now = new Date();
    const nextCrawlAt = new Date(now);
    switch (config.scheduleFrequency) {
      case 'DAILY':
        nextCrawlAt.setDate(nextCrawlAt.getDate() + 1);
        break;
      case 'WEEKLY':
        nextCrawlAt.setDate(nextCrawlAt.getDate() + 7);
        break;
      case 'MONTHLY':
        nextCrawlAt.setMonth(nextCrawlAt.getMonth() + 1);
        break;
    }
    nextCrawlAt.setHours(0, 0, 0, 0); // Set to midnight

    await prisma.crawlConfig.update({
      where: { id: configId },
      data: { nextCrawlAt },
    });
  } catch (err: any) {
    logger.error({ err, configId }, 'Failed to schedule repeatable crawl job');
    throw err;
  }
}

/**
 * Cancel a repeatable crawl job for a CrawlConfig
 */
export async function cancelRepeatableCrawl(configId: string): Promise<void> {
  try {
    // Remove repeatable job from BullMQ
    await crawlerQueue.removeRepeatableByKey(
      `scheduled-crawl-${configId}:::${await getRepeatableJobKey(configId)}`,
    );

    logger.info({ configId }, 'Repeatable crawl job cancelled');

    // Clear nextCrawlAt in the database
    await prisma.crawlConfig.update({
      where: { id: configId },
      data: { nextCrawlAt: null },
    });
  } catch (err: any) {
    // If job doesn't exist, that's fine - it might have already been removed
    if (err.message?.includes('does not exist')) {
      logger.debug({ configId }, 'Repeatable job already removed or does not exist');
      return;
    }
    logger.error({ err, configId }, 'Failed to cancel repeatable crawl job');
    throw err;
  }
}

/**
 * Get the repeatable job key for a config (used for removal)
 */
async function getRepeatableJobKey(configId: string): Promise<string> {
  const repeatableJobs = await crawlerQueue.getRepeatableJobs();
  const job = repeatableJobs.find((j) => j.id === `scheduled-crawl-${configId}`);
  return job?.key || '';
}

/**
 * Initialize all enabled repeatable crawl jobs on worker startup
 */
export async function initializeRepeatableCrawls(): Promise<void> {
  try {
    logger.info('Initializing repeatable crawl jobs...');

    // Fetch all enabled crawl configs
    const configs = await prisma.crawlConfig.findMany({
      where: {
        scheduleEnabled: true,
        scheduleFrequency: { not: null },
      },
      include: {
        knowledgeBase: true,
        jobs: {
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
    });

    logger.info({ count: configs.length }, 'Found enabled crawl schedules');

    // Schedule repeatable jobs for each config
    for (const config of configs) {
      // Check if config has at least one completed job with a startUrl
      const lastJob = config.jobs[0];
      if (!lastJob || !lastJob.startUrl) {
        logger.warn(
          { configId: config.id, kbId: config.knowledgeBaseId },
          'Skipping schedule initialization - no previous crawl job found',
        );
        continue;
      }

      try {
        const cronPattern = frequencyToCronPattern(config.scheduleFrequency as CrawlFrequency);

        await crawlerQueue.add(
          `scheduled-crawl-${config.id}`,
          {
            kbId: config.knowledgeBaseId,
            orgId: config.knowledgeBase.orgId,
            startUrl: lastJob.startUrl,
            configId: config.id,
            config: {
              maxDepth: config.maxDepth,
              urlPatterns: config.urlPattern
                ? config.urlPattern
                    .split(',')
                    .map((p) => p.trim())
                    .filter(Boolean)
                : [],
            },
          },
          {
            repeat: {
              pattern: cronPattern,
            },
            jobId: `scheduled-crawl-${config.id}`,
          },
        );

        logger.info(
          {
            configId: config.id,
            kbId: config.knowledgeBaseId,
            frequency: config.scheduleFrequency,
            cronPattern,
          },
          'Repeatable crawl job initialized',
        );
      } catch (err: any) {
        logger.error({ err, configId: config.id }, 'Failed to initialize repeatable crawl job');
      }
    }

    logger.info({ count: configs.length }, 'Repeatable crawl jobs initialization complete');
  } catch (err: any) {
    logger.error({ err }, 'Failed to initialize repeatable crawl jobs');
    throw err;
  }
}

export const crawlerWorker = new Worker(
  'crawler',
  async (job) => {
    const data = job.data as CrawlJobData;
    let { jobId } = data;
    const { kbId, startUrl, config, configId } = data;

    // BFS queue for crawling
    const queue: QueuedUrl[] = [{ url: startUrl, depth: 0 }];
    const visited = new Set<string>();
    const maxDepth = config?.maxDepth || 1;
    const urlPatterns = config?.urlPatterns || [];

    try {
      // If jobId is not provided (scheduled crawl), create a CrawlJob
      if (!jobId) {
        const crawlJob = await prisma.crawlJob.create({
          data: {
            knowledgeBaseId: kbId,
            startUrl,
            status: 'PENDING' as any,
            pagesCrawled: 0,
            pagesTotal: 0,
            configId: configId || null,
          },
        });
        jobId = crawlJob.id;
        logger.info({ jobId, kbId, configId, startUrl }, 'Created CrawlJob for scheduled crawl');
      }

      // Update job status to RUNNING
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING' as any,
          startedAt: new Date(),
        },
      });

      let pagesCrawled = 0;

      // BFS crawl
      while (queue.length > 0) {
        const { url, depth } = queue.shift()!;

        // Skip if already visited
        if (visited.has(url)) {
          continue;
        }
        visited.add(url);

        // Skip if depth exceeds limit
        if (depth > maxDepth) {
          continue;
        }

        // Skip if URL doesn't match patterns (if patterns are configured)
        if (urlPatterns.length > 0 && !crawlerService.matchesUrlPatterns(url, urlPatterns)) {
          logger.debug({ url, urlPatterns }, 'URL does not match patterns, skipping');
          continue;
        }

        try {
          logger.info({ url, depth, jobId }, 'Crawling URL');

          // Crawl the URL
          const result = await crawlerService.crawlUrl(url, {
            respectRobotsTxt: true,
            userAgent: 'MojeebBot/1.0',
          });

          // Create KB document for this page
          await prisma.kBDocument.create({
            data: {
              knowledgeBaseId: kbId,
              crawlJobId: jobId,
              title: result.metadata.title || url,
              content: result.text,
              contentType: 'URL',
              sourceUrl: url,
            },
          });

          pagesCrawled++;

          // Update job progress
          await prisma.crawlJob.update({
            where: { id: jobId },
            data: {
              pagesCrawled,
              pagesTotal: visited.size + queue.length,
            },
          });

          // Add discovered links to queue for next depth level
          if (depth < maxDepth) {
            for (const link of result.links) {
              if (!visited.has(link)) {
                queue.push({ url: link, depth: depth + 1 });
              }
            }
          }

          logger.info(
            { url, pagesCrawled, queueSize: queue.length, jobId },
            'URL crawled successfully',
          );
        } catch (err: any) {
          logger.error({ err, url, jobId }, 'Failed to crawl URL');
          // Continue with next URL instead of failing entire job
        }
      }

      // Mark job as completed
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED' as any,
          pagesCrawled,
          pagesTotal: visited.size,
          completedAt: new Date(),
        },
      });

      // Update lastCrawledAt timestamp for scheduled crawls
      if (configId) {
        await prisma.crawlConfig.update({
          where: { id: configId },
          data: { lastCrawledAt: new Date() },
        });
        logger.info({ configId, jobId }, 'Updated lastCrawledAt for scheduled crawl');
      }

      logger.info({ jobId, pagesCrawled, totalPages: visited.size }, 'Crawl job completed');
    } catch (err: any) {
      logger.error({ err, jobId }, 'Crawl job failed');

      // Mark job as failed
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED' as any,
          errorMessage: err.message,
          completedAt: new Date(),
        },
      });

      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 2, // Limit concurrency to avoid rate limiting
  },
);

crawlerWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Crawler job processing failed');
  moveToDeadLetterQueue('crawler', job, err, 3);
});

crawlerWorker.on('error', (err) => {
  logger.error({ err }, 'Crawler worker error');
});

// Initialize repeatable crawl jobs on worker startup
initializeRepeatableCrawls().catch((err) => {
  logger.error({ err }, 'Failed to initialize repeatable crawl jobs on startup');
});
