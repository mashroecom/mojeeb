'use client';

import React, { useEffect, useRef, useState, FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import {
  FileText,
  ArrowLeft,
  Loader2,
  Upload,
  Globe,
  ChevronDown,
  Pencil,
  Save,
  X as XIcon,
  Plus,
  Trash2,
  Clock,
  Calendar,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useKnowledgeBase,
  useUpdateKnowledgeBase,
  useAddDocument,
  useDeleteDocument,
  useReprocessDocument,
  useCrawlSchedule,
  useUpdateCrawlSchedule,
  useCrawlJobs,
  isCrawlJobActive,
  knowledgeBaseKeys,
  type CrawlFrequency,
  type CrawlJob,
} from '@/hooks/useKnowledgeBase';
import { useAuthStore } from '@/stores/authStore';
import { StatusBadge } from './StatusBadge';
import { ContentTypeBadge } from './ContentTypeBadge';
import { CrawlConfigForm } from './CrawlConfigForm';
import { CrawlJobsSection } from './CrawlJobsSection';
import { useCrawlErrorMessage } from './crawlErrors';
import { toast } from '@/hooks/useToast';

/**
 * A schedule time in the viewer's own time zone, with the zone spelled out
 * (e.g. "Nov 12, 2026, 02:00 AM GMT+2") — the schedule itself runs in UTC.
 */
function fmtDateTimeWithZone(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

interface KBDetailViewProps {
  kbId: string;
  onBack: () => void;
}

export function KBDetailView({ kbId, onBack }: KBDetailViewProps) {
  const t = useTranslations('dashboard.knowledgeBase');
  const tc = useTranslations('common');
  const locale = useLocale();

  const tJobs = useTranslations('dashboard.knowledgeBase.crawlJobs');
  const tSync = useTranslations('dashboard.knowledgeBase.autoSync');
  const crawlError = useCrawlErrorMessage();
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  // Website crawls: the list polls while one is queued or running, and so does
  // the knowledge base itself so imported pages appear in the documents table.
  const { data: crawlJobs, isError: crawlJobsError } = useCrawlJobs(kbId);
  const crawlActive = crawlJobs?.some(isCrawlJobActive) ?? false;

  const { data: kb, isLoading } = useKnowledgeBase(kbId, { crawlActive });
  const { data: schedule, isLoading: scheduleLoading } = useCrawlSchedule(kbId);
  const updateScheduleMutation = useUpdateCrawlSchedule();

  // When a crawl we saw running reaches its end: load the final documents and
  // sync info once more, and tell the user how it went.
  const seenActiveJobs = useRef<Map<string, CrawlJob['status']>>(new Map());
  useEffect(() => {
    if (!crawlJobs || !orgId) return;
    const seen = seenActiveJobs.current;
    let finished = false;
    for (const job of crawlJobs) {
      if (isCrawlJobActive(job)) {
        seen.set(job.id, job.status);
      } else if (seen.has(job.id)) {
        seen.delete(job.id);
        finished = true;
        if (job.status === 'COMPLETED') {
          toast.success(tJobs('finishedToast', { count: job.pagesCrawled }));
        } else if (job.status === 'FAILED') {
          toast.error(crawlError.fromJobError(job.errorMessage, tJobs('failedToast')));
        }
      }
    }
    if (finished) {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.detail(orgId, kbId) });
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.schedule(orgId, kbId) });
    }
    // Deliberately keyed on the job data only: translators change identity per render
  }, [crawlJobs, orgId, kbId, queryClient]);

  // Edit KB state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const updateKbMutation = useUpdateKnowledgeBase();

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<CrawlFrequency>('WEEKLY');

  // Add document form state
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docContentType, setDocContentType] = useState<'TEXT' | 'FAQ' | 'PDF' | 'URL'>('TEXT');
  const [docSourceUrl, setDocSourceUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    PENDING: t('statusPending'),
    PROCESSING: t('statusProcessing'),
    COMPLETED: t('statusCompleted'),
    FAILED: t('statusFailed'),
  };
  const contentTypeLabels: Record<string, string> = {
    TEXT: t('contentTypeText'),
    FAQ: t('contentTypeFaq'),
    PDF: t('contentTypePdf'),
    URL: t('contentTypeUrl'),
  };

  const addDocMutation = useAddDocument();
  const deleteDocMutation = useDeleteDocument();
  const reprocessDocMutation = useReprocessDocument();

  // Sync schedule state with fetched data
  React.useEffect(() => {
    if (schedule) {
      setScheduleEnabled(schedule.scheduleEnabled);
      if (schedule.scheduleFrequency) {
        setScheduleFrequency(schedule.scheduleFrequency);
      }
    }
  }, [schedule]);

  function startEditing() {
    if (!kb) return;
    setEditName(kb.name);
    setEditDescription(kb.description || '');
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditName('');
    setEditDescription('');
  }

  function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    updateKbMutation.mutate(
      { kbId, name: editName.trim(), description: editDescription.trim() || undefined },
      { onSuccess: () => setIsEditing(false) },
    );
  }

  function handleAddDocument(e: FormEvent) {
    e.preventDefault();
    if (!docTitle.trim()) return;

    if (docContentType === 'PDF') {
      if (!pdfFile) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        addDocMutation.mutate(
          {
            kbId,
            title: docTitle.trim(),
            contentType: 'PDF',
            fileBase64: base64,
          },
          { onSuccess: resetForm },
        );
      };
      reader.readAsDataURL(pdfFile);
      return;
    }

    if (docContentType === 'URL') {
      if (!docSourceUrl.trim()) return;
      addDocMutation.mutate(
        {
          kbId,
          title: docTitle.trim(),
          contentType: 'URL',
          sourceUrl: docSourceUrl.trim(),
        },
        { onSuccess: resetForm },
      );
      return;
    }

    if (!docContent.trim()) return;
    addDocMutation.mutate(
      {
        kbId,
        title: docTitle.trim(),
        content: docContent.trim(),
        contentType: docContentType,
        sourceUrl: docSourceUrl.trim() || undefined,
      },
      { onSuccess: resetForm },
    );
  }

  function resetForm() {
    setDocTitle('');
    setDocContent('');
    setDocContentType('TEXT');
    setDocSourceUrl('');
    setPdfFile(null);
    setShowAddDocForm(false);
  }

  function handleDeleteDocument(docId: string) {
    deleteDocMutation.mutate({ kbId, docId }, { onSuccess: () => setConfirmDeleteDocId(null) });
  }

  function handleScheduleToggle(enabled: boolean) {
    setScheduleEnabled(enabled);
    updateScheduleMutation.mutate(
      {
        kbId,
        enabled,
        frequency: enabled ? scheduleFrequency : undefined,
      },
      {
        onSuccess: () => {
          toast.success(enabled ? t('autoSyncEnabled') : t('autoSyncDisabled'));
        },
        onError: (error: unknown) => {
          setScheduleEnabled(!enabled); // Revert on error
          toast.error(crawlError.fromApiError(error, t('scheduleUpdateFailed')));
        },
      },
    );
  }

  function handleFrequencyChange(frequency: CrawlFrequency) {
    if (frequency === scheduleFrequency) return;
    const previous = scheduleFrequency;
    setScheduleFrequency(frequency);
    if (scheduleEnabled) {
      updateScheduleMutation.mutate(
        {
          kbId,
          enabled: true,
          frequency,
        },
        {
          onSuccess: () => {
            toast.success(t('frequencyUpdated'));
          },
          onError: (error: unknown) => {
            setScheduleFrequency(previous); // Revert on error
            toast.error(crawlError.fromApiError(error, t('frequencyUpdateFailed')));
          },
        },
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
        <p className="text-muted-foreground">{tc('error')}</p>
        <button
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc('back')}
        </button>
      </div>
    );
  }

  const documents = kb.documents ?? [];
  // Auto-sync repeats the latest website crawl, so there has to be one
  const canEnableAutoSync = !!schedule?.startUrl;

  return (
    <div>
      {/* Back button + header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {tc('back')}
        </button>

        {isEditing ? (
          <form
            onSubmit={handleSaveEdit}
            className="rounded-xl border bg-card p-4 shadow-sm space-y-3"
          >
            <div>
              <label htmlFor="edit-kb-name" className="block text-sm font-medium mb-1">
                {t('name')} <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-kb-name"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="edit-kb-desc" className="block text-sm font-medium mb-1">
                {t('description')}
              </label>
              <input
                id="edit-kb-desc"
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={updateKbMutation.isPending || !editName.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {updateKbMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {tc('save')}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" />
                {tc('cancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{kb.name}</h1>
                <button
                  onClick={startEditing}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={tc('edit')}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {kb.description && <p className="text-muted-foreground mt-1">{kb.description}</p>}
            </div>
            {!showAddDocForm && (
              <button
                onClick={() => setShowAddDocForm(true)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t('addDocument')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Auto-Sync Schedule Configuration */}
      <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm" data-testid="auto-sync">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('autoSyncSchedule')}</h2>
          </div>
          {scheduleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={scheduleEnabled}
              aria-label={tSync('toggleLabel')}
              aria-describedby={canEnableAutoSync ? undefined : 'auto-sync-hint'}
              onClick={() => handleScheduleToggle(!scheduleEnabled)}
              disabled={
                updateScheduleMutation.isPending || (!scheduleEnabled && !canEnableAutoSync)
              }
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                scheduleEnabled ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                  scheduleEnabled
                    ? 'translate-x-6 rtl:-translate-x-6'
                    : 'translate-x-1 rtl:-translate-x-1',
                )}
              />
            </button>
          )}
        </div>

        {scheduleEnabled && (
          <div className="space-y-4">
            {/* What gets re-crawled */}
            {schedule?.startUrl && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{tSync('site')}</p>
                <p className="text-sm truncate text-start" dir="ltr" title={schedule.startUrl}>
                  <bdi>{schedule.startUrl}</bdi>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {schedule.urlPattern
                    ? tSync('settingsWithFilter', {
                        depth: schedule.maxDepth,
                        filter: schedule.urlPattern,
                      })
                    : tSync('settings', { depth: schedule.maxDepth })}
                </p>
              </div>
            )}

            {/* Frequency Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <Calendar className="inline-block h-4 w-4 mr-1.5 rtl:mr-0 rtl:ml-1.5 -mt-0.5" />
                {t('crawlFrequency')}
              </label>
              <div className="flex flex-wrap gap-2">
                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    aria-pressed={scheduleFrequency === freq}
                    onClick={() => handleFrequencyChange(freq)}
                    disabled={updateScheduleMutation.isPending}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-medium transition-colors border disabled:opacity-50',
                      scheduleFrequency === freq
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:bg-muted border-border',
                    )}
                  >
                    {t(freq.toLowerCase() as 'daily' | 'weekly' | 'monthly')}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2" data-testid="auto-sync-rule">
                {tSync(`runs${scheduleFrequency}`)}
              </p>
            </div>

            {/* Schedule Info */}
            {schedule && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {tSync('lastSync')}
                  </p>
                  <p className="text-sm" data-testid="auto-sync-last">
                    {schedule.lastCrawledAt
                      ? fmtDateTimeWithZone(schedule.lastCrawledAt, locale)
                      : tSync('never')}
                  </p>
                </div>
                {schedule.nextCrawlAt && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {tSync('nextSync')}
                    </p>
                    <p className="text-sm" data-testid="auto-sync-next">
                      <time dateTime={schedule.nextCrawlAt}>
                        {fmtDateTimeWithZone(schedule.nextCrawlAt, locale)}
                      </time>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!scheduleEnabled && (
          <p id="auto-sync-hint" className="text-sm text-muted-foreground">
            {scheduleLoading || canEnableAutoSync ? t('enableAutoSyncHint') : tSync('noSiteHint')}
          </p>
        )}
      </div>

      {/* Add document form / URL crawl config */}
      {showAddDocForm && docContentType === 'URL' ? (
        <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t('crawlConfigTitle')}</h2>
            <button
              type="button"
              onClick={() => setDocContentType('TEXT')}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t('backToDocumentTypes')}
            </button>
          </div>
          <CrawlConfigForm kbId={kbId} onSuccess={resetForm} onCancel={resetForm} />
        </div>
      ) : (
        showAddDocForm && (
          <form
            onSubmit={handleAddDocument}
            className="mb-6 rounded-xl border bg-card p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold mb-4">{t('addDocument')}</h2>

            <div className="space-y-4">
              {/* Content Type Selector */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('contentType')}</label>
                <div className="flex flex-wrap gap-2">
                  {(['TEXT', 'FAQ', 'PDF', 'URL'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDocContentType(type)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors border',
                        docContentType === type
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground hover:bg-muted border-border',
                      )}
                    >
                      {type === 'PDF' && <Upload className="h-3.5 w-3.5" />}
                      {type === 'URL' && <Globe className="h-3.5 w-3.5" />}
                      {type === 'TEXT' && <FileText className="h-3.5 w-3.5" />}
                      {type === 'FAQ' && <FileText className="h-3.5 w-3.5" />}
                      {t(`contentType${type[0]}${type.slice(1).toLowerCase()}` as any)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label htmlFor="doc-title" className="block text-sm font-medium mb-1">
                  {t('documentTitle')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="doc-title"
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder={t('documentTitlePlaceholder')}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* PDF Upload */}
              {docContentType === 'PDF' && (
                <div>
                  <label htmlFor="doc-pdf" className="block text-sm font-medium mb-1">
                    {t('pdfFile')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="doc-pdf"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
                    />
                  </div>
                  {pdfFile && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pdfFile.name} ({(pdfFile.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                </div>
              )}

              {/* Text Content (TEXT and FAQ only) */}
              {(docContentType === 'TEXT' || docContentType === 'FAQ') && (
                <div>
                  <label htmlFor="doc-content" className="block text-sm font-medium mb-1">
                    {t('documentContent')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="doc-content"
                    required
                    rows={6}
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    placeholder={t('documentContentPlaceholder')}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                type="submit"
                disabled={addDocMutation.isPending || !docTitle.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addDocMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('addDocument')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                {tc('cancel')}
              </button>
            </div>
          </form>
        )
      )}

      {/* Website crawls: live progress and recent history */}
      <CrawlJobsSection kbId={kbId} jobs={crawlJobs} isError={crawlJobsError} />

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t('noDocuments')}</p>
        </div>
      )}

      {/* Documents table */}
      {documents.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-start px-4 py-3 font-medium">{t('documentTitle')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('contentType')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('status')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('chunks')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('date')}</th>
                  <th className="text-end px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const isExpanded = expandedDocId === doc.id;
                  return (
                    <React.Fragment key={doc.id}>
                      <tr
                        className={cn(
                          'hover:bg-muted/30 transition-colors cursor-pointer',
                          isExpanded ? 'bg-muted/20' : 'border-b last:border-b-0',
                        )}
                        onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                      >
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform',
                                isExpanded && 'rotate-180',
                              )}
                            />
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[200px]">{doc.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ContentTypeBadge
                            type={doc.contentType}
                            label={contentTypeLabels[doc.contentType] || doc.contentType}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={doc.embeddingStatus}
                            label={statusLabels[doc.embeddingStatus] || doc.embeddingStatus}
                          />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{doc.chunkCount ?? 0}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {fmtDate(doc.createdAt, locale)}
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {confirmDeleteDocId === doc.id ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  disabled={deleteDocMutation.isPending}
                                  className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                                >
                                  {deleteDocMutation.isPending && (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  )}
                                  {tc('confirm')}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteDocId(null)}
                                  className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
                                >
                                  {tc('cancel')}
                                </button>
                              </div>
                            ) : (
                              <>
                                {doc.embeddingStatus === 'FAILED' && (
                                  <button
                                    onClick={() =>
                                      reprocessDocMutation.mutate(
                                        { kbId, docId: doc.id },
                                        { onError: () => toast.error(t('retryProcessingFailed')) },
                                      )
                                    }
                                    disabled={reprocessDocMutation.isPending}
                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
                                    aria-label={t('retryProcessing')}
                                    title={t('retryProcessing')}
                                  >
                                    <RotateCw
                                      className={cn(
                                        'h-4 w-4',
                                        reprocessDocMutation.isPending &&
                                          reprocessDocMutation.variables?.docId === doc.id &&
                                          'animate-spin',
                                      )}
                                    />
                                  </button>
                                )}
                                <button
                                  onClick={() => setConfirmDeleteDocId(doc.id)}
                                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                  aria-label={tc('delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b">
                          <td colSpan={6} className="p-0">
                            <div className="bg-muted/10 px-4 py-4 border-t">
                              {doc.sourceUrl && (
                                <div className="mb-3">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {t('source')}:
                                  </span>{' '}
                                  <a
                                    href={doc.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                    dir="ltr"
                                  >
                                    {doc.sourceUrl}
                                  </a>
                                </div>
                              )}
                              <div className="rounded-lg border bg-background p-4 max-h-80 overflow-y-auto">
                                <pre className="text-sm whitespace-pre-wrap break-words text-foreground">
                                  {doc.content || t('noContent')}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
