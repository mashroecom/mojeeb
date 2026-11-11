/**
 * Pure scheduling rules for knowledge-base auto-sync (scheduled re-crawls).
 * No Redis / database access here so the rules can be unit-tested; the BullMQ
 * side lives in workers/crawler.worker.ts.
 */

export type CrawlFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/**
 * Time zone the cron patterns below are evaluated in. Passed to BullMQ
 * explicitly so the schedule does not silently follow the server's TZ.
 */
export const CRAWL_SCHEDULE_TIMEZONE = 'UTC';

const CRON_PATTERNS: Record<CrawlFrequency, string> = {
  DAILY: '0 0 * * *', // every day at 00:00
  WEEKLY: '0 0 * * 0', // every Sunday at 00:00
  MONTHLY: '0 0 1 * *', // the 1st of every month at 00:00
};

export function isCrawlFrequency(value: unknown): value is CrawlFrequency {
  return typeof value === 'string' && value in CRON_PATTERNS;
}

export function frequencyToCronPattern(frequency: CrawlFrequency): string {
  const pattern = CRON_PATTERNS[frequency];
  if (!pattern) throw new Error(`Unknown frequency: ${frequency}`);
  return pattern;
}

/** BullMQ job-scheduler id for a CrawlConfig. One scheduler per config, ever. */
export const CRAWL_SCHEDULER_PREFIX = 'crawl-schedule-';
export function crawlSchedulerId(configId: string): string {
  return `${CRAWL_SCHEDULER_PREFIX}${configId}`;
}

/**
 * The first run strictly after `from` for a frequency — the same instant the
 * cron pattern from frequencyToCronPattern fires next (in UTC):
 * DAILY → next 00:00, WEEKLY → next Sunday 00:00, MONTHLY → next 1st 00:00.
 */
export function computeNextCrawlAt(frequency: CrawlFrequency, from: Date = new Date()): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = from.getUTCDate();

  switch (frequency) {
    case 'DAILY':
      // Midnight that starts tomorrow (always after `from`, even at 00:00:00.000 sharp)
      return new Date(Date.UTC(year, month, day + 1));
    case 'WEEKLY': {
      const daysUntilSunday = 7 - from.getUTCDay(); // Sunday (0) → 7: the *next* Sunday
      return new Date(Date.UTC(year, month, day + daysUntilSunday));
    }
    case 'MONTHLY':
      return new Date(Date.UTC(year, month + 1, 1));
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}
