'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { fmtDate } from '@/lib/dateFormat';
import {
  useLeads,
  useLeadStats,
  useUpdateLeadStatus,
  useDeleteLead,
  useCreateLead,
  useUpdateLead,
  type Lead,
  type CreateLeadInput,
} from '@/hooks/useLeads';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/hooks/useToast';
import { exportToCsv } from '@/lib/exportCsv';
import {
  Users,
  Trash2,
  Download,
  Search,
  SlidersHorizontal,
  Plus,
  Pencil,
  X,
  AlertCircle,
} from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';

const STATUS_COLORS: Record<Lead['status'], string> = {
  NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONTACTED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  QUALIFIED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  CONVERTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ALL_STATUSES: Lead['status'][] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

const EMPTY_FORM: CreateLeadInput = {
  name: '',
  email: '',
  phone: '',
  company: '',
  source: '',
  notes: '',
  status: 'NEW',
};

export default function LeadsPage() {
  const t = useTranslations('dashboard.leads');
  const tc = useTranslations('common');
  const ts = useTranslations('dashboard.sidebar');
  const tb = useTranslations('dashboard.breadcrumb');
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<Lead['status'] | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);
  const [sourceFilter, setSourceFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<CreateLeadInput>(EMPTY_FORM);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const { data: leadsData, isLoading, isError } = useLeads({
    page,
    limit: 20,
    status: statusFilter,
    search: debouncedSearch || undefined,
  });
  const { data: stats } = useLeadStats();
  const updateStatus = useUpdateLeadStatus();
  const deleteLead = useDeleteLead();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const { confirmProps, confirm } = useConfirmDialog();

  const allLeads: Lead[] = leadsData?.data ?? [];
  const pagination = leadsData?.pagination;

  // Client-side filters: confidence + source
  const leads = useMemo(() => {
    let filtered = allLeads;
    if (minConfidence > 0) {
      filtered = filtered.filter((l) => l.confidence >= minConfidence / 100);
    }
    if (sourceFilter) {
      filtered = filtered.filter((l) => l.source === sourceFilter);
    }
    return filtered;
  }, [allLeads, minConfidence, sourceFilter]);

  // Collect distinct sources for the dropdown
  const distinctSources = useMemo(() => {
    const sources = new Set<string>();
    allLeads.forEach((l) => {
      if (l.source) sources.add(l.source);
    });
    return Array.from(sources).sort();
  }, [allLeads]);

  function handleStatusChange(leadId: string, newStatus: Lead['status']) {
    updateStatus.mutate(
      { leadId, status: newStatus },
      {
        onSuccess: () => toast.success(tc('toast.leadStatusUpdated')),
        onError: () => toast.error(tc('toast.leadStatusUpdateFailed')),
      },
    );
  }

  function handleDelete(leadId: string) {
    confirm({
      title: t('delete'),
      message: t('deleteConfirm'),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
      onConfirm: () => {
        deleteLead.mutate(
          { leadId },
          {
            onSuccess: () => toast.success(tc('toast.leadDeleted')),
            onError: () => toast.error(tc('toast.leadDeleteFailed')),
          },
        );
      },
    });
  }

  function handleExport() {
    if (!leads.length) return;
    const rows = leads.map((lead) => ({
      name: lead.name ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      company: lead.company ?? '',
      confidence: Math.round(lead.confidence * 100) + '%',
      status: statusLabel(lead.status),
      source: lead.source ? sourceLabel(lead.source) : '',
      createdAt: fmtDate(lead.createdAt, locale),
    }));
    exportToCsv('leads', rows);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingLead(null);
    setShowCreateDialog(true);
  }

  function openEdit(lead: Lead) {
    setForm({
      name: lead.name ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      company: lead.company ?? '',
      source: lead.source ?? '',
      notes: '',
      status: lead.status,
    });
    setEditingLead(lead);
    setShowCreateDialog(true);
  }

  function closeDialog() {
    setShowCreateDialog(false);
    setEditingLead(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    // Clean empty strings to undefined
    const cleaned: CreateLeadInput = {};
    if (form.name) cleaned.name = form.name;
    if (form.email) cleaned.email = form.email;
    if (form.phone) cleaned.phone = form.phone;
    if (form.company) cleaned.company = form.company;
    if (form.source) cleaned.source = form.source;
    if (form.notes) cleaned.notes = form.notes;
    if (form.status) cleaned.status = form.status;

    if (editingLead) {
      updateLead.mutate(
        { leadId: editingLead.id, ...cleaned },
        {
          onSuccess: () => {
            closeDialog();
            toast.success(tc('toast.leadUpdated'));
          },
          onError: () => toast.error(tc('toast.leadUpdateFailed')),
        },
      );
    } else {
      createLead.mutate(cleaned, {
        onSuccess: () => {
          closeDialog();
          toast.success(tc('toast.leadCreated'));
        },
        onError: () => toast.error(tc('toast.leadCreateFailed')),
      });
    }
  }

  function statusLabel(status: Lead['status']): string {
    const map: Record<Lead['status'], string> = {
      NEW: t('statusNew'),
      CONTACTED: t('statusContacted'),
      QUALIFIED: t('statusQualified'),
      CONVERTED: t('statusConverted'),
      LOST: t('statusLost'),
    };
    return map[status];
  }

  function sourceLabel(source: string): string {
    const map: Record<string, string> = {
      WEBCHAT: t('sourceWebchat'),
      WHATSAPP: t('sourceWhatsapp'),
      EMAIL: t('sourceEmail'),
      MESSENGER: t('sourceMessenger'),
      INSTAGRAM: t('sourceInstagram'),
      MANUAL: t('sourceManual'),
      API: t('sourceApi'),
    };
    return map[source] || source;
  }

  function confidenceColor(c: number): string {
    if (c >= 0.7) return 'bg-green-500';
    if (c >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  const tabs = [
    { key: undefined as Lead['status'] | undefined, label: t('all'), count: stats?.total },
    { key: 'NEW' as const, label: t('statusNew'), count: stats?.new },
    { key: 'CONTACTED' as const, label: t('statusContacted'), count: stats?.contacted },
    { key: 'QUALIFIED' as const, label: t('statusQualified'), count: stats?.qualified },
    { key: 'CONVERTED' as const, label: t('statusConverted'), count: stats?.converted },
    { key: 'LOST' as const, label: t('statusLost'), count: stats?.lost },
  ];

  const isSaving = createLead.isPending || updateLead.isPending;

  return (
    <>
    <div>
      <Breadcrumb
        items={[
          { label: tb('dashboard'), href: '/dashboard' },
          { label: ts('leads') },
        ]}
        className="mb-4"
      />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="text-sm text-muted-foreground">
                {stats.total} {t('total')}
              </div>
            )}
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('createLead')}
            </button>
            <button
              onClick={handleExport}
              disabled={!leads.length}
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Download className="h-4 w-4" />
              {t('export')}
            </button>
          </div>
        </div>
      </div>

      {/* Search + Filters Row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('searchLeads')}
            className="w-full rounded-lg border bg-card ps-9 pe-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>

        {/* Confidence Slider */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground whitespace-nowrap">
            {t('minConfidence')}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-24 accent-primary"
          />
          <span className="text-xs font-medium text-muted-foreground w-8">
            {minConfidence}%
          </span>
        </div>

        {/* Source Filter */}
        {distinctSources.length > 0 && (
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <option value="">{t('allSources')}</option>
            {distinctSources.map((src) => (
              <option key={src} value={src}>
                {sourceLabel(src)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key ?? 'all'}
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ms-1.5 text-xs opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Error state */}
      {!isLoading && isError && (
        <div className="rounded-xl border bg-card p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="font-medium">{tc('somethingWentWrong')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tc('errorDescription')}</p>
          </div>
        </div>
      )}

      {/* Table / Cards */}
      {isLoading ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-6 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded bg-muted" />
            ))}
          </div>
        </div>
      ) : isError ? null : leads.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
            <Users className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">{t('noLeads')}</p>
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
                    {t('name')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('email')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('phone')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('confidence')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('source')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('status')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                    {t('date')}
                  </th>
                  <th className="px-4 py-3 text-end text-xs font-medium text-muted-foreground uppercase">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">
                      {lead.name || t('unknown')}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {lead.email || '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground" dir="ltr">
                      {lead.phone || '\u2014'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full ${confidenceColor(lead.confidence)}`}
                            style={{ width: `${Math.round(lead.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(lead.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {lead.source ? sourceLabel(lead.source) : '\u2014'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={(e) =>
                          handleStatusChange(lead.id, e.target.value as Lead['status'])
                        }
                        className={`rounded-lg px-2 py-1 text-xs font-medium border-0 cursor-pointer ${STATUS_COLORS[lead.status]}`}
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {fmtDate(lead.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(lead)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title={t('editLead')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {leads.map((lead) => (
              <div key={lead.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{lead.name || t('unknown')}</p>
                    {lead.email && (
                      <p className="text-sm text-muted-foreground">{lead.email}</p>
                    )}
                    {lead.phone && (
                      <p className="text-sm text-muted-foreground" dir="ltr">
                        {lead.phone}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status]}`}
                  >
                    {statusLabel(lead.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${confidenceColor(lead.confidence)}`}
                        style={{ width: `${Math.round(lead.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(lead.confidence * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={lead.status}
                      onChange={(e) =>
                        handleStatusChange(lead.id, e.target.value as Lead['status'])
                      }
                      className="rounded-lg px-2 py-1 text-xs border bg-background"
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => openEdit(lead)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(lead.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              className="mt-6"
            />
          )}
        </>
      )}
    </div>

    {/* Create / Edit Lead Dialog */}
    {showCreateDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-xl shadow-xl border w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          {/* Dialog Header */}
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-lg font-semibold">
              {editingLead ? t('editLead') : t('createLead')}
            </h2>
            <button
              onClick={closeDialog}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Dialog Body */}
          <div className="p-5 space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="lead-name" className="block text-sm font-medium mb-1.5">{t('name')}</label>
              <input
                id="lead-name"
                type="text"
                value={form.name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('namePlaceholder')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="lead-email" className="block text-sm font-medium mb-1.5">{t('email')}</label>
              <input
                id="lead-email"
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                dir="ltr"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="lead-phone" className="block text-sm font-medium mb-1.5">{t('phone')}</label>
              <input
                id="lead-phone"
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+20 1xx xxx xxxx"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                dir="ltr"
              />
            </div>

            {/* Company */}
            <div>
              <label htmlFor="lead-company" className="block text-sm font-medium mb-1.5">{t('company')}</label>
              <input
                id="lead-company"
                type="text"
                value={form.company ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder={t('companyPlaceholder')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>

            {/* Source */}
            <div>
              <label htmlFor="lead-source" className="block text-sm font-medium mb-1.5">{t('source')}</label>
              <input
                id="lead-source"
                type="text"
                value={form.source ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                placeholder={t('sourcePlaceholder')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="lead-status" className="block text-sm font-medium mb-1.5">{t('status')}</label>
              <select
                id="lead-status"
                value={form.status ?? 'NEW'}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Lead['status'] }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="lead-notes" className="block text-sm font-medium mb-1.5">{t('notes')}</label>
              <textarea
                id="lead-notes"
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t('notesPlaceholder')}
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 resize-none"
              />
            </div>
          </div>

          {/* Dialog Footer */}
          <div className="flex items-center justify-end gap-3 p-5 border-t">
            <button
              onClick={closeDialog}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? '...' : editingLead ? t('saveChanges') : t('createLead')}
            </button>
          </div>
        </div>
      </div>
    )}

    <ConfirmDialog {...confirmProps} />
    </>
  );
}
