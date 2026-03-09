'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useAdminKnowledgeBases,
  useAdminKnowledgeBaseStats,
  useDeleteAdminKnowledgeBase,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Search,
  Trash2,
  BookOpen,
  FileText,
  Database,
  CheckCircle,
} from 'lucide-react';

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
      <td className="px-4 py-3"><div className="h-3 w-12 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-12 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-12 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-7 w-8 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminKnowledgeBasesPage() {
  const t = useTranslations('admin.knowledgeBases');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  // Debounce search (300ms)
  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, refetch } = useAdminKnowledgeBases({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
  });
  const { data: stats, isLoading: statsLoading } = useAdminKnowledgeBaseStats();
  const deleteKB = useDeleteAdminKnowledgeBase();

  const knowledgeBases = data?.data ?? [];
  const pagination = data?.pagination;

  // Derive embeddings completed count from byEmbeddingStatus array
  const embeddingsCompleted = useMemo(() => {
    if (!stats?.byEmbeddingStatus) return 0;
    const found = stats.byEmbeddingStatus.find((s: any) => s.embeddingStatus === 'COMPLETED');
    return found?._count ?? 0;
  }, [stats]);

  function handleDelete(kbId: string) {
    setConfirmDialog({
      open: true,
      title: t('deleteKB'),
      message: t('confirmDelete'),
      variant: 'danger',
      onConfirm: () => {
        deleteKB.mutate(kbId, {
          onSuccess: () => addToast('success', t('deleteSuccess')),
          onError: () => addToast('error', t('deleteFailed')),
        });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tc('error')}</p>
        <button
          onClick={() => refetch()}
          className="text-sm text-primary hover:underline"
        >
          {tc('retry')}
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative pb-16">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {statsLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <BookOpen className="h-4 w-4" />
                {t('totalKBs')}
              </div>
              <p className="text-2xl font-bold">{stats?.totalKBs ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                {t('totalDocuments')}
              </div>
              <p className="text-2xl font-bold">{stats?.totalDocs ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Database className="h-4 w-4" />
                {t('totalChunks')}
              </div>
              <p className="text-2xl font-bold">{stats?.totalChunks ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
                <CheckCircle className="h-4 w-4" />
                {t('embeddingStatus')}
              </div>
              <p className="text-2xl font-bold">{embeddingsCompleted}</p>
            </div>
          </>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-card ps-10 pe-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('name')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('organization')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('documents')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('chunks')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('linkedAgents')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('created')}</th>
                  <th className="text-end px-4 py-3 font-medium text-muted-foreground">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <RowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">{t('noKBs')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('name')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('organization')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('documents')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('chunks')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('linkedAgents')}</th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('created')}</th>
                  <th className="text-end px-4 py-3 font-medium text-muted-foreground">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {knowledgeBases.map((kb: any) => (
                  <tr
                    key={kb.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {kb.name || '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {kb.org?.name ?? '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {kb._count?.documents ?? 0}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {'\u2014'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {kb._count?.agents ?? 0}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {fmtDateTime(kb.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleDelete(kb.id)}
                          disabled={deleteKB.isPending}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title={t('deleteKB')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && pagination && (
          <div className="border-t px-4 py-3">
            <AdminPagination
              page={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              previousLabel={tc('previous')}
              nextLabel={tc('next')}
              pageLabel={tc('page')}
              ofLabel={tc('of')}
            />
          </div>
        )}
      </div>

      <AdminConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        loading={deleteKB.isPending}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
