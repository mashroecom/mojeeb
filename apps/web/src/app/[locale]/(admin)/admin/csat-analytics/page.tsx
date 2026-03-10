'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import { useAdminRatings, useAdminRatingStats } from '@/hooks/useAdmin';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Star, MessageSquare } from 'lucide-react';

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-4 w-4',
            i < count ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}

const RATING_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-lime-500',
  5: 'bg-green-500',
};

export default function CsatAnalyticsPage() {
  const t = useTranslations('admin.csatAnalytics');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: statsData, isLoading: statsLoading } = useAdminRatingStats();
  const { data, isLoading, error } = useAdminRatings({
    page,
    limit: 10,
    rating: ratingFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const ratings = data?.data ?? [];
  const pagination = data?.pagination;
  const stats = statsData;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tc('error')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-6 shadow-sm animate-pulse">
              <div className="h-8 rounded bg-muted w-1/2" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Average Rating */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-1">{t('averageRating')}</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">
                {stats.average ? stats.average.toFixed(1) : '—'}
              </span>
              <Stars count={Math.round(stats.average || 0)} />
            </div>
          </div>

          {/* Total Ratings */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-1">{t('totalRatings')}</p>
            <span className="text-3xl font-bold">{stats.total ?? 0}</span>
          </div>

          {/* Rating Distribution */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground mb-3">{t('ratingDistribution')}</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((r) => {
                const count = stats.distribution?.[r] ?? 0;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={r} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-muted-foreground">{r}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', RATING_COLORS[r])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-end text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Rating filter tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => {
              setRatingFilter(undefined);
              setPage(1);
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              !ratingFilter
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {t('all')}
          </button>
          {[5, 4, 3, 2, 1].map((r) => (
            <button
              key={r}
              onClick={() => {
                setRatingFilter(r);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1',
                ratingFilter === r
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {r} <Star className="h-3 w-3" />
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 ms-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-background px-2 py-1.5 text-sm"
          />
          <span className="text-sm text-muted-foreground">—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-6 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded bg-muted" />
            ))}
          </div>
        </div>
      ) : ratings.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
            <Star className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">{t('noRatings')}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('customer')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('rating')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('comment')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('conversation')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('date')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ratings.map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">
                      {r.conversation?.customerName || r.customerId || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Stars count={r.rating} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                      {r.feedback || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.conversation ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <MessageSquare className="h-3 w-3" />
                          {r.conversation.channel?.name || t('conversation')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {fmtDate(r.createdAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {ratings.map((r: any) => (
              <div key={r.id} className="rounded-xl border bg-card shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-sm">
                    {r.conversation?.customerName || r.customerId || '—'}
                  </p>
                  <Stars count={r.rating} />
                </div>
                {r.feedback && <p className="text-sm text-muted-foreground mb-2">{r.feedback}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>{fmtDate(r.createdAt, locale)}</span>
                  {r.conversation && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <MessageSquare className="h-3 w-3" />
                      {r.conversation.channel?.name || t('conversation')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && (
            <AdminPagination
              page={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              previousLabel={tc('previous')}
              nextLabel={tc('next')}
              pageLabel={tc('page')}
              ofLabel={tc('of')}
            />
          )}
        </>
      )}
    </div>
  );
}
