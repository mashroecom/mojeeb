'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useSystemHealth, useSystemQueues, useSystemDbStats } from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';
import {
  Database,
  Server,
  Layers,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowDownAZ,
  ArrowUpAZ,
} from 'lucide-react';
import { useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthService {
  name: string;
  status: 'healthy' | 'unhealthy';
  latency?: number;
}

interface QueueInfo {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface DbTable {
  table: string;
  rowCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number, locale?: string) {
  return new Intl.NumberFormat(locale).format(n);
}

const healthIcons: Record<string, typeof Database> = {
  database: Database,
  redis: Server,
  queues: Layers,
};

const queueBarColors: Record<string, string> = {
  waiting: 'bg-amber-400 dark:bg-amber-500',
  active: 'bg-blue-400 dark:bg-blue-500',
  completed: 'bg-green-400 dark:bg-green-500',
  failed: 'bg-red-400 dark:bg-red-500',
  delayed: 'bg-muted-foreground',
};

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function HealthSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="h-5 w-20 rounded-full bg-muted" />
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-5 space-y-3">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 w-14 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between border-b py-3 last:border-b-0">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SystemPage() {
  const t = useTranslations('admin.system');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const {
    data: healthData,
    isLoading: loadingHealth,
    isError: errorHealth,
    refetch: refetchHealth,
    dataUpdatedAt: healthUpdatedAt,
  } = useSystemHealth();

  const {
    data: queuesData,
    isLoading: loadingQueues,
    isError: errorQueues,
    refetch: refetchQueues,
    dataUpdatedAt: queuesUpdatedAt,
  } = useSystemQueues();

  const {
    data: dbStatsData,
    isLoading: loadingDb,
    isError: errorDb,
    refetch: refetchDb,
  } = useSystemDbStats();

  const [sortAsc, setSortAsc] = useState(false);

  // Normalize health data
  const services: HealthService[] = useMemo(() => {
    if (!healthData) return [];
    // API may return { database: {...}, redis: {...}, queues: {...} } or an array
    if (Array.isArray(healthData)) return healthData;
    return Object.entries(healthData).map(([key, value]) => ({
      name: key,
      ...(value as Omit<HealthService, 'name'>),
    }));
  }, [healthData]);

  // Normalize queues data
  const queues: QueueInfo[] = useMemo(() => {
    if (!queuesData) return [];
    if (Array.isArray(queuesData)) return queuesData;
    return Object.entries(queuesData).map(([key, value]) => ({
      name: key,
      ...(value as Omit<QueueInfo, 'name'>),
    }));
  }, [queuesData]);

  // Normalize & sort db stats
  const dbTables: DbTable[] = useMemo(() => {
    if (!dbStatsData) return [];
    const tables: DbTable[] = Array.isArray(dbStatsData)
      ? dbStatsData
      : Object.entries(dbStatsData).map(([table, rowCount]) => ({
          table,
          rowCount: Number(rowCount),
        }));
    return [...tables].sort((a, b) =>
      sortAsc ? a.rowCount - b.rowCount : b.rowCount - a.rowCount,
    );
  }, [dbStatsData, sortAsc]);

  // --- Render ---

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {/* ------------------------------------------------------------------ */}
      {/* Health Status Cards                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          {healthUpdatedAt > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              30s
            </span>
          )}
        </div>

        {errorHealth && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{tc('error')}</p>
            <button
              onClick={() => refetchHealth()}
              className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
            >
              {tc('retry')}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {loadingHealth
            ? Array.from({ length: 3 }).map((_, i) => <HealthSkeleton key={i} />)
            : services.map((svc) => {
                const key = svc.name.toLowerCase();
                const Icon = healthIcons[key] ?? Server;
                const isHealthy = svc.status === 'healthy';
                const labelKey = key as 'database' | 'redis' | 'queues';
                return (
                  <div key={svc.name} className="rounded-xl border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          isHealthy
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-red-100 dark:bg-red-900/30',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5',
                            isHealthy
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400',
                          )}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{t(labelKey)}</p>
                        {svc.latency != null && (
                          <p className="text-xs text-muted-foreground">
                            {t('latency')}: {svc.latency}ms
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        isHealthy
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      )}
                    >
                      {isHealthy ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {isHealthy ? t('healthy') : t('unhealthy')}
                    </span>
                  </div>
                );
              })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Queue Stats                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">{t('queues')}</h2>
          {queuesUpdatedAt > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              15s
            </span>
          )}
        </div>

        {errorQueues && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{tc('error')}</p>
            <button
              onClick={() => refetchQueues()}
              className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
            >
              {tc('retry')}
            </button>
          </div>
        )}

        {loadingQueues && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <QueueSkeleton key={i} />
            ))}
          </div>
        )}

        {!loadingQueues && !errorQueues && queues.length === 0 && (
          <div className="rounded-xl border bg-card py-8 text-center">
            <Layers className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">{tc('noData')}</p>
          </div>
        )}

        {!loadingQueues && !errorQueues && queues.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {queues.map((q) => {
              const total = q.waiting + q.active + q.completed + q.failed + q.delayed;
              const segments = [
                { key: 'waiting', count: q.waiting },
                { key: 'active', count: q.active },
                { key: 'completed', count: q.completed },
                { key: 'failed', count: q.failed },
                { key: 'delayed', count: q.delayed },
              ];
              return (
                <div key={q.name} className="rounded-xl border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold mb-3 capitalize">{q.name}</h3>

                  {/* Horizontal bar */}
                  {total > 0 ? (
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted mb-3">
                      {segments.map((seg) =>
                        seg.count > 0 ? (
                          <div
                            key={seg.key}
                            className={cn('h-full transition-all', queueBarColors[seg.key])}
                            style={{ width: `${(seg.count / total) * 100}%` }}
                            title={`${t(seg.key as 'waiting' | 'active' | 'completed' | 'failed' | 'delayed')}: ${formatNumber(seg.count, locale)}`}
                          />
                        ) : null,
                      )}
                    </div>
                  ) : (
                    <div className="h-3 w-full rounded-full bg-muted mb-3" />
                  )}

                  {/* Counts */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {segments.map((seg) => (
                      <span key={seg.key} className="inline-flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', queueBarColors[seg.key])} />
                        {t(
                          seg.key as 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
                        )}: {formatNumber(seg.count, locale)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Database Stats Table                                                */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('dbStats')}</h2>
          <button
            onClick={() => refetchDb()}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            title={tc('refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {errorDb && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{tc('error')}</p>
            <button
              onClick={() => refetchDb()}
              className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
            >
              {tc('retry')}
            </button>
          </div>
        )}

        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center justify-between border-b px-5 py-3 bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('tableName')}
            </span>
            <button
              onClick={() => setSortAsc((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              {t('rowCount')}
              {sortAsc ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" />}
            </button>
          </div>

          {loadingDb && (
            <div className="px-5 py-2">
              <TableSkeleton />
            </div>
          )}

          {!loadingDb && !errorDb && dbTables.length === 0 && (
            <div className="py-8 text-center">
              <Database className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{tc('noData')}</p>
            </div>
          )}

          {!loadingDb && !errorDb && dbTables.length > 0 && (
            <div className="divide-y">
              {dbTables.map((row) => (
                <div
                  key={row.table}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-mono">{row.table}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatNumber(row.rowCount, locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
