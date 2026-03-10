'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle, XCircle, Clock, Globe, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';

interface CrawlJob {
  id: string;
  knowledgeBaseId: string;
  startUrl: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  pagesTotal: number;
  pagesCrawled: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

interface CrawlProgressViewProps {
  jobId: string;
  kbId: string;
}

export function CrawlProgressView({ jobId, kbId }: CrawlProgressViewProps) {
  const orgId = useAuthStore((s) => s.organization?.id);
  const t = useTranslations('dashboard.knowledgeBase');
  const locale = useLocale();

  // Fetch crawl job status with polling
  const { data: job, isLoading } = useQuery({
    queryKey: ['crawl-job', orgId, kbId, jobId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<CrawlJob>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/crawl/${jobId}`,
      );
      return data.data;
    },
    enabled: !!orgId && !!kbId && !!jobId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if job is running or pending
      const job = query.state.data;
      return job?.status === 'RUNNING' || job?.status === 'PENDING' ? 2000 : false;
    },
  });

  // Status badge configuration
  const statusConfig = {
    PENDING: {
      icon: <Clock className="h-3 w-3" />,
      label: t('statusPending'),
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    RUNNING: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: t('statusProcessing'),
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    },
    COMPLETED: {
      icon: <CheckCircle className="h-3 w-3" />,
      label: t('statusCompleted'),
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    FAILED: {
      icon: <XCircle className="h-3 w-3" />,
      label: t('statusFailed'),
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
    CANCELLED: {
      icon: <XCircle className="h-3 w-3" />,
      label: t('cancelled'),
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    },
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{t('crawlJobNotFound')}</span>
        </div>
      </div>
    );
  }

  const status = statusConfig[job.status];
  const progress = job.pagesTotal > 0 ? (job.pagesCrawled / job.pagesTotal) * 100 : 0;

  // Calculate estimated completion time (rough estimate)
  const getEstimatedCompletion = () => {
    if (job.status !== 'RUNNING' || !job.startedAt || job.pagesCrawled === 0) {
      return null;
    }

    const startTime = new Date(job.startedAt).getTime();
    const now = Date.now();
    const elapsed = now - startTime;
    const avgTimePerPage = elapsed / job.pagesCrawled;
    const remainingPages = job.pagesTotal - job.pagesCrawled;
    const estimatedTimeLeft = avgTimePerPage * remainingPages;
    const estimatedCompletion = new Date(now + estimatedTimeLeft);

    return estimatedCompletion;
  };

  const estimatedCompletion = getEstimatedCompletion();

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Globe className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm mb-1">{t('crawlProgress')}</h3>
            <p className="text-xs text-muted-foreground truncate" dir="ltr">
              {job.startUrl}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0',
            status.color,
          )}
        >
          {status.icon}
          {status.label}
        </span>
      </div>

      {/* Progress Bar */}
      {job.status === 'RUNNING' && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              {job.pagesCrawled} / {job.pagesTotal} {t('pages')}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Completed Stats */}
      {(job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">{job.pagesCrawled}</span> {t('pagesCrawled')}
          </div>
          {job.pagesTotal > 0 && job.pagesTotal !== job.pagesCrawled && (
            <div>
              <span className="font-medium">{job.pagesTotal}</span> {t('pagesDiscovered')}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {job.status === 'FAILED' && job.errorMessage && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-destructive mb-1">{t('error')}</p>
              <p className="text-xs text-destructive/90 break-words">{job.errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground border-t pt-3">
        {job.startedAt && (
          <div>
            <span className="font-medium">{t('started')}</span>{' '}
            {fmtDate(job.startedAt, locale)}
          </div>
        )}
        {job.completedAt && (
          <div>
            <span className="font-medium">{tc('common.completed')}:</span>{' '}
            {fmtDate(job.completedAt, locale)}
          </div>
        )}
        {estimatedCompletion && job.status === 'RUNNING' && (
          <div>
            <span className="font-medium">{t('estCompletion')}</span>{' '}
            {fmtDate(estimatedCompletion.toISOString(), locale)}
          </div>
        )}
      </div>
    </div>
  );
}
