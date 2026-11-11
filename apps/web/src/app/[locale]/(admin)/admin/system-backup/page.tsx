'use client';

import { useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  Download,
  Upload,
  FileJson,
  Loader2,
  ShieldCheck,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useExportConfig, useImportConfig } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminPageHeader, AdminConfirmDialog, AdminDataTable } from '@/components/admin';
import { fmtDateTime } from '@/lib/dateFormat';
import { fmtNumber } from '@/lib/adminFormat';
import { cn } from '@/lib/utils';

const BACKUP_FORMAT = 'mojeeb.system-config';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const SECTIONS = [
  'systemConfigs',
  'planConfigs',
  'featureFlags',
  'siteSettings',
  'emailTemplates',
  'landingPageContent',
  'faqs',
  'testimonials',
  'legalContents',
] as const;
type SectionName = (typeof SECTIONS)[number];

interface BackupFile {
  format: string;
  version: number;
  exportedAt: string;
  checksum: string;
  data: Partial<Record<SectionName, unknown>>;
}

interface SectionResult {
  created: number;
  updated: number;
  skipped: number;
}

type ImportResult = Record<SectionName, SectionResult> & { skippedSecretKeys: string[] };

interface SelectedFile {
  name: string;
  backup: BackupFile;
}

type FileError = 'invalidJson' | 'invalidFile' | 'fileTooLarge';

function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.format === BACKUP_FORMAT &&
    typeof candidate.exportedAt === 'string' &&
    typeof candidate.checksum === 'string' &&
    !!candidate.data &&
    typeof candidate.data === 'object' &&
    !Array.isArray(candidate.data)
  );
}

/** Number of entries a section holds in a backup; null when the section is absent */
function sectionCount(backup: BackupFile, section: SectionName): number | null {
  const value = backup.data[section];
  if (value === undefined || value === null) return null;
  return Array.isArray(value) ? value.length : 1;
}

export default function AdminSystemBackupPage() {
  const t = useTranslations('admin.systemBackup');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const exportMutation = useExportConfig();
  const importMutation = useImportConfig();

  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [fileError, setFileError] = useState<FileError | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleExport() {
    exportMutation.mutate(undefined, {
      onSuccess: (backup: BackupFile) => {
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mojeeb-config-backup-${backup.exportedAt.slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        addToast('success', t('exportSuccess'));
      },
      onError: () => addToast('error', t('exportError')),
    });
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setSelected(null);
    if (file.size > MAX_FILE_BYTES) {
      setFileError('fileTooLarge');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setFileError('invalidJson');
      return;
    }
    if (!isBackupFile(parsed)) {
      setFileError('invalidFile');
      return;
    }
    setFileError(null);
    setSelected({ name: file.name, backup: parsed });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.target.files?.[0]);
    // Allow re-selecting the same file after it was removed
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    void loadFile(event.dataTransfer.files?.[0]);
  }

  function clearFile() {
    setSelected(null);
    setFileError(null);
  }

  function handleImport() {
    if (!selected) return;
    importMutation.mutate(selected.backup as unknown as Record<string, unknown>, {
      onSuccess: (data: ImportResult) => {
        setResult(data);
        setSelected(null);
        setConfirmOpen(false);
        addToast('success', t('importSuccess'));
      },
      onError: (error: unknown) => {
        setConfirmOpen(false);
        const code = isAxiosError(error) ? error.response?.data?.code : undefined;
        if (code === 'CHECKSUM_MISMATCH') addToast('error', t('checksumError'));
        else if (code === 'VALIDATION_ERROR') addToast('error', t('validationError'));
        else addToast('error', t('importError'));
      },
    });
  }

  const resultRows = result
    ? SECTIONS.map((section) => ({ section, ...result[section] })).filter(
        (row) => row.created + row.updated + row.skipped > 0,
      )
    : [];

  return (
    <div>
      <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Warning */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-yellow-900 dark:border-yellow-900/60 dark:bg-yellow-900/20 dark:text-yellow-200">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-sm">
          <p className="font-medium">{t('warning')}</p>
          <p>{t('mergeNote')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Export */}
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Download className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t('exportConfig')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t('exportDescription')}</p>

          <p className="text-sm font-medium mb-2">{t('includedSections')}</p>
          <ul className="mb-4 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <li key={section} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                {t(`section_${section}`)}
              </li>
            ))}
          </ul>

          <p className="mb-5 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span>{t('secretsNote')}</span>
          </p>

          <button
            type="button"
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {exportMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportMutation.isPending ? t('exporting') : t('exportConfig')}
          </button>
        </section>

        {/* Import */}
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t('importConfig')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t('importDescription')}</p>

          <input
            id="backup-file"
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="sr-only"
          />

          {!selected ? (
            <label
              htmlFor="backup-file"
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors',
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/60 hover:bg-muted/40',
              )}
            >
              <FileJson className="h-10 w-10 text-muted-foreground/60" />
              <span className="text-sm text-muted-foreground">{t('selectFile')}</span>
            </label>
          ) : (
            <div className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex min-w-0 items-start gap-3">
                  <FileJson className="h-8 w-8 flex-shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t('selectedFile')}</p>
                    <p className="truncate text-sm font-medium" dir="ltr">
                      {selected.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('exportedAt', { date: fmtDateTime(selected.backup.exportedAt, locale) })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  aria-label={t('removeFile')}
                  title={t('removeFile')}
                  className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ul className="mb-4 divide-y text-sm">
                {SECTIONS.map((section) => {
                  const count = sectionCount(selected.backup, section);
                  return (
                    <li key={section} className="flex items-center justify-between gap-3 py-1.5">
                      <span>{t(`section_${section}`)}</span>
                      <span className="text-muted-foreground">
                        {count === null ? t('notIncluded') : t('entries', { count })}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={importMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {importMutation.isPending ? t('importing') : t('importConfig')}
              </button>
            </div>
          )}

          {fileError && (
            <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {t(fileError)}
            </p>
          )}
        </section>
      </div>

      {/* Import results */}
      {result && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">{t('lastImport')}</h2>
          <AdminDataTable
            data={resultRows}
            rowKey={(row) => row.section}
            emptyMessage={tc('noData')}
            columns={[
              {
                key: 'section',
                header: t('section'),
                render: (row) => (
                  <span className="text-sm font-medium">{t(`section_${row.section}`)}</span>
                ),
              },
              {
                key: 'created',
                header: t('created'),
                render: (row) => <span className="text-sm">{fmtNumber(row.created, locale)}</span>,
              },
              {
                key: 'updated',
                header: t('updated'),
                render: (row) => <span className="text-sm">{fmtNumber(row.updated, locale)}</span>,
              },
              {
                key: 'skipped',
                header: t('skipped'),
                render: (row) => (
                  <span className="text-sm text-muted-foreground">
                    {fmtNumber(row.skipped, locale)}
                  </span>
                ),
              },
            ]}
          />
          {result.skippedSecretKeys.length > 0 && (
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              {t('secretsSkipped', { count: result.skippedSecretKeys.length })}
            </p>
          )}
        </div>
      )}

      <AdminConfirmDialog
        open={confirmOpen}
        title={t('confirmTitle')}
        message={t('overwriteWarning')}
        confirmLabel={t('confirm')}
        variant="danger"
        loading={importMutation.isPending}
        onConfirm={handleImport}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
