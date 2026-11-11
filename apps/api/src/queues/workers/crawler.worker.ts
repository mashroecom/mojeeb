import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { moveToDeadLetterQueue } from '../dlq';
import { crawlerService } from '../../services/crawler.service';
import { crawlerQueue } from '../index';
import { parseUrlPatterns, serializeUrlPatterns } from '../../utils/urlPatterns';
import {
  CRAWL_SCHEDULER_PREFIX,
  CRAWL_SCHEDULE_TIMEZONE,
  computeNextCrawlAt,
  crawlSchedulerId,
  frequencyToCronPattern,
  isCrawlFrequency,
} from '../crawlSchedule';

interface CrawlJobData {
  /** CrawlJob row to run. Absent for scheduled runs: the worker creates the row. */
  jobId?: string;
  kbId: string;
  orgId?: string;
  /** Absent for scheduled runs: resolved from the knowledge base when the run starts. */
  startUrl?: string;
  configId?: string;
  /** Set by the auto-sync job scheduler. */
  scheduled?: boolean;
  config?: {
    maxDepth?: number;
    urlPatterns?: string[];
  };
}

interface QueuedUrl {
  url: string;
  depth: number;
}

/** Name of the jobs the auto-sync schedulers produce. */
export const SCHEDULED_CRAWL_JOB_NAME = 'scheduled-crawl';
/** Repeatables created by older versions were named `scheduled-crawl-<configId>`. */
const LEGACY_REPEATABLE_PREFIX = 'scheduled-crawl-';

/** Safety net against a runaway crawl of a huge site. */
const MAX_PAGES_PER_CRAWL = 500;

/**
 * A PENDING/RUNNING job that has not been touched for this long was abandoned
 * (the process running it died): the worker updates the row after every page.
 */
export const STALE_CRAWL_JOB_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Auto-sync scheduling (BullMQ job schedulers)
// ---------------------------------------------------------------------------

/**
 * Remove repeatable jobs that older versions created for this config with
 * `queue.add(name, data, { repeat })`. They were keyed by a hash of name +
 * pattern, so changing the frequency left the old one behind and the removal
 * code (which built the key by hand) never deleted anything.
 */
async function removeLegacyRepeatables(configId?: string): Promise<number> {
  const repeatables = await crawlerQueue.getRepeatableJobs();
  let removed = 0;
  for (const repeatable of repeatables) {
    const isLegacy = configId
      ? repeatable.name === `${LEGACY_REPEATABLE_PREFIX}${configId}`
      : repeatable.name.startsWith(LEGACY_REPEATABLE_PREFIX);
    if (!isLegacy) continue;
    if (await crawlerQueue.removeRepeatableByKey(repeatable.key)) removed++;
  }
  return removed;
}

/**
 * Create or replace THE job scheduler of a config. upsertJobScheduler is keyed
 * by our scheduler id, so calling this again (API restart, second instance,
 * frequency change) always leaves exactly one scheduler per config.
 *
 * The job carries no start URL: the worker resolves the site to re-crawl when
 * the run starts, so it always follows the knowledge base's latest crawl.
 */
async function upsertCrawlScheduler(config: {
  id: string;
  knowledgeBaseId: string;
  scheduleFrequency: string | null;
}): Promise<Date> {
  if (!isCrawlFrequency(config.scheduleFrequency)) {
    throw new Error(`Crawl config ${config.id} has no valid schedule frequency`);
  }

  const data: CrawlJobData = {
    scheduled: true,
    configId: config.id,
    kbId: config.knowledgeBaseId,
  };
  await crawlerQueue.upsertJobScheduler(
    crawlSchedulerId(config.id),
    { pattern: frequencyToCronPattern(config.scheduleFrequency), tz: CRAWL_SCHEDULE_TIMEZONE },
    { name: SCHEDULED_CRAWL_JOB_NAME, data },
  );
  await removeLegacyRepeatables(config.id);

  return computeNextCrawlAt(config.scheduleFrequency);
}

/**
 * Schedule (or re-schedule) the repeatable crawl of a CrawlConfig and record
 * when it will run next. Returns that time, or null when the config is not
 * (or no longer) enabled — in which case any scheduler it had is removed.
 */
export async function scheduleRepeatableCrawl(configId: string): Promise<Date | null> {
  const config = await prisma.crawlConfig.findUnique({ where: { id: configId } });

  if (!config || !config.scheduleEnabled || !config.scheduleFrequency) {
    logger.warn({ configId }, 'Crawl schedule is not enabled, removing any scheduler');
    await cancelRepeatableCrawl(configId);
    return null;
  }

  const nextCrawlAt = await upsertCrawlScheduler(config);
  await prisma.crawlConfig.update({ where: { id: configId }, data: { nextCrawlAt } });

  logger.info(
    {
      configId,
      kbId: config.knowledgeBaseId,
      frequency: config.scheduleFrequency,
      cronPattern: frequencyToCronPattern(config.scheduleFrequency),
      timezone: CRAWL_SCHEDULE_TIMEZONE,
      nextCrawlAt,
    },
    'Repeatable crawl job scheduled',
  );
  return nextCrawlAt;
}

/**
 * Remove the repeatable crawl of a CrawlConfig. Safe to call when nothing is
 * scheduled.
 */
export async function cancelRepeatableCrawl(configId: string): Promise<void> {
  const removed = await crawlerQueue.removeJobScheduler(crawlSchedulerId(configId));
  const legacyRemoved = await removeLegacyRepeatables(configId);

  // updateMany: the config may already be gone
  await prisma.crawlConfig.updateMany({ where: { id: configId }, data: { nextCrawlAt: null } });

  logger.info({ configId, removed, legacyRemoved }, 'Repeatable crawl job cancelled');
}

/**
 * Bring the job schedulers in Redis in line with the enabled CrawlConfigs.
 * Runs at process start (API and worker process alike) and is idempotent:
 * every enabled config ends up with exactly one scheduler, schedulers whose
 * config was disabled or deleted are removed. One bad config is logged and
 * skipped; this function never throws.
 */
export async function initializeRepeatableCrawls(): Promise<{
  scheduled: number;
  failed: number;
  removed: number;
}> {
  const summary = { scheduled: 0, failed: 0, removed: 0 };

  try {
    const configs = await prisma.crawlConfig.findMany({
      where: { scheduleEnabled: true, scheduleFrequency: { not: null } },
      select: { id: true, knowledgeBaseId: true, scheduleFrequency: true },
    });

    const enabledSchedulerIds = new Set<string>();
    for (const config of configs) {
      try {
        const nextCrawlAt = await upsertCrawlScheduler(config);
        await prisma.crawlConfig.update({ where: { id: config.id }, data: { nextCrawlAt } });
        enabledSchedulerIds.add(crawlSchedulerId(config.id));
        summary.scheduled++;
      } catch (err) {
        summary.failed++;
        logger.error({ err, configId: config.id }, 'Failed to initialize repeatable crawl job');
      }
    }

    // Drop schedulers that no longer belong to an enabled config
    try {
      const schedulers = await crawlerQueue.getJobSchedulers();
      for (const scheduler of schedulers) {
        const id = scheduler.key;
        if (!id.startsWith(CRAWL_SCHEDULER_PREFIX) || enabledSchedulerIds.has(id)) continue;
        if (await crawlerQueue.removeJobScheduler(id)) summary.removed++;
      }
      summary.removed += await removeLegacyRepeatables();
    } catch (err) {
      logger.error({ err }, 'Failed to clean up stale crawl schedulers');
    }

    logger.info(summary, 'Repeatable crawl jobs initialized');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize repeatable crawl jobs');
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Crawl jobs
// ---------------------------------------------------------------------------

/**
 * The site auto-sync re-crawls for a knowledge base: the start URL of its most
 * recent *completed* crawl. The depth and URL filter of that same crawl are on
 * the CrawlConfig (written when it completed), and a scheduled run completes
 * as such a job itself, so the schedule keeps following one site until the
 * user successfully crawls another.
 */
export async function findScheduledCrawlTarget(kbId: string): Promise<string | null> {
  const job = await prisma.crawlJob.findFirst({
    where: { knowledgeBaseId: kbId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    select: { startUrl: true },
  });
  return job?.startUrl ?? null;
}

/**
 * Mark crawl jobs that were left PENDING/RUNNING by a dead process as failed,
 * so they stop blocking new crawls of the knowledge base.
 */
export async function failStaleCrawlJobs(kbId: string): Promise<number> {
  const { count } = await prisma.crawlJob.updateMany({
    where: {
      knowledgeBaseId: kbId,
      status: { in: ['PENDING', 'RUNNING'] },
      updatedAt: { lt: new Date(Date.now() - STALE_CRAWL_JOB_MS) },
    },
    data: {
      status: 'FAILED',
      errorMessage: 'CRAWL_INTERRUPTED: The crawl was interrupted before it finished',
      completedAt: new Date(),
    },
  });
  return count;
}

/**
 * Turn a scheduler tick into a concrete crawl: create its CrawlJob row and
 * work out what to crawl. Returns null when there is nothing to do.
 */
async function prepareScheduledCrawl(
  data: CrawlJobData,
): Promise<{ jobId: string; startUrl: string; maxDepth: number; urlPatterns: string[] } | null> {
  const { kbId, configId } = data;

  const config = configId ? await prisma.crawlConfig.findUnique({ where: { id: configId } }) : null;

  if (configId && (!config || !config.scheduleEnabled)) {
    // The schedule was switched off (or the config deleted) but its scheduler survived
    logger.warn({ configId, kbId }, 'Scheduled crawl fired for a disabled schedule, removing it');
    await cancelRepeatableCrawl(configId);
    return null;
  }

  await failStaleCrawlJobs(kbId);
  const active = await prisma.crawlJob.findFirst({
    where: { knowledgeBaseId: kbId, status: { in: ['PENDING', 'RUNNING'] } },
    select: { id: true },
  });
  if (active) {
    logger.info(
      { kbId, configId, activeJobId: active.id },
      'Skipping scheduled crawl: another crawl of this knowledge base is in progress',
    );
    return null;
  }

  const startUrl = (await findScheduledCrawlTarget(kbId)) ?? data.startUrl ?? null;
  if (!startUrl) {
    logger.warn({ kbId, configId }, 'Skipping scheduled crawl: no website has been crawled yet');
    return null;
  }

  const crawlJob = await prisma.crawlJob.create({
    data: {
      knowledgeBaseId: kbId,
      startUrl,
      status: 'PENDING',
      pagesCrawled: 0,
      pagesTotal: 0,
      configId: config?.id ?? null,
    },
  });
  logger.info({ jobId: crawlJob.id, kbId, configId, startUrl }, 'Created scheduled crawl job');

  return {
    jobId: crawlJob.id,
    startUrl,
    maxDepth: config?.maxDepth ?? data.config?.maxDepth ?? 1,
    urlPatterns: config ? parseUrlPatterns(config.urlPattern) : (data.config?.urlPatterns ?? []),
  };
}

/** Text stored in CrawlJob.errorMessage: "<CODE>: <readable message>". */
function describeCrawlError(err: any): string {
  const message = err?.message || 'Unknown error';
  return err?.code && typeof err.code === 'string' ? `${err.code}: ${message}` : message;
}

export const crawlerWorker = new Worker(
  'crawler',
  async (job) => {
    const data = job.data as CrawlJobData;
    const { kbId } = data;
    let jobId = data.jobId;
    let startUrl = data.startUrl;
    let maxDepth = data.config?.maxDepth || 1;
    let urlPatterns = parseUrlPatterns(data.config?.urlPatterns);

    try {
      // No CrawlJob row yet: this is a scheduled (auto-sync) run
      if (!jobId) {
        const prepared = await prepareScheduledCrawl(data);
        if (!prepared) return;
        ({ jobId, startUrl, maxDepth, urlPatterns } = prepared);
        // Remember the row on the queue job: if this process dies mid-crawl and
        // BullMQ hands the job to another worker, it must resume this row
        // instead of finding it "in progress" and skipping the run.
        await job.updateData({ ...data, jobId, startUrl, config: { maxDepth, urlPatterns } });
      }
      if (!startUrl) {
        throw new Error('Crawl job has no start URL');
      }

      // Move PENDING -> RUNNING. A job cancelled before the worker picked it up
      // (or deleted) is left alone.
      const started = await prisma.crawlJob.updateMany({
        where: { id: jobId, status: 'PENDING' },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
      if (started.count === 0) {
        // Still RUNNING means the worker that had this job died (restart,
        // deploy) and BullMQ re-delivered it — a queue job is only ever active
        // in one worker. Crawl again from the start: pages already imported are
        // refreshed in place, not duplicated.
        const resumed = await prisma.crawlJob.updateMany({
          where: { id: jobId, status: 'RUNNING' },
          data: { pagesCrawled: 0, pagesTotal: 0 },
        });
        if (resumed.count === 0) {
          logger.info({ jobId }, 'Crawl job is no longer pending (cancelled?), skipping');
          return;
        }
        logger.warn({ jobId }, 'Resuming a crawl job that was interrupted');
      }

      // BFS queue for crawling. `seen` holds every URL ever queued, so a page
      // linked from many places is queued (and counted) once.
      const rootUrl = crawlerService.normalizeUrl(startUrl);
      const queue: QueuedUrl[] = [{ url: rootUrl, depth: 0 }];
      const seen = new Set<string>([rootUrl]);

      let pagesCrawled = 0;
      let cancelled = false;
      let startUrlError: any = null;

      while (queue.length > 0) {
        // Cooperative cancellation: stop between pages once the job is cancelled
        const current = await prisma.crawlJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });
        if (!current || current.status !== 'RUNNING') {
          cancelled = true;
          break;
        }

        const { url, depth } = queue.shift()!;

        try {
          logger.info({ url, depth, jobId }, 'Crawling URL');

          // Crawl the URL
          const result = await crawlerService.crawlUrl(url, {
            respectRobotsTxt: true,
            userAgent: 'MojeebBot/1.0',
          });

          // Store the page. A page this knowledge base already has (a scheduled
          // re-crawl, or the same site crawled twice) is refreshed in place rather
          // than added again as a duplicate.
          const existing = await prisma.kBDocument.findFirst({
            where: { knowledgeBaseId: kbId, contentType: 'URL', sourceUrl: url },
            select: { id: true, content: true, embeddingStatus: true },
          });

          let documentId: string | null = null;
          if (!existing) {
            const created = await prisma.kBDocument.create({
              data: {
                knowledgeBaseId: kbId,
                crawlJobId: jobId,
                title: result.metadata.title || url,
                content: result.text,
                contentType: 'URL',
                sourceUrl: url,
              },
            });
            documentId = created.id;
          } else if (existing.content !== result.text || existing.embeddingStatus !== 'COMPLETED') {
            await prisma.kBDocument.update({
              where: { id: existing.id },
              data: {
                crawlJobId: jobId,
                title: result.metadata.title || url,
                content: result.text,
              },
            });
            documentId = existing.id;
          }

          // Embed it, otherwise the page is stored but can never be found by the
          // agent's semantic search. processDocument records its own failures on
          // the document (embeddingStatus FAILED), so one bad page does not stop
          // the crawl. Imported lazily: the service imports this worker module.
          if (documentId) {
            const { knowledgeBaseService } = await import('../../services/knowledgeBase.service');
            await knowledgeBaseService.processDocument(documentId);
          }

          pagesCrawled++;

          // Queue the links found on this page for the next depth level. The URL
          // filter applies to discovered links only: the start page is always
          // crawled, otherwise a crawl of https://shop.example with the filter
          // "/help/" would never get anywhere.
          if (depth < maxDepth) {
            for (const link of result.links) {
              if (seen.has(link)) continue;
              if (seen.size >= MAX_PAGES_PER_CRAWL) {
                logger.warn({ jobId, limit: MAX_PAGES_PER_CRAWL }, 'Crawl page limit reached');
                break;
              }
              if (!crawlerService.matchesUrlPatterns(link, urlPatterns)) continue;
              seen.add(link);
              queue.push({ url: link, depth: depth + 1 });
            }
          }

          logger.info(
            { url, pagesCrawled, queueSize: queue.length, jobId },
            'URL crawled successfully',
          );
        } catch (err: any) {
          logger.error({ err, url, jobId }, 'Failed to crawl URL');
          // A page that cannot be imported does not fail the crawl — unless it
          // is the start page: then nothing can be imported at all.
          if (depth === 0) {
            startUrlError = err;
            break;
          }
        }

        // Update job progress (also when the page failed: it has been handled)
        await prisma.crawlJob.updateMany({
          where: { id: jobId, status: 'RUNNING' },
          data: { pagesCrawled, pagesTotal: seen.size },
        });
      }

      if (startUrlError) {
        await prisma.crawlJob.updateMany({
          where: { id: jobId, status: 'RUNNING' },
          data: {
            status: 'FAILED',
            errorMessage: describeCrawlError(startUrlError),
            pagesCrawled,
            pagesTotal: seen.size,
            completedAt: new Date(),
          },
        });
        logger.warn({ jobId, startUrl }, 'Crawl job failed: the start URL could not be imported');
      } else if (cancelled) {
        logger.info({ jobId, pagesCrawled }, 'Crawl job cancelled');
        return;
      } else {
        // Mark job as completed (unless it was cancelled during the last page)
        const completed = await prisma.crawlJob.updateMany({
          where: { id: jobId, status: 'RUNNING' },
          data: {
            status: 'COMPLETED',
            pagesCrawled,
            pagesTotal: seen.size,
            completedAt: new Date(),
          },
        });
        if (completed.count === 0) {
          logger.info({ jobId, pagesCrawled }, 'Crawl job cancelled');
          return;
        }
        logger.info({ jobId, pagesCrawled, totalPages: seen.size }, 'Crawl job completed');
      }

      // Keep the knowledge base's crawl config truthful. A completed crawl
      // becomes what auto-sync repeats (its start URL is found through the job,
      // its depth and URL filter are stored here) and sets "last crawled"; for
      // an enabled schedule, record when the next scheduled run is due.
      const crawlJob = await prisma.crawlJob.findUnique({
        where: { id: jobId },
        select: { config: true },
      });
      const config = crawlJob?.config;
      if (config) {
        await prisma.crawlConfig.update({
          where: { id: config.id },
          data: {
            ...(startUrlError
              ? {}
              : {
                  lastCrawledAt: new Date(),
                  maxDepth,
                  urlPattern: serializeUrlPatterns(urlPatterns),
                }),
            nextCrawlAt:
              config.scheduleEnabled && isCrawlFrequency(config.scheduleFrequency)
                ? computeNextCrawlAt(config.scheduleFrequency)
                : null,
          },
        });
      }
    } catch (err: any) {
      logger.error({ err, jobId }, 'Crawl job failed');

      // Mark job as failed (a cancelled job stays cancelled; jobId is unset when
      // creating the scheduled job itself failed)
      if (jobId) {
        await prisma.crawlJob.updateMany({
          where: { id: jobId, status: { in: ['PENDING', 'RUNNING'] } },
          data: {
            status: 'FAILED',
            errorMessage: describeCrawlError(err),
            completedAt: new Date(),
          },
        });
      }

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

  // A job BullMQ gave up on without the processor running to its end (stalled
  // too often after worker crashes) would otherwise stay RUNNING forever.
  const crawlJobId = (job?.data as CrawlJobData | undefined)?.jobId;
  if (crawlJobId) {
    prisma.crawlJob
      .updateMany({
        where: { id: crawlJobId, status: { in: ['PENDING', 'RUNNING'] } },
        data: {
          status: 'FAILED',
          errorMessage: 'CRAWL_INTERRUPTED: The crawl was interrupted before it finished',
          completedAt: new Date(),
        },
      })
      .catch((updateErr) => {
        logger.error({ err: updateErr, crawlJobId }, 'Failed to mark crawl job as failed');
      });
  }
});

crawlerWorker.on('error', (err) => {
  logger.error({ err }, 'Crawler worker error');
});

// Re-create the auto-sync schedulers on startup (never throws)
void initializeRepeatableCrawls();
