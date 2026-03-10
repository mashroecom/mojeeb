import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { moveToDeadLetterQueue } from '../dlq';
import { crawlerService } from '../../services/crawler.service';

interface CrawlJobData {
  jobId: string;
  kbId: string;
  orgId: string;
  startUrl: string;
  config?: {
    maxDepth?: number;
    urlPatterns?: string[];
  };
}

interface QueuedUrl {
  url: string;
  depth: number;
}

export const crawlerWorker = new Worker(
  'crawler',
  async (job) => {
    const data = job.data as CrawlJobData;
    const { jobId, kbId, startUrl, config } = data;

    // BFS queue for crawling
    const queue: QueuedUrl[] = [{ url: startUrl, depth: 0 }];
    const visited = new Set<string>();
    const maxDepth = config?.maxDepth || 1;
    const urlPatterns = config?.urlPatterns || [];

    try {
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

          logger.info({ url, pagesCrawled, queueSize: queue.length, jobId }, 'URL crawled successfully');
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
  }
);

crawlerWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Crawler job processing failed');
  moveToDeadLetterQueue('crawler', job, err, 3);
});

crawlerWorker.on('error', (err) => {
  logger.error({ err }, 'Crawler worker error');
});
