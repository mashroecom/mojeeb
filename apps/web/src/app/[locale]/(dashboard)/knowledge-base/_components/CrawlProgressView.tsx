'use client';

import React, { useState } from 'react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  AlertCircle,
  Ban,
  Square,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/dateFormat';
import { type CrawlJob, isCrawlJobActive, useCancelCrawlJob } from '@/hooks/useKnowledgeBase';
import { toast } from '@/hooks/useToast';
import { useCrawlErrorMessage } from './crawlErrors';

interface CrawlProgressViewProps {
  kbId: string;
  job: CrawlJob;
}

const STATUS_STYLE: Record<CrawlJob['status'], string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  RUNNING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const STATUS_ICON: Record<CrawlJob['status'], React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  RUNNING: <Loader2 className="h-3 w-3 animate-spin" />,
  COMPLETED: <CheckCircle className="h-3 w-3" />,
  FAILED: <XCircle className="h-3 w-3" />,
  CANCELLED: <Ban className="h-3 w-3" />,
};

/**
 * One crawl job: its website, status, live progress while it is queued or
 * running (the parent's job list polls), a stop button with confirmation, and
 * the outcome once it is over.
 */
export function CrawlProgressView({ kbId, job }: CrawlProgressViewProps) {
  const t = useTranslations('dashboard.knowledgeBase.crawlJobs');
  const tc = useTranslations('common');
  const locale = useLocale();
  const crawlError = useCrawlErrorMessage();
  const cancelMutation = useCancelCrawlJob();
  const [confirmingStop, setConfirmingStop] = useState(false);

  const active = isCrawlJobActive(job);
  const statusLabels: Record<CrawlJob['status'], string> = {
    PENDING: t('statusPending'),
    RUNNING: t('statusRunning'),
    COMPLETED: t('statusCompleted'),
    FAILED: t('statusFailed'),
    CANCELLED: t('statusCancelled'),
  };

  // pagesTotal grows while links are being discovered, so this is "so far"
  const total = Math.max(job.pagesTotal, job.pagesCrawled);
  const percent = total > 0 ? Math.min(100, Math.round((job.pagesCrawled / total) * 100)) : 0;
  const notImported = Math.max(0, job.pagesTotal - job.pagesCrawled);

  function handleStop() {
    cancelMutation.mutate(
      { kbId, jobId: job.id },
      {
        onSuccess: () => toast.success(t('stopped')),
        onError: () => toast.error(t('stopFailed')),
        onSettled: () => setConfirmingStop(false),
      },
    );
  }

  return (
    <li className="px-6 py-4" data-testid="crawl-job" data-status={job.status}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            {/* URLs are always left-to-right; keep them at the start edge in RTL too */}
            <p className="truncate text-sm font-medium text-start" dir="ltr" title={job.startUrl}>
              <bdi>{job.startUrl}</bdi>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {job.completedAt
                ? t('finishedAt', { date: fmtDateTime(job.completedAt, locale) })
                : job.startedAt
                  ? t('startedAt', { date: fmtDateTime(job.startedAt, locale) })
                  : t('queuedAt', { date: fmtDateTime(job.createdAt, locale) })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              STATUS_STYLE[job.status],
            )}
          >
            {STATUS_ICON[job.status]}
            {statusLabels[job.status]}
          </span>

          {active && !confirmingStop && (
            <button
              type="button"
              onClick={() => setConfirmingStop(true)}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              <Square className="h-3 w-3" />
              {t('stop')}
            </button>
          )}
        </div>
      </div>

      {/* Stop confirmation */}
      {active && confirmingStop && (
        <div
          role="alertdialog"
          aria-label={t('stop')}
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2"
        >
          <p className="text-xs">{t('stopConfirm')}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStop}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {cancelMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('stopYes')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingStop(false)}
              disabled={cancelMutation.isPending}
              className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
            >
              {tc('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Live progress */}
      {active && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {job.status === 'PENDING' || total === 0
                ? t('waiting')
                : t('progress', { crawled: job.pagesCrawled, total })}
            </span>
            {total > 0 && <span dir="ltr">{percent}%</span>}
          </div>
          <div
            role="progressbar"
            aria-label={t('progressLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={total > 0 ? percent : undefined}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                'h-full rounded-full bg-primary transition-all duration-500 ease-out',
                total === 0 && 'w-full animate-pulse opacity-40',
              )}
              style={total > 0 ? { width: `${Math.max(percent, 4)}%` } : undefined}
            />
          </div>
        </div>
      )}

      {/* Outcome */}
      {!active && (
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 ps-7 text-xs text-muted-foreground">
          <span>{t('pagesImported', { count: job.pagesCrawled })}</span>
          {job.status === 'COMPLETED' && notImported > 0 && (
            <span>{t('pagesSkipped', { count: notImported })}</span>
          )}
        </div>
      )}

      {job.status === 'FAILED' && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="min-w-0 break-words text-xs text-destructive">
            {crawlError.fromJobError(job.errorMessage, t('failedToast'))}
          </p>
        </div>
      )}
    </li>
  );
}
