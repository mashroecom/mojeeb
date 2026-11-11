'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Error codes the crawl endpoints answer with (`{ success: false, error, code }`)
 * and the crawler stores on a failed job (`"<CODE>: <message>"`). Each has a
 * translated message under dashboard.knowledgeBase.crawlErrors.
 */
const CRAWL_ERROR_CODES = [
  'CRAWL_URL_NOT_ALLOWED',
  'CRAWL_PRIVATE_URL',
  'CRAWL_HOST_UNRESOLVED',
  'CRAWL_ROBOTS_DISALLOWED',
  'CRAWL_NOT_HTML',
  'CRAWL_HTTP_ERROR',
  'CRAWL_TIMEOUT',
  'CRAWL_FETCH_FAILED',
  'CRAWL_EMPTY_CONTENT',
  'CRAWL_ALREADY_RUNNING',
  'CRAWL_INTERRUPTED',
  'CRAWL_SCHEDULE_NO_SITE',
] as const;

type CrawlErrorCode = (typeof CRAWL_ERROR_CODES)[number];

function isCrawlErrorCode(code: unknown): code is CrawlErrorCode {
  return typeof code === 'string' && (CRAWL_ERROR_CODES as readonly string[]).includes(code);
}

/** Pull `{ error, code }` out of a failed API call (axios error). */
export function readApiError(error: unknown): { code?: string; message?: string } {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (!data || typeof data !== 'object') return {};
  const { code, error: message } = data as { code?: unknown; error?: unknown };
  return {
    code: typeof code === 'string' ? code : undefined,
    message: typeof message === 'string' ? message : undefined,
  };
}

/** Split a stored job error (`"CRAWL_NOT_HTML: URL does not return HTML content"`). */
export function parseJobError(errorMessage: string | null | undefined): {
  code?: string;
  message?: string;
} {
  if (!errorMessage) return {};
  const match = /^([A-Z][A-Z0-9_]+): ([\s\S]*)$/.exec(errorMessage);
  return match ? { code: match[1], message: match[2] } : { message: errorMessage };
}

/**
 * Returns helpers that turn a crawl failure into a message in the user's
 * language. Known codes are translated; anything else falls back to the
 * caller's generic (translated) message rather than leaking raw API text.
 */
export function useCrawlErrorMessage() {
  const t = useTranslations('dashboard.knowledgeBase.crawlErrors');

  const forCode = useCallback(
    (code: string | undefined, fallback: string) => (isCrawlErrorCode(code) ? t(code) : fallback),
    [t],
  );

  return {
    /** For a failed API request */
    fromApiError: (error: unknown, fallback: string) => forCode(readApiError(error).code, fallback),
    /** For CrawlJob.errorMessage */
    fromJobError: (errorMessage: string | null | undefined, fallback: string) =>
      forCode(parseJobError(errorMessage).code, fallback),
  };
}
