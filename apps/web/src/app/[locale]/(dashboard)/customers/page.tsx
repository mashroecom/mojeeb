'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, Loader2, Search, Users, X } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { toast } from '@/hooks/useToast';
import { fmtDateTime } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import {
  CUSTOMER_CHANNELS,
  useCustomers,
  useExportCustomers,
  type Customer,
  type CustomerChannel,
} from '@/hooks/useCustomers';
import { ChannelBadge, EmotionBadge } from './_components/CustomerBadges';
import { CHANNEL_LABEL_KEY } from './_lib/display';

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const t = useTranslations('dashboard.customers');
  const ts = useTranslations('dashboard.sidebar');
  const tb = useTranslations('dashboard.breadcrumb');
  const locale = useLocale();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState<CustomerChannel | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const filters = {
    search: debouncedSearch || undefined,
    channel: channel || undefined,
  };
  const { data, isLoading, isError, isPlaceholderData, refetch } = useCustomers({
    page,
    limit: PAGE_SIZE,
    ...filters,
  });
  const exportCustomers = useExportCustomers();

  const customers: Customer[] = data?.data ?? [];
  const pagination = data?.pagination;
  const hasFilters = !!filters.search || !!filters.channel;

  function clearFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setChannel('');
    setPage(1);
  }

  function handleExport() {
    exportCustomers.mutate(filters, { onError: () => toast.error(t('exportFailed')) });
  }

  const profileHref = (c: Customer) => `/customers/${c.id}`;

  return (
    <div>
      <Breadcrumb
        items={[{ label: tb('dashboard'), href: '/dashboard' }, { label: ts('customers') }]}
        className="mb-4"
      />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {pagination && (
            <div className="text-sm text-muted-foreground" data-testid="customers-total">
              {t('totalCount', { count: pagination.total })}
            </div>
          )}
          <button
            onClick={handleExport}
            disabled={!pagination?.total || exportCustomers.isPending}
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {exportCustomers.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportCustomers.isPending ? t('exporting') : t('export')}
          </button>
        </div>
      </div>

      {/* Search + channel filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="w-full rounded-lg border bg-card ps-9 pe-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as CustomerChannel | '');
            setPage(1);
          }}
          aria-label={t('filterByChannel')}
          className="rounded-lg border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <option value="">{t('allChannels')}</option>
          {CUSTOMER_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t(CHANNEL_LABEL_KEY[c])}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
            {t('clearFilters')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <ErrorState
            title={t('errorTitle')}
            description={t('errorDescription')}
            retryLabel={t('retry')}
            onRetry={() => refetch()}
          />
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-sm">
          {hasFilters ? (
            <EmptyState
              icon={Search}
              title={t('noResults')}
              description={t('noResultsDescription')}
              action={{ label: t('clearFilters'), onClick: clearFilters }}
            />
          ) : (
            <EmptyState icon={Users} title={t('noCustomers')} />
          )}
        </div>
      ) : (
        <div className={cn('transition-opacity', isPlaceholderData && 'opacity-60')}>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  {(
                    [
                      'name',
                      'email',
                      'phone',
                      'channels',
                      'conversations',
                      'lastActive',
                      'sentiment',
                    ] as const
                  ).map((col) => (
                    <th
                      key={col}
                      className="px-3 py-3 text-start text-xs font-medium text-muted-foreground uppercase whitespace-nowrap"
                    >
                      {t(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(profileHref(c))}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-3 py-3 text-sm font-medium max-w-[200px]">
                      <Link
                        href={profileHref(c)}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate hover:text-primary hover:underline"
                      >
                        <bdi>{c.name || t('unknownCustomer')}</bdi>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground max-w-[190px] truncate">
                      {c.email ? <bdi>{c.email}</bdi> : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {c.phone ? <bdi dir="ltr">{c.phone}</bdi> : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.channels.map((ch) => (
                          <ChannelBadge key={ch} channel={ch} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {c.conversationCount}
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDateTime(c.lastActiveAt, locale)}
                    </td>
                    <td className="px-3 py-3">
                      <EmotionBadge emotion={c.lastEmotion} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {customers.map((c) => (
              <Link
                key={c.id}
                href={profileHref(c)}
                className="block rounded-xl border bg-card p-4 shadow-sm hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      <bdi>{c.name || t('unknownCustomer')}</bdi>
                    </p>
                    {c.email && (
                      <p className="text-sm text-muted-foreground truncate">
                        <bdi>{c.email}</bdi>
                      </p>
                    )}
                    {c.phone && (
                      <p className="text-sm text-muted-foreground">
                        <bdi dir="ltr">{c.phone}</bdi>
                      </p>
                    )}
                  </div>
                  <EmotionBadge emotion={c.lastEmotion} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {c.channels.map((ch) => (
                    <ChannelBadge key={ch} channel={ch} />
                  ))}
                  <span>
                    {t('conversations')}: {c.conversationCount}
                  </span>
                  <span>
                    {t('lastActive')}: {fmtDateTime(c.lastActiveAt, locale)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {pagination && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              className="mt-4"
            />
          )}
        </div>
      )}
    </div>
  );
}
