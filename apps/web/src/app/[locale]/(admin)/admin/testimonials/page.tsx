'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  useAdminTestimonials,
  useCreateTestimonial,
  useUpdateTestimonial,
  useDeleteTestimonial,
  useReorderTestimonials,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminModal } from '@/components/admin/AdminModal';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { Quote, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, Star } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Testimonial {
  id: string;
  name: string;
  nameAr: string;
  role: string;
  roleAr: string;
  content: string;
  contentAr: string;
  photoUrl: string | null;
  company: string | null;
  rating: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  nameAr: string;
  role: string;
  roleAr: string;
  content: string;
  contentAr: string;
  photoUrl: string;
  company: string;
  rating: number;
  isActive: boolean;
}

const emptyForm: FormData = {
  name: '',
  nameAr: '',
  role: '',
  roleAr: '',
  content: '',
  contentAr: '',
  photoUrl: '',
  company: '',
  rating: 5,
  isActive: true,
};

const RATINGS = [1, 2, 3, 4, 5];

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors';

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-green-500' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5',
          checked ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );
}

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label} title={label}>
      {RATINGS.map((n) => (
        <Star
          key={n}
          className={cn(
            'h-3.5 w-3.5',
            n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}

function Avatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {photoUrl && !failed ? (
        <img
          src={photoUrl}
          alt={name}
          className="h-11 w-11 object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initial || <Quote className="h-4 w-4" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminTestimonialsPage() {
  const t = useTranslations('admin.testimonials');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const addToast = useToastStore((s) => s.addToast);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useAdminTestimonials();
  const createMutation = useCreateTestimonial();
  const updateMutation = useUpdateTestimonial();
  const deleteMutation = useDeleteTestimonial();
  const reorderMutation = useReorderTestimonials();

  const testimonials: Testimonial[] = Array.isArray(data) ? data : [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // --- Handlers ---

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(item: Testimonial) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      nameAr: item.nameAr,
      role: item.role,
      roleAr: item.roleAr,
      content: item.content,
      contentAr: item.contentAr,
      photoUrl: item.photoUrl ?? '',
      company: item.company ?? '',
      rating: item.rating,
      isActive: item.isActive,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const photoUrl = form.photoUrl.trim();
    if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
      addToast('error', t('photoUrlInvalid'));
      return;
    }

    const payload = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim(),
      role: form.role.trim(),
      roleAr: form.roleAr.trim(),
      content: form.content.trim(),
      contentAr: form.contentAr.trim(),
      photoUrl: photoUrl || null,
      company: form.company.trim() || null,
      rating: form.rating,
      isActive: form.isActive,
    };

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, ...payload },
        {
          onSuccess: () => {
            addToast('success', t('updated'));
            closeForm();
          },
          onError: () => addToast('error', tc('failedUpdate')),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          addToast('success', t('created'));
          closeForm();
        },
        onError: () => addToast('error', tc('failedCreate')),
      });
    }
  }

  function handleToggleActive(item: Testimonial) {
    updateMutation.mutate(
      { id: item.id, isActive: !item.isActive },
      { onError: () => addToast('error', tc('failedToggle')) },
    );
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= testimonials.length) return;
    const ids = testimonials.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids, { onError: () => addToast('error', tc('failedReorder')) });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        addToast('success', t('deleted'));
        setDeleteTarget(null);
      },
      onError: () => addToast('error', tc('failedDelete')),
    });
  }

  // --- Render ---

  const addButton = (
    <button
      type="button"
      onClick={openCreate}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <Plus className="h-4 w-4" />
      {t('addNew')}
    </button>
  );

  return (
    <>
      <div>
        <AdminPageHeader title={t('title')} subtitle={t('subtitle')} actions={addButton} />

        {/* Error State */}
        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('failedLoad')}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
            >
              {tc('retry')}
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded bg-muted" />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && testimonials.length === 0 && (
          <div className="rounded-xl border bg-card shadow-sm">
            <AdminEmptyState icon={Quote} message={t('noTestimonials')} action={addButton} />
          </div>
        )}

        {/* Testimonials List */}
        {!isLoading && !isError && testimonials.length > 0 && (
          <ul className="rounded-xl border bg-card shadow-sm divide-y overflow-hidden">
            {testimonials.map((item, index) => {
              const name = isAr ? item.nameAr || item.name : item.name;
              const role = isAr ? item.roleAr || item.role : item.role;
              const content = isAr ? item.contentAr || item.content : item.content;
              const otherName = isAr ? item.name : item.nameAr;
              const byline = [role, item.company].filter(Boolean).join(' · ');
              const missingArabic =
                !item.nameAr || !item.contentAr || (!!item.role && !item.roleAr);

              return (
                <li
                  key={item.id}
                  data-testid="testimonial-row"
                  className={cn(
                    'flex items-start gap-3 p-4 transition-colors hover:bg-muted/40',
                    !item.isActive && 'bg-muted/20',
                  )}
                >
                  {/* Reorder */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0 || reorderMutation.isPending}
                      title={t('moveUp')}
                      aria-label={t('moveUp')}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === testimonials.length - 1 || reorderMutation.isPending}
                      title={t('moveDown')}
                      aria-label={t('moveDown')}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className={cn('flex min-w-0 flex-1 gap-3', !item.isActive && 'opacity-60')}>
                    <Avatar photoUrl={item.photoUrl} name={name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-sm font-semibold break-words">
                          <bdi>{name}</bdi>
                        </h3>
                        {otherName && otherName !== name && (
                          <bdi className="text-xs text-muted-foreground">{otherName}</bdi>
                        )}
                        <AdminBadge variant={item.isActive ? 'success' : 'default'}>
                          {item.isActive ? t('active') : t('inactive')}
                        </AdminBadge>
                        {missingArabic && (
                          <AdminBadge variant="warning">{t('noArabic')}</AdminBadge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {byline && (
                          <bdi className="text-xs text-muted-foreground break-words">{byline}</bdi>
                        )}
                        <Stars
                          rating={item.rating}
                          label={t('ratingValue', { count: item.rating })}
                        />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2 break-words">
                        <bdi>{content}</bdi>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Toggle
                      checked={item.isActive}
                      onChange={() => handleToggleActive(item)}
                      disabled={updateMutation.isPending}
                      label={item.isActive ? t('deactivate') : t('activate')}
                    />
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      title={t('edit')}
                      aria-label={t('edit')}
                      className="ms-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item.id)}
                      title={t('delete')}
                      aria-label={t('delete')}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create / Edit Modal */}
      <AdminModal
        open={showForm}
        onClose={closeForm}
        title={editingId ? t('editTestimonial') : t('addNew')}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="testimonial-name" className="block text-sm font-medium mb-1">
                {t('name')}
              </label>
              <input
                id="testimonial-name"
                type="text"
                dir="ltr"
                required
                maxLength={200}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="testimonial-name-ar" className="block text-sm font-medium mb-1">
                {t('nameAr')}
              </label>
              <input
                id="testimonial-name-ar"
                type="text"
                dir="rtl"
                maxLength={200}
                value={form.nameAr}
                onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="testimonial-role" className="block text-sm font-medium mb-1">
                {t('role')}
              </label>
              <input
                id="testimonial-role"
                type="text"
                dir="ltr"
                maxLength={200}
                placeholder={t('rolePlaceholder')}
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="testimonial-role-ar" className="block text-sm font-medium mb-1">
                {t('roleAr')}
              </label>
              <input
                id="testimonial-role-ar"
                type="text"
                dir="rtl"
                maxLength={200}
                value={form.roleAr}
                onChange={(e) => setForm((f) => ({ ...f, roleAr: e.target.value }))}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="testimonial-company" className="block text-sm font-medium mb-1">
                {t('company')}
              </label>
              <input
                id="testimonial-company"
                type="text"
                dir="auto"
                maxLength={200}
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <span className="block text-sm font-medium mb-1">{t('rating')}</span>
              <div
                className="flex h-[38px] items-center gap-1"
                role="radiogroup"
                aria-label={t('rating')}
              >
                {RATINGS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={t('ratingValue', { count: n })}
                    title={t('ratingValue', { count: n })}
                    data-testid={`rating-${n}`}
                    onClick={() => setForm((f) => ({ ...f, rating: n }))}
                    className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <Star
                      className={cn(
                        'h-6 w-6',
                        n <= form.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground/30',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="testimonial-photo" className="block text-sm font-medium mb-1">
              {t('photoUrl')}
            </label>
            <input
              id="testimonial-photo"
              type="text"
              inputMode="url"
              dir="ltr"
              maxLength={2000}
              placeholder="https://"
              value={form.photoUrl}
              onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('photoUrlHelp')}</p>
          </div>

          <div>
            <label htmlFor="testimonial-content" className="block text-sm font-medium mb-1">
              {t('content')}
            </label>
            <textarea
              id="testimonial-content"
              dir="ltr"
              required
              rows={3}
              maxLength={5000}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className={cn(inputCls, 'resize-y')}
            />
          </div>

          <div>
            <label htmlFor="testimonial-content-ar" className="block text-sm font-medium mb-1">
              {t('contentAr')}
            </label>
            <textarea
              id="testimonial-content-ar"
              dir="rtl"
              rows={3}
              maxLength={5000}
              value={form.contentAr}
              onChange={(e) => setForm((f) => ({ ...f, contentAr: e.target.value }))}
              className={cn(inputCls, 'resize-y')}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium">{form.isActive ? t('active') : t('inactive')}</p>
              <p className="text-xs text-muted-foreground">{t('activeHint')}</p>
            </div>
            <Toggle
              checked={form.isActive}
              onChange={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              label={form.isActive ? t('deactivate') : t('activate')}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {tc('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Delete Confirm Dialog */}
      <AdminConfirmDialog
        open={!!deleteTarget}
        title={t('deleteTitle')}
        message={t('confirmDelete')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
