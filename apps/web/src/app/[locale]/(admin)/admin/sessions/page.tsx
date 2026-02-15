'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { exportToCsv } from '@/lib/exportCsv';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useAdminSessions,
  useAdminSessionStats,
  useKillSession,
  useKillUserSessions,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import {
  Monitor,
  Search,
  XCircle,
  Users,
  CalendarPlus,
  Download,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionEntry {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function parseUA(ua: string): string {
  if (!ua) return '-';
  // Simple browser/OS detection
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} / ${os}`;
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function StatSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm animate-pulse">
      <div className="h-3 w-20 rounded bg-muted mb-3" />
      <div className="h-7 w-16 rounded bg-muted" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b last:border-b-0">
      <td className="px-4 py-3"><div className="h-3 w-32 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-7 w-24 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SessionsPage() {
  const t = useTranslations('admin.sessions');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [email, setEmail] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant?: 'danger' | 'default'; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(email && { email }),
    }),
    [page, email],
  );

  const { data, isLoading, isError, refetch } = useAdminSessions(params);
  const { data: stats, isLoading: statsLoading } = useAdminSessionStats();
  const killSession = useKillSession();
  const killUserSessions = useKillUserSessions();

  const entries: SessionEntry[] = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function handleExport() {
    if (!entries.length) return;
    const rows = entries.map((entry) => ({
      Email: entry.userEmail,
      User: entry.userName || '',
      IP: entry.ip,
      Device: parseUA(entry.userAgent),
      'Created At': fmtDateTime(entry.createdAt, locale),
      'Expires At': fmtDateTime(entry.expiresAt, locale),
    }));
    exportToCsv('admin-sessions', rows);
  }

  const handleSearch = () => {
    setEmail(searchInput.trim());
    setPage(1);
  };

  const handleKill = (id: string) => {
    setConfirmDialog({
      open: true,
      title: t('kill'),
      message: t('confirmKill'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          await killSession.mutateAsync(id);
          addToast('success', t('killed'));
        } catch {
          addToast('error', tc('error'));
        }
      },
    });
  };

  const handleKillAll = (userId: string) => {
    setConfirmDialog({
      open: true,
      title: t('killAll'),
      message: t('confirmKillAll'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          await killUserSessions.mutateAsync(userId);
          addToast('success', t('killedAll'));
        } catch {
          addToast('error', tc('error'));
        }
      },
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!entries.length}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Download className="h-4 w-4" />
          {tc('export')}
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        {statsLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                {t('totalSessions')}
              </div>
              <p className="text-2xl font-bold">{stats?.totalSessions ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CalendarPlus className="h-4 w-4" />
                {t('todaySessions')}
              </div>
              <p className="text-2xl font-bold">{stats?.todaySessions ?? 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Search */}
      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('searchByEmail')}
            className="w-full rounded-md border bg-background ps-9 pe-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={handleSearch}
          className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{tc('error')}</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('user')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('ip')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('device')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('createdAt')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('expiresAt')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}

              {!isLoading && !isError && entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Monitor className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noRecords')}</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium truncate max-w-[200px]">
                        {entry.userEmail}
                      </div>
                      {entry.userName && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                          {entry.userName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-muted-foreground">{entry.ip}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{parseUA(entry.userAgent)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDateTime(entry.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDateTime(entry.expiresAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleKill(entry.id)}
                          disabled={killSession.isPending}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-3 w-3" />
                          {t('kill')}
                        </button>
                        <button
                          onClick={() => handleKillAll(entry.userId)}
                          disabled={killUserSessions.isPending}
                          className="inline-flex items-center gap-1 rounded-md border border-orange-200 px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-3 w-3" />
                          {t('killAll')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && (
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />
      )}

      <AdminConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
