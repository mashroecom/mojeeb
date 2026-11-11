'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { fmtDateTime } from '@/lib/dateFormat';
import { useAdminLegalContent, useUpdateLegalContent } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { Shield, Scale, Save, Loader2, ExternalLink, Info, RotateCcw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LegalType = 'privacy-policy' | 'terms';

interface LegalContent {
  id: string;
  contentEn: string;
  contentAr: string;
  updatedAt: string | null;
}

interface Draft {
  contentEn: string;
  contentAr: string;
}

const TABS: {
  type: LegalType;
  labelKey: 'privacyPolicy' | 'termsOfService';
  icon: typeof Shield;
  publicHref: string;
}[] = [
  { type: 'privacy-policy', labelKey: 'privacyPolicy', icon: Shield, publicHref: '/privacy' },
  { type: 'terms', labelKey: 'termsOfService', icon: Scale, publicHref: '/terms' },
];

const textareaCls =
  'w-full min-h-[420px] rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors resize-y';

// ---------------------------------------------------------------------------
// Editor (one legal document)
// ---------------------------------------------------------------------------

function LegalEditor({
  type,
  publicHref,
  draft,
  onDraftChange,
}: {
  type: LegalType;
  publicHref: string;
  draft: Draft | undefined;
  onDraftChange: (draft: Draft | undefined) => void;
}) {
  const t = useTranslations('admin.legal');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const { data, isLoading, isError, refetch } = useAdminLegalContent(type);
  const updateMutation = useUpdateLegalContent(type);

  const saved = data as LegalContent | undefined;
  const savedEn = saved?.contentEn ?? '';
  const savedAr = saved?.contentAr ?? '';
  const contentEn = draft?.contentEn ?? savedEn;
  const contentAr = draft?.contentAr ?? savedAr;
  const isDirty = !!draft && (draft.contentEn !== savedEn || draft.contentAr !== savedAr);

  function handleChange(field: keyof Draft, value: string) {
    const next: Draft = { contentEn, contentAr, [field]: value };
    // Typing the text back to what is saved clears the draft again
    onDraftChange(next.contentEn === savedEn && next.contentAr === savedAr ? undefined : next);
  }

  function handleSave() {
    updateMutation.mutate(
      { contentEn, contentAr },
      {
        onSuccess: () => {
          addToast('success', t('saved'));
          onDraftChange(undefined);
        },
        onError: () => addToast('error', t('failedSave')),
      },
    );
  }

  if (isError) {
    return (
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
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
        <div className="h-4 w-56 rounded bg-muted mb-5" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-[420px] rounded-lg bg-muted" />
          <div className="h-[420px] rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      {/* Status row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {saved?.updatedAt ? (
            <span data-testid="legal-last-updated">
              {t('lastUpdated')}: {fmtDateTime(saved.updatedAt, locale)}
            </span>
          ) : (
            <span>{t('notSavedYet')}</span>
          )}
          {isDirty && <AdminBadge variant="warning">{t('unsavedChanges')}</AdminBadge>}
        </div>
        <Link
          href={publicHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t('viewPublicPage')}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hints */}
      <div className="flex items-start gap-2 rounded-lg border bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p>{t('markdownHint')}</p>
          <p>{t('emptyFallbackHint')}</p>
        </div>
      </div>

      {/* Editors */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor={`legal-${type}-en`} className="text-sm font-medium">
              {t('contentEnglish')}
            </label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t('characters', { count: contentEn.length })}
            </span>
          </div>
          <textarea
            id={`legal-${type}-en`}
            dir="ltr"
            lang="en"
            spellCheck
            value={contentEn}
            onChange={(e) => handleChange('contentEn', e.target.value)}
            className={textareaCls}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor={`legal-${type}-ar`} className="text-sm font-medium">
              {t('contentArabic')}
            </label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t('characters', { count: contentAr.length })}
            </span>
          </div>
          <textarea
            id={`legal-${type}-ar`}
            dir="rtl"
            lang="ar"
            value={contentAr}
            onChange={(e) => handleChange('contentAr', e.target.value)}
            className={textareaCls}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onDraftChange(undefined)}
          disabled={!isDirty || updateMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <RotateCcw className="h-4 w-4" />
          {t('discard')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {tc('save')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminLegalPage() {
  const t = useTranslations('admin.legal');

  const [activeType, setActiveType] = useState<LegalType>('privacy-policy');
  // Unsaved edits are kept per document so switching tabs never loses work
  const [drafts, setDrafts] = useState<Partial<Record<LegalType, Draft>>>({});

  const hasDrafts = Object.values(drafts).some(Boolean);

  // Warn before leaving the page with unsaved edits
  useEffect(() => {
    if (!hasDrafts) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDrafts]);

  const activeTab = TABS.find((tab) => tab.type === activeType) ?? TABS[0];

  return (
    <div>
      <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Tabs */}
      <div className="mb-4 flex w-fit gap-1 rounded-lg border bg-muted/50 p-1" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.type === activeType;
          return (
            <button
              key={tab.type}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`legal-tab-${tab.type}`}
              onClick={() => setActiveType(tab.type)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(tab.labelKey)}
              {drafts[tab.type] && (
                <span
                  className="h-2 w-2 rounded-full bg-yellow-500"
                  title={t('unsavedChanges')}
                  aria-label={t('unsavedChanges')}
                />
              )}
            </button>
          );
        })}
      </div>

      <LegalEditor
        key={activeTab.type}
        type={activeTab.type}
        publicHref={activeTab.publicHref}
        draft={drafts[activeTab.type]}
        onDraftChange={(draft) => setDrafts((prev) => ({ ...prev, [activeTab.type]: draft }))}
      />
    </div>
  );
}
