'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useAdminBulkEmails,
  useCreateBulkEmail,
  useSendBulkEmail,
  useCancelBulkEmail,
  useRecipientCount,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  Send,
  Loader2,
  Users,
  XCircle,
  Eye,
  Mail,
  PenLine,
  List,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Campaign {
  id: string;
  subject: string;
  status: 'DRAFT' | 'SENDING' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


const statusBadge: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENDING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const planOptions = ['', 'FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;
const statusOptions = ['', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b last:border-b-0">
      <td className="px-4 py-3"><div className="h-3 w-40 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-12 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-32 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-7 w-20 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BulkEmailPage() {
  const t = useTranslations('admin.bulkEmail');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<'compose' | 'campaigns'>('compose');

  // --- Compose state ---
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmailVerified, setFilterEmailVerified] = useState(false);

  // --- Campaigns state ---
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sendConfirmId, setSendConfirmId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  const { data: campaignsData, isLoading, isError, refetch } = useAdminBulkEmails({ page, limit: 20 });
  const createCampaign = useCreateBulkEmail();
  const sendCampaign = useSendBulkEmail();
  const cancelCampaign = useCancelBulkEmail();

  const recipientQuery = useRecipientCount({
    plan: filterPlan || undefined,
    status: filterStatus || undefined,
    emailVerified: filterEmailVerified || undefined,
  });

  const campaigns: Campaign[] = campaignsData?.campaigns ?? [];
  const totalPages = campaignsData?.totalPages ?? 1;

  // --- Compose handlers ---

  async function handlePreviewCount() {
    try {
      await recipientQuery.refetch();
    } catch {
      addToast('error', t('toasts.failedRecipientCount'));
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !bodyHtml.trim()) return;
    try {
      const targetFilter: Record<string, unknown> = {};
      if (filterPlan) targetFilter.plan = filterPlan;
      if (filterStatus) targetFilter.status = filterStatus;
      if (filterEmailVerified) targetFilter.emailVerified = true;

      await createCampaign.mutateAsync({
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        targetFilter: Object.keys(targetFilter).length > 0 ? targetFilter : undefined,
      });
      addToast('success', t('toasts.campaignCreated'));
      setSubject('');
      setBodyHtml('');
      setFilterPlan('');
      setFilterStatus('');
      setFilterEmailVerified(false);
      setActiveTab('campaigns');
    } catch {
      addToast('error', t('toasts.failedCreateCampaign'));
    }
  }

  // --- Campaign action handlers ---

  async function handleSend(id: string) {
    try {
      await sendCampaign.mutateAsync(id);
      addToast('success', t('toasts.campaignSending'));
      setSendConfirmId(null);
    } catch {
      addToast('error', t('toasts.failedStartCampaign'));
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelCampaign.mutateAsync(id);
      addToast('success', t('toasts.campaignCancelled'));
      setCancelConfirmId(null);
    } catch {
      addToast('error', t('toasts.failedCancelCampaign'));
    }
  }

  function getProgress(campaign: Campaign) {
    if (!campaign.totalRecipients) return 0;
    return Math.round((campaign.sentCount / campaign.totalRecipients) * 100);
  }

  // --- Tabs ---
  const tabs = [
    { key: 'compose' as const, label: t('tabs.compose'), icon: PenLine },
    { key: 'campaigns' as const, label: t('tabs.campaigns'), icon: List },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== COMPOSE TAB ==================== */}
      {activeTab === 'compose' && (
        <form
          onSubmit={handleCreateCampaign}
          className="rounded-xl border bg-card p-5 shadow-sm space-y-5"
        >
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('compose.subject')}</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('compose.subjectPlaceholder')}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
            />
          </div>

          {/* Body HTML */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('compose.bodyHtml')}</label>
            <textarea
              required
              rows={10}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder={t('compose.bodyHtmlPlaceholder')}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors resize-none"
            />
          </div>

          {/* Target Filters */}
          <div>
            <h3 className="text-sm font-medium mb-3">{t('compose.targetFilters')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('compose.plan')}</label>
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
                >
                  {planOptions.map((p) => (
                    <option key={p} value={p}>
                      {p || t('compose.allPlans')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('compose.status')}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s || t('compose.allStatuses')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterEmailVerified}
                    onChange={(e) => setFilterEmailVerified(e.target.checked)}
                    className="h-4 w-4 rounded border"
                  />
                  <span className="text-sm">{t('compose.emailVerifiedOnly')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Preview Count */}
          <div className="flex items-center gap-4 border-t pt-4">
            <button
              type="button"
              onClick={handlePreviewCount}
              disabled={recipientQuery.isFetching}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              {recipientQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              {t('compose.previewCount')}
            </button>
            {recipientQuery.data !== undefined && (
              <span className="text-sm font-medium">
                {recipientQuery.data?.count ?? recipientQuery.data ?? 0} {t('compose.recipients')}
              </span>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={createCampaign.isPending || !subject.trim() || !bodyHtml.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {createCampaign.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {t('compose.createCampaign')}
            </button>
          </div>
        </form>
      )}

      {/* ==================== CAMPAIGNS TAB ==================== */}
      {activeTab === 'campaigns' && (
        <>
          {/* Error State */}
          {isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('toasts.failedLoadCampaigns')}</p>
              <button
                onClick={() => refetch()}
                className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
              >
                {t('campaigns.retry')}
              </button>
            </div>
          )}

          {/* Detail View */}
          {detailId && (
            <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{t('campaigns.campaignDetail')}</h3>
                <button
                  onClick={() => setDetailId(null)}
                  aria-label={tc('close')}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
              {(() => {
                const campaign = campaigns.find((c) => c.id === detailId);
                if (!campaign) return <p className="text-sm text-muted-foreground">{t('campaigns.campaignNotFound')}</p>;
                return (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('campaigns.subject')}:</span>{' '}
                      <span className="font-medium">{campaign.subject}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('campaigns.status')}:</span>{' '}
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusBadge[campaign.status])}>
                        {t(`campaigns.status_${campaign.status}`)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('campaigns.totalRecipients')}:</span>{' '}
                      <span className="font-medium">{campaign.totalRecipients}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('campaigns.sent')}:</span>{' '}
                      <span className="font-medium">{campaign.sentCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('campaigns.failed')}:</span>{' '}
                      <span className="font-medium text-red-600">{campaign.failedCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('campaigns.created')}:</span>{' '}
                      <span className="font-medium">{fmtDateTime(campaign.createdAt, locale)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('campaigns.subject')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('campaigns.status')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('campaigns.recipients')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('campaigns.progress')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('campaigns.created')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('campaigns.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading &&
                    Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}

                  {!isLoading && !isError && campaigns.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <Mail className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                        <p className="text-sm text-muted-foreground">{t('campaigns.noCampaigns')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('campaigns.switchToCompose')}
                        </p>
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    !isError &&
                    campaigns.map((campaign) => {
                      const progress = getProgress(campaign);
                      return (
                        <tr key={campaign.id} className="border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium truncate block max-w-[250px]">
                              {campaign.subject}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                                statusBadge[campaign.status],
                              )}
                            >
                              {t(`campaigns.status_${campaign.status}`)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {campaign.totalRecipients}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    campaign.status === 'COMPLETED'
                                      ? 'bg-green-500'
                                      : campaign.status === 'FAILED'
                                        ? 'bg-red-500'
                                        : 'bg-blue-500',
                                  )}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{progress}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                            {fmtDateTime(campaign.createdAt, locale)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {/* View Detail */}
                              <button
                                onClick={() => setDetailId(detailId === campaign.id ? null : campaign.id)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                title={t('campaigns.viewDetail')}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Send (for DRAFT) */}
                              {campaign.status === 'DRAFT' && (
                                <>
                                  {sendConfirmId === campaign.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleSend(campaign.id)}
                                        disabled={sendCampaign.isPending}
                                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                                      >
                                        {sendCampaign.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                        {t('campaigns.confirm')}
                                      </button>
                                      <button
                                        onClick={() => setSendConfirmId(null)}
                                        className="rounded-lg px-2 py-1 text-[10px] font-medium border hover:bg-muted transition-colors"
                                      >
                                        {t('campaigns.cancel')}
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setSendConfirmId(campaign.id)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                      <Send className="h-3 w-3" />
                                      {t('campaigns.send')}
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Cancel (for SENDING) */}
                              {campaign.status === 'SENDING' && (
                                <>
                                  {cancelConfirmId === campaign.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleCancel(campaign.id)}
                                        disabled={cancelCampaign.isPending}
                                        className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2 py-1 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                                      >
                                        {cancelCampaign.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                        {t('campaigns.confirm')}
                                      </button>
                                      <button
                                        onClick={() => setCancelConfirmId(null)}
                                        className="rounded-lg px-2 py-1 text-[10px] font-medium border hover:bg-muted transition-colors"
                                      >
                                        {t('campaigns.no')}
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setCancelConfirmId(campaign.id)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                      <XCircle className="h-3 w-3" />
                                      {t('campaigns.cancel')}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {!isLoading && (
            <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} previousLabel={tc('previous')} nextLabel={tc('next')} pageLabel={tc('page')} ofLabel={tc('of')} />
          )}
        </>
      )}
    </div>
  );
}
