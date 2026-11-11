import { describe, expect, it } from 'vitest';
import {
  CRAWL_SCHEDULE_TIMEZONE,
  computeNextCrawlAt,
  crawlSchedulerId,
  frequencyToCronPattern,
  isCrawlFrequency,
} from './crawlSchedule';

const utc = (iso: string) => new Date(`${iso}Z`);

describe('frequencyToCronPattern', () => {
  it('maps each frequency to its midnight cron pattern', () => {
    expect(frequencyToCronPattern('DAILY')).toBe('0 0 * * *');
    expect(frequencyToCronPattern('WEEKLY')).toBe('0 0 * * 0');
    expect(frequencyToCronPattern('MONTHLY')).toBe('0 0 1 * *');
  });

  it('rejects an unknown frequency', () => {
    expect(() => frequencyToCronPattern('HOURLY' as never)).toThrow(/Unknown frequency/);
    expect(isCrawlFrequency('HOURLY')).toBe(false);
    expect(isCrawlFrequency(null)).toBe(false);
    expect(isCrawlFrequency('WEEKLY')).toBe(true);
  });

  it('schedules in UTC', () => {
    expect(CRAWL_SCHEDULE_TIMEZONE).toBe('UTC');
  });
});

describe('crawlSchedulerId', () => {
  it('is stable per config, so re-scheduling replaces instead of adding', () => {
    expect(crawlSchedulerId('cfg_1')).toBe('crawl-schedule-cfg_1');
    expect(crawlSchedulerId('cfg_1')).toBe(crawlSchedulerId('cfg_1'));
    expect(crawlSchedulerId('cfg_2')).not.toBe(crawlSchedulerId('cfg_1'));
  });
});

describe('computeNextCrawlAt', () => {
  it('DAILY: the next 00:00 UTC', () => {
    // 2026-11-11 is a Wednesday
    expect(computeNextCrawlAt('DAILY', utc('2026-11-11T15:07:30'))).toEqual(
      utc('2026-11-12T00:00:00'),
    );
    expect(computeNextCrawlAt('DAILY', utc('2026-11-11T23:59:59.999'))).toEqual(
      utc('2026-11-12T00:00:00'),
    );
  });

  it('DAILY: at midnight sharp the run that is firing does not count', () => {
    expect(computeNextCrawlAt('DAILY', utc('2026-11-12T00:00:00'))).toEqual(
      utc('2026-11-13T00:00:00'),
    );
  });

  it('DAILY: rolls over month and year ends', () => {
    expect(computeNextCrawlAt('DAILY', utc('2026-12-31T08:00:00'))).toEqual(
      utc('2027-01-01T00:00:00'),
    );
    expect(computeNextCrawlAt('DAILY', utc('2028-02-28T08:00:00'))).toEqual(
      utc('2028-02-29T00:00:00'),
    );
  });

  it('WEEKLY: the next Sunday 00:00 UTC', () => {
    expect(computeNextCrawlAt('WEEKLY', utc('2026-11-11T15:00:00'))).toEqual(
      utc('2026-11-15T00:00:00'),
    );
    // Saturday evening → a few hours later
    expect(computeNextCrawlAt('WEEKLY', utc('2026-11-14T23:30:00'))).toEqual(
      utc('2026-11-15T00:00:00'),
    );
    // On a Sunday (at or after midnight) → the Sunday after
    expect(computeNextCrawlAt('WEEKLY', utc('2026-11-15T00:00:00'))).toEqual(
      utc('2026-11-22T00:00:00'),
    );
    expect(computeNextCrawlAt('WEEKLY', utc('2026-11-15T10:00:00'))).toEqual(
      utc('2026-11-22T00:00:00'),
    );
    expect(computeNextCrawlAt('WEEKLY', utc('2026-11-15T10:00:00')).getUTCDay()).toBe(0);
  });

  it('MONTHLY: the 1st of next month 00:00 UTC', () => {
    expect(computeNextCrawlAt('MONTHLY', utc('2026-11-11T15:00:00'))).toEqual(
      utc('2026-12-01T00:00:00'),
    );
    expect(computeNextCrawlAt('MONTHLY', utc('2026-12-01T00:00:00'))).toEqual(
      utc('2027-01-01T00:00:00'),
    );
    // No "31st + 1 month" overflow
    expect(computeNextCrawlAt('MONTHLY', utc('2027-01-31T12:00:00'))).toEqual(
      utc('2027-02-01T00:00:00'),
    );
  });

  it('does not depend on the server time zone: uses the UTC calendar day', () => {
    // 23:30 UTC on the 11th is already the 12th in Cairo; the next UTC midnight is still the 12th
    expect(computeNextCrawlAt('DAILY', new Date('2026-11-12T01:30:00+02:00'))).toEqual(
      utc('2026-11-12T00:00:00'),
    );
  });

  it('always returns a time strictly in the future of `from`', () => {
    const from = utc('2026-06-07T00:00:00'); // a Sunday
    for (const frequency of ['DAILY', 'WEEKLY', 'MONTHLY'] as const) {
      expect(computeNextCrawlAt(frequency, from).getTime()).toBeGreaterThan(from.getTime());
    }
  });
});
