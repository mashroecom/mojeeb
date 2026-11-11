'use client';

import { useTranslations, useLocale } from 'next-intl';
import {
  Key,
  KeyRound,
  CircleSlash,
  Ban,
  Clock,
  CalendarClock,
  CircleDashed,
  TimerOff,
  Send,
  CheckCheck,
  Eye,
  AlertTriangle,
  Timer,
  Info,
  BarChart3,
} from 'lucide-react';
import { useAdminApiUsageStats, useAdminMessageDeliveryStats } from '@/hooks/useAdmin';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminEmptyState,
  AdminBadge,
} from '@/components/admin';
import { AdminChartCard } from '@/components/admin/AdminChartCard';
import { MojeebBarChart } from '@/components/charts';
import { fmtDateTime, fmtDateShort } from '@/lib/dateFormat';
import { fmtNumber, fmtPercent } from '@/lib/adminFormat';
import { cn } from '@/lib/utils';

type KeyStatus = 'active' | 'expired' | 'revoked';

interface TopOrgRow {
  orgId: string;
  orgName: string | null;
  keyCount: number;
  usableKeyCount: number;
  lastUsedAt: string | null;
}

interface RecentKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  orgId: string;
  orgName: string;
  lastUsedAt: string;
  status: KeyStatus;
}

interface ApiUsageStats {
  totalKeys: number;
  activeKeys: number;
  inactiveKeys: number;
  revokedKeys: number;
  expiredKeys: number;
  neverUsedKeys: number;
  usedLast24h: number;
  usedLast7d: number;
  inactiveThresholdDays: number;
  topOrgs: TopOrgRow[];
  recentActivity: RecentKeyRow[];
}

type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
type ChannelType = 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM' | 'WEBCHAT';

interface ChannelRow {
  channelType: ChannelType;
  total: number;
  delivered: number;
  read: number;
  failed: number;
  failureRate: number;
}

interface FailureRow {
  id: string;
  failureReason: string | null;
  createdAt: string;
  conversationId: string;
  orgName: string;
  channelType: ChannelType;
  channelName: string;
}

interface MessageDeliveryStats {
  windowDays: number;
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
  avgDeliverySeconds: number | null;
  byStatus: { status: DeliveryStatus; count: number; percentage: number }[];
  byChannel: ChannelRow[];
  topFailureReasons: { reason: string | null; count: number }[];
  daily: { date: string; total: number; failed: number; succeeded: number }[];
  recentFailures: FailureRow[];
}

const KEY_STATUS_VARIANT: Record<KeyStatus, 'success' | 'warning' | 'error'> = {
  active: 'success',
  expired: 'warning',
  revoked: 'error',
};

const DELIVERY_STATUS_COLOR: Record<DeliveryStatus, string> = {
  QUEUED: 'bg-slate-400',
  SENT: 'bg-blue-500',
  DELIVERED: 'bg-emerald-500',
  READ: 'bg-violet-500',
  FAILED: 'bg-red-500',
};

function SectionError({ message, retryLabel, onRetry }: SectionErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-12 text-center shadow-sm">
      <p className="text-destructive font-medium mb-2">{message}</p>
      <button type="button" onClick={onRetry} className="text-sm text-primary hover:underline">
        {retryLabel}
      </button>
    </div>
  );
}

interface SectionErrorProps {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}

export default function AdminApiUsagePage() {
  const t = useTranslations('admin.apiUsage');
  const td = useTranslations('admin.messageDelivery');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const usageQuery = useAdminApiUsageStats();
  const deliveryQuery = useAdminMessageDeliveryStats();

  const usage = usageQuery.data as ApiUsageStats | undefined;
  const delivery = deliveryQuery.data as MessageDeliveryStats | undefined;
  const usageLoading = usageQuery.isLoading;
  const deliveryLoading = deliveryQuery.isLoading;

  const n = (value: number | undefined) => fmtNumber(value ?? 0, locale);
  const windowDays = delivery?.windowDays ?? 30;
  const trendDays = delivery?.daily.length ?? 14;

  return (
    <div>
      <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* ───────────── API keys ───────────── */}
      {usageQuery.error ? (
        <SectionError
          message={tc('error')}
          retryLabel={tc('retry')}
          onRetry={() => usageQuery.refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <AdminStatCard
              icon={Key}
              label={t('totalKeys')}
              value={n(usage?.totalKeys)}
              loading={usageLoading}
            />
            <AdminStatCard
              icon={KeyRound}
              iconColor="text-emerald-500"
              label={t('activeKeys')}
              value={n(usage?.activeKeys)}
              loading={usageLoading}
            />
            <AdminStatCard
              icon={CircleSlash}
              iconColor="text-amber-500"
              label={t('inactiveKeys')}
              value={n(usage?.inactiveKeys)}
              loading={usageLoading}
            />
            <AdminStatCard
              icon={Ban}
              iconColor="text-red-500"
              label={t('revokedKeys')}
              value={n(usage?.revokedKeys)}
              loading={usageLoading}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-3">
            <AdminStatCard
              icon={Clock}
              iconColor="text-blue-500"
              label={t('usedLast24h')}
              value={n(usage?.usedLast24h)}
              loading={usageLoading}
            />
            <AdminStatCard
              icon={CalendarClock}
              iconColor="text-indigo-500"
              label={t('usedLast7d')}
              value={n(usage?.usedLast7d)}
              loading={usageLoading}
            />
            <AdminStatCard
              icon={CircleDashed}
              iconColor="text-muted-foreground"
              label={t('neverUsedKeys')}
              value={n(usage?.neverUsedKeys)}
              loading={usageLoading}
            />
            <AdminStatCard
              icon={TimerOff}
              iconColor="text-orange-500"
              label={t('expiredKeys')}
              value={n(usage?.expiredKeys)}
              loading={usageLoading}
            />
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground mb-6">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              {t('activeHint', { days: usage?.inactiveThresholdDays ?? 30 })} {t('usageNote')}
            </span>
          </p>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5 mb-10">
            {/* Top organizations */}
            <div className="xl:col-span-2">
              <h2 className="text-lg font-semibold mb-3">{t('topOrgs')}</h2>
              <AdminDataTable<TopOrgRow>
                loading={usageLoading}
                data={usage?.topOrgs ?? []}
                rowKey={(row) => row.orgId}
                emptyMessage={t('noTopOrgs')}
                skeletonRows={4}
                columns={[
                  {
                    key: 'org',
                    header: t('organization'),
                    render: (row) => (
                      <span className="text-sm font-medium">{row.orgName ?? t('deletedOrg')}</span>
                    ),
                  },
                  {
                    key: 'keys',
                    header: t('keyCount'),
                    render: (row) => <span className="text-sm">{n(row.keyCount)}</span>,
                  },
                  {
                    key: 'usable',
                    header: t('usableKeys'),
                    render: (row) => <span className="text-sm">{n(row.usableKeyCount)}</span>,
                  },
                ]}
              />
            </div>

            {/* Recent activity */}
            <div className="xl:col-span-3">
              <h2 className="text-lg font-semibold mb-3">{t('recentActivity')}</h2>
              <AdminDataTable<RecentKeyRow>
                loading={usageLoading}
                data={usage?.recentActivity ?? []}
                rowKey={(row) => row.id}
                emptyMessage={t('noActivity')}
                skeletonRows={4}
                columns={[
                  {
                    key: 'key',
                    header: t('keyName'),
                    render: (row) => (
                      <div>
                        <p className="text-sm font-medium">
                          <bdi>{row.name}</bdi>
                        </p>
                        <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                          {row.keyPrefix}…
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: 'org',
                    header: t('organization'),
                    render: (row) => (
                      <span className="text-sm text-muted-foreground">{row.orgName}</span>
                    ),
                  },
                  {
                    key: 'status',
                    header: t('status'),
                    render: (row) => (
                      <AdminBadge variant={KEY_STATUS_VARIANT[row.status]}>
                        {t(`status_${row.status}`)}
                      </AdminBadge>
                    ),
                  },
                  {
                    key: 'lastUsed',
                    header: t('lastUsed'),
                    render: (row) => (
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(row.lastUsedAt, locale)}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </>
      )}

      {/* ───────────── Message delivery ───────────── */}
      <div className="mb-4 mt-10">
        <h2 className="text-xl font-bold">{td('title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{td('subtitle', { days: windowDays })}</p>
      </div>

      {deliveryQuery.error ? (
        <SectionError
          message={tc('error')}
          retryLabel={tc('retry')}
          onRetry={() => deliveryQuery.refetch()}
        />
      ) : !deliveryLoading && (delivery?.total ?? 0) === 0 ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <AdminEmptyState icon={Send} message={td('noData')} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
            <AdminStatCard
              icon={Send}
              label={td('totalOutbound')}
              value={n(delivery?.total)}
              loading={deliveryLoading}
            />
            <AdminStatCard
              icon={CheckCheck}
              iconColor="text-emerald-500"
              label={td('deliveryRate')}
              value={fmtPercent(delivery?.deliveryRate ?? 0, locale)}
              loading={deliveryLoading}
            />
            <AdminStatCard
              icon={Eye}
              iconColor="text-violet-500"
              label={td('readRate')}
              value={fmtPercent(delivery?.readRate ?? 0, locale)}
              loading={deliveryLoading}
            />
            <AdminStatCard
              icon={AlertTriangle}
              iconColor="text-red-500"
              label={td('failureRate')}
              value={fmtPercent(delivery?.failureRate ?? 0, locale)}
              loading={deliveryLoading}
            />
            <AdminStatCard
              icon={Timer}
              iconColor="text-blue-500"
              label={td('avgDeliveryTime')}
              value={
                delivery?.avgDeliverySeconds == null
                  ? '—'
                  : td('secondsValue', { value: fmtNumber(delivery.avgDeliverySeconds, locale, 1) })
              }
              loading={deliveryLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5 mb-6">
            {/* Daily volume */}
            <AdminChartCard
              title={td('dailyTrend', { days: trendDays })}
              icon={BarChart3}
              className="xl:col-span-3"
            >
              <MojeebBarChart
                data={delivery?.daily ?? []}
                xKey="date"
                bars={[
                  { key: 'succeeded', color: '#10b981', name: td('succeeded'), stackId: 'msgs' },
                  { key: 'failed', color: '#ef4444', name: td('failed'), stackId: 'msgs' },
                ]}
                height={260}
                isLoading={deliveryLoading}
                formatX={(value) => fmtDateShort(value, locale)}
                formatY={(value) => fmtNumber(Number(value), locale, 1)}
                noDataMessage={td('noData')}
              />
            </AdminChartCard>

            {/* Status breakdown */}
            <div className="xl:col-span-2 rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">{td('byStatus')}</h3>
              {deliveryLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-6 rounded bg-muted" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {(delivery?.byStatus ?? []).map((row) => (
                    <div key={row.status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'h-2.5 w-2.5 rounded-full',
                              DELIVERY_STATUS_COLOR[row.status],
                            )}
                          />
                          {td(`status_${row.status}`)}
                        </span>
                        <span className="text-muted-foreground">
                          {n(row.count)} · {fmtPercent(row.percentage, locale)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', DELIVERY_STATUS_COLOR[row.status])}
                          style={{ width: `${Math.min(100, row.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5 mb-6">
            {/* By channel */}
            <div className="xl:col-span-3">
              <h3 className="text-lg font-semibold mb-3">{td('byChannel')}</h3>
              <AdminDataTable<ChannelRow>
                loading={deliveryLoading}
                data={delivery?.byChannel ?? []}
                rowKey={(row) => row.channelType}
                emptyMessage={td('noData')}
                skeletonRows={3}
                columns={[
                  {
                    key: 'channel',
                    header: td('channel'),
                    render: (row) => (
                      <span className="text-sm font-medium">
                        {td(`channel_${row.channelType}`)}
                      </span>
                    ),
                  },
                  {
                    key: 'total',
                    header: td('total'),
                    render: (row) => <span className="text-sm">{n(row.total)}</span>,
                  },
                  {
                    key: 'delivered',
                    header: td('delivered'),
                    render: (row) => <span className="text-sm">{n(row.delivered)}</span>,
                  },
                  {
                    key: 'read',
                    header: td('read'),
                    render: (row) => <span className="text-sm">{n(row.read)}</span>,
                  },
                  {
                    key: 'failed',
                    header: td('failed'),
                    render: (row) => (
                      <span className={cn('text-sm', row.failed > 0 && 'text-destructive')}>
                        {n(row.failed)}
                      </span>
                    ),
                  },
                  {
                    key: 'failureRate',
                    header: td('failureRate'),
                    render: (row) => (
                      <span className="text-sm text-muted-foreground">
                        {fmtPercent(row.failureRate, locale)}
                      </span>
                    ),
                  },
                ]}
              />
            </div>

            {/* Failure reasons */}
            <div className="xl:col-span-2 rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">{td('topFailureReasons')}</h3>
              {deliveryLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-5 rounded bg-muted" />
                  ))}
                </div>
              ) : (delivery?.topFailureReasons ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{td('noFailures')}</p>
              ) : (
                <ul className="space-y-3">
                  {(delivery?.topFailureReasons ?? []).map((row) => (
                    <li
                      key={row.reason ?? '__none__'}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <bdi className="min-w-0 break-words">{row.reason ?? td('unknownReason')}</bdi>
                      <AdminBadge variant="error" className="flex-shrink-0">
                        {n(row.count)}
                      </AdminBadge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent failures */}
          <h3 className="text-lg font-semibold mb-3">{td('recentFailures')}</h3>
          <AdminDataTable<FailureRow>
            loading={deliveryLoading}
            data={delivery?.recentFailures ?? []}
            rowKey={(row) => row.id}
            emptyMessage={td('noFailures')}
            skeletonRows={3}
            columns={[
              {
                key: 'time',
                header: td('time'),
                render: (row) => (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDateTime(row.createdAt, locale)}
                  </span>
                ),
              },
              {
                key: 'org',
                header: td('organization'),
                render: (row) => <span className="text-sm font-medium">{row.orgName}</span>,
              },
              {
                key: 'channel',
                header: td('channel'),
                render: (row) => (
                  <span className="text-sm">{td(`channel_${row.channelType}`)}</span>
                ),
              },
              {
                key: 'reason',
                header: td('reason'),
                render: (row) => (
                  <bdi className="text-sm text-muted-foreground">
                    {row.failureReason ?? td('unknownReason')}
                  </bdi>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
