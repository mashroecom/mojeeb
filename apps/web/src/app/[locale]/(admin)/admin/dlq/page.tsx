'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import { useAdminDLQ, useRetryDLQJob, useDiscardDLQJob } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Loader2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Inbox,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { cn } from '@/lib/utils';

interface DLQJob {
  id: string;
  name: string;
  data: {
    originalQueue?: string;
    jobName?: string;
    error?: string;
    data?: Record<string, unknown>;
  };
  timestamp: number;
}

const QUEUE_COLORS: Record<string, string> = {
  'inbound-messages': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  'ai-processing': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  'outbound-messages': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  'webhook-dispatch': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
};

const QUEUE_LABEL_KEYS: Record<string, string> = {
  'inbound-messages': 'queueInbound',
  'ai-processing': 'queueAI',
  'outbound-messages': 'queueOutbound',
  'webhook-dispatch': 'queueWebhook',
};

function JobCard({
  job,
  onRetry,
  onDiscard,
  isRetrying,
  isDiscarding,
  t,
  locale,
}: {
  job: DLQJob;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  isRetrying: boolean;
  isDiscarding: boolean;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const queueKey = job.data.originalQueue || '';
  const queueColor = QUEUE_COLORS[queueKey] || 'bg-muted text-muted-foreground';
  const queueLabelKey = QUEUE_LABEL_KEYS[queueKey];
  const queueLabel = queueLabelKey ? t(queueLabelKey) : (job.data.originalQueue || t('unknown'));

  return (
    <div className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', queueColor)}>
              {queueLabel}
            </span>
            <span className="text-sm font-medium truncate">{job.data.jobName || job.name}</span>
            <span className="text-xs text-muted-foreground">#{job.id}</span>
          </div>
          {job.data.error && (
            <p className="mt-1 text-xs text-red-500 line-clamp-2">{job.data.error}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {fmtDateTime(new Date(job.timestamp).toISOString(), locale)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onRetry(job.id)}
            disabled={isRetrying}
            title={t('retry')}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {t('retry')}
          </button>
          <button
            onClick={() => onDiscard(job.id)}
            disabled={isDiscarding}
            title={t('discard')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 text-red-600 px-2.5 py-1.5 text-xs font-medium hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {isDiscarding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            {t('discard')}
          </button>
        </div>
      </div>

      {/* Expandable data */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {t('viewData')}
      </button>
      {expanded && (
        <pre className="mt-2 overflow-auto max-h-48 rounded-lg bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(job.data.data || job.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function DLQPage() {
  const t = useTranslations('admin.dlq');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useAdminDLQ({ page, limit });
  const retryJob = useRetryDLQJob();
  const discardJob = useDiscardDLQJob();

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  function handleRetry(id: string) {
    setRetryingId(id);
    retryJob.mutate(id, {
      onSuccess: () => {
        addToast('success', t('retrySuccess'));
        setRetryingId(null);
      },
      onError: () => {
        addToast('error', t('retryFailed'));
        setRetryingId(null);
      },
    });
  }

  function handleDiscard(id: string) {
    setDiscardingId(id);
    discardJob.mutate(id, {
      onSuccess: () => {
        addToast('success', t('discardSuccess'));
        setDiscardingId(null);
      },
      onError: () => {
        addToast('error', t('discardFailed'));
        setDiscardingId(null);
      },
    });
  }

  const jobs: DLQJob[] = data?.jobs || [];
  const total: number = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) return <AdminEmptyState icon={AlertTriangle} message={tc('error')} />;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Stats bar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">{t('totalJobs')}</p>
          <p className="text-2xl font-bold">{total}</p>
        </div>
      </div>

      {/* Jobs list */}
      {jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onRetry={handleRetry}
              onDiscard={handleDiscard}
              isRetrying={retryingId === job.id}
              isDiscarding={discardingId === job.id}
              t={t}
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">{t('empty')}</p>
          <p className="text-xs mt-1">{t('emptyDesc')}</p>
        </div>
      )}

      {/* Pagination */}
      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />
    </div>
  );
}
