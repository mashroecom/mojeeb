'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useAdminFiles,
  useAdminFileStats,
  useDeleteFile,
  useUploadFile,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  FolderOpen,
  Trash2,
  Search,
  Loader2,
  HardDrive,
  FileIcon,
  Image,
  FileText,
  Upload,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}


// typeOptions moved inside component to use translations

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileEntry {
  name: string;
  relativePath: string;
  size: number;
  mimeType: string;
  modifiedAt: string;
  isDirectory: boolean;
}

interface FileStats {
  totalFiles: number;
  totalSize: number;
  images: number;
  documents: number;
  other: number;
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function StatSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm animate-pulse">
      <div className="h-3 w-20 rounded bg-muted mb-3" />
      <div className="h-7 w-16 rounded bg-muted" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b last:border-b-0">
      <td className="px-4 py-3"><div className="h-3 w-40 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-7 w-16 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FilesPage() {
  const t = useTranslations('admin.files');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const typeOptions = [
    { value: '', label: t('allTypes') },
    { value: 'images', label: t('images') },
    { value: 'documents', label: t('documents') },
    { value: 'other', label: t('other') },
  ];

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deleteConfirmPath, setDeleteConfirmPath] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useAdminFiles({
    page,
    limit: 20,
    search: search || undefined,
    type: typeFilter || undefined,
  });
  const { data: stats, isLoading: statsLoading } = useAdminFileStats();
  const deleteMutation = useDeleteFile();
  const uploadMutation = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const files: FileEntry[] = data?.files ?? [];
  const totalPages = data?.totalPages ?? 1;
  const fileStats: FileStats | undefined = stats;

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  async function handleUpload(file: File) {
    try {
      await uploadMutation.mutateAsync(file);
      addToast('success', t('uploadSuccess'));
    } catch {
      addToast('error', t('uploadFailed'));
    }
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, []);

  async function handleDelete(path: string) {
    try {
      await deleteMutation.mutateAsync(path);
      addToast('success', t('toasts.deleted'));
      setDeleteConfirmPath(null);
    } catch {
      addToast('error', t('toasts.deleteFailed'));
    }
  }

  function getFileIcon(type: string) {
    if (type.startsWith('image')) return <Image className="h-4 w-4 text-blue-500" />;
    if (type.includes('pdf') || type.includes('document') || type.includes('text'))
      return <FileText className="h-4 w-4 text-orange-500" />;
    return <FileIcon className="h-4 w-4 text-muted-foreground" />;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t('upload')}
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'mb-6 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/20',
        )}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          {t('dragDrop')}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {t('maxSize')}
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        {statsLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileIcon className="h-4 w-4" />
                {t('totalFiles')}
              </div>
              <p className="text-2xl font-bold">{fileStats?.totalFiles ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <HardDrive className="h-4 w-4" />
                {t('totalSize')}
              </div>
              <p className="text-2xl font-bold">{formatBytes(fileStats?.totalSize ?? 0)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FolderOpen className="h-4 w-4" />
                {t('byType')}
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {fileStats && (
                  <>
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t('images')}: {fileStats.images ?? 0}
                    </span>
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t('documents')}: {fileStats.documents ?? 0}
                    </span>
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t('other')}: {fileStats.other ?? 0}
                    </span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search + Filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border bg-background ps-9 pe-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
          />
        </div>
        <button
          onClick={handleSearch}
          aria-label={t('searchPlaceholder')}
          className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Search className="h-4 w-4" />
        </button>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
        >
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('loadError')}</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('name')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('type')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('size')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('lastModified')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}

              {!isLoading && !isError && files.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noFiles')}</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                files.map((file) => (
                  <tr key={file.relativePath} className="border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getFileIcon(file.mimeType)}
                        <span className="text-sm font-medium truncate max-w-[300px]">
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{file.mimeType || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatBytes(file.size)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDateTime(file.modifiedAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      {!file.isDirectory && (
                        deleteConfirmPath === file.relativePath ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(file.relativePath)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2 py-1 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                            >
                              {deleteMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                              {tc('confirm')}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmPath(null)}
                              className="rounded-lg px-2 py-1 text-[10px] font-medium border hover:bg-muted transition-colors"
                            >
                              {tc('cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmPath(file.relativePath)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            {tc('delete')}
                          </button>
                        )
                      )}
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
    </div>
  );
}
