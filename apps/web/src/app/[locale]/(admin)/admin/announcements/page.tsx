'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Info,
  AlertTriangle,
  AlertCircle,
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL';
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  title: string;
  body: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL';
  startsAt: string;
  endsAt: string;
}

const emptyForm: FormData = {
  title: '',
  body: '',
  type: 'INFO',
  startsAt: '',
  endsAt: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typeBadgeColors: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  WARNING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const typeIcons: Record<string, typeof Info> = {
  INFO: Info,
  WARNING: AlertTriangle,
  CRITICAL: AlertCircle,
};


function toInputDate(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnnouncementsPage() {
  const t = useTranslations('admin.announcements');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useAdminAnnouncements({ page, limit: 10 });
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();

  const announcements: Announcement[] = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  // --- Form handlers ---

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(ann: Announcement) {
    setEditingId(ann.id);
    setForm({
      title: ann.title,
      body: ann.body,
      type: ann.type,
      startsAt: toInputDate(ann.startsAt),
      endsAt: toInputDate(ann.endsAt),
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      title: form.title,
      body: form.body,
      type: form.type,
    };
    if (form.startsAt) payload.startsAt = form.startsAt;
    if (form.endsAt) payload.endsAt = form.endsAt;

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...payload } as Parameters<typeof updateMutation.mutateAsync>[0]);
    } else {
      await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0]);
    }
    closeForm();
  }

  async function handleToggleActive(ann: Announcement) {
    await updateMutation.mutateAsync({ id: ann.id, isActive: !ann.isActive });
  }

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // --- Render ---

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t('create')}
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-xl border bg-card p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingId ? t('edit') : t('create')}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              aria-label={tc('close')}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">{t('titleField')}</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
              />
            </div>

            {/* Body */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">{t('body')}</label>
              <textarea
                required
                rows={3}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors resize-none"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('type')}</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FormData['type'] }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
              >
                <option value="INFO">{t('info')}</option>
                <option value="WARNING">{t('warning')}</option>
                <option value="CRITICAL">{t('critical')}</option>
              </select>
            </div>

            {/* Starts At */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('startsAt')}</label>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
              />
            </div>

            {/* Ends At */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('endsAt')}
                <span className="text-muted-foreground font-normal ms-1">{t('optional')}</span>
              </label>
              <input
                type="date"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </button>
          </div>
        </form>
      )}

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{tc('error')}</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && announcements.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <Megaphone className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">{t('noAnnouncements')}</p>
        </div>
      )}

      {/* Announcement Cards */}
      {!isLoading && !isError && announcements.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {announcements.map((ann) => {
            const TypeIcon = typeIcons[ann.type] ?? Info;
            return (
              <div
                key={ann.id}
                className={cn(
                  'rounded-xl border bg-card p-5 shadow-sm transition-colors',
                  !ann.isActive && 'opacity-60',
                )}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <TypeIcon className={cn(
                      'h-5 w-5 mt-0.5 shrink-0',
                      ann.type === 'INFO' && 'text-blue-500',
                      ann.type === 'WARNING' && 'text-yellow-500',
                      ann.type === 'CRITICAL' && 'text-red-500',
                    )} />
                    <h3 className="text-sm font-semibold truncate">{ann.title}</h3>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0',
                      typeBadgeColors[ann.type],
                    )}
                  >
                    {t(ann.type.toLowerCase() as 'info' | 'warning' | 'critical')}
                  </span>
                </div>

                {/* Body */}
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {ann.body}
                </p>

                {/* Dates */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t('startsAt')}: {ann.startsAt ? fmtDate(ann.startsAt, locale) : '-'}
                  </span>
                  {ann.endsAt && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t('endsAt')}: {ann.endsAt ? fmtDate(ann.endsAt, locale) : '-'}
                    </span>
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between border-t pt-3">
                  {/* Active Toggle */}
                  <button
                    onClick={() => handleToggleActive(ann)}
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center gap-2 text-xs font-medium"
                  >
                    <span
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
                        ann.isActive ? 'bg-green-500' : 'bg-muted-foreground/30',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5',
                          ann.isActive ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5',
                        )}
                      />
                    </span>
                    <span className={cn(ann.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
                      {ann.isActive ? t('active') : t('inactive')}
                    </span>
                  </button>

                  {/* Edit / Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(ann)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title={t('edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    {deleteConfirmId === ann.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(ann.id)}
                          disabled={deleteMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2 py-1 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                        >
                          {deleteMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                          {tc('confirm')}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg px-2 py-1 text-[10px] font-medium border hover:bg-muted transition-colors"
                        >
                          {tc('cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(ann.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition-colors"
                        title={t('delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && (
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />
      )}
    </div>
  );
}
