'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSubscription, useInvoices, usePlans, usePaymentGateways } from '@/hooks/useSubscription';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/authStore';
import { useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import { api } from '@/lib/api';
import { SpendingCapSection } from './_components/SpendingCapSection';
import {
  MessageSquare,
  Bot,
  Check,
  Crown,
  Loader2,
  FileText,
  Download,
  Eye,
  AlertTriangle,
  X,
  Zap,
  Calendar,
  CreditCard,
} from 'lucide-react';

export default function BillingPage() {
  const t = useTranslations('dashboard.billing');
  const ts = useTranslations('dashboard.sidebar');
  const tb = useTranslations('dashboard.breadcrumb');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { data: subscription, isLoading, refetch } = useSubscription();
  const { data: invoices, isLoading: loadingInvoices, refetch: refetchInvoices } = useInvoices();
  const { data: planConfigs } = usePlans();
  const { data: paymentGateways, isLoading: loadingGateways } = usePaymentGateways();
  const orgId = useAuthStore((s) => s.organization?.id);
  const searchParams = useSearchParams();
  const router = useRouter();

  const { confirmProps, confirm } = useConfirmDialog();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<'KASHIER' | 'STRIPE' | 'PAYPAL' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [spendingCapSaving, setSpendingCapSaving] = useState(false);
  const [spendingCapSaved, setSpendingCapSaved] = useState(false);

  // Handle return from Kashier checkout
  const confirmingRef = useRef(false);
  useEffect(() => {
    const paymentStatus = searchParams.get('paymentStatus');
    const status = searchParams.get('status');
    const merchantOrderId = searchParams.get('merchantOrderId');

    if (confirmingRef.current || !orgId) return;

    if (paymentStatus === 'SUCCESS' && merchantOrderId) {
      // Confirm payment via API
      confirmingRef.current = true;
      api
        .post(`/organizations/${orgId}/subscription/confirm-payment`, {
          merchantOrderId,
          paymentStatus,
          transactionId: searchParams.get('transactionId') ?? '',
          amount: searchParams.get('amount') ?? '',
          currency: searchParams.get('currency') ?? 'USD',
          signature: searchParams.get('signature') ?? '',
        })
        .then(() => {
          setStatusMessage({ type: 'success', text: t('upgradeSuccess') });
          refetch();
          refetchInvoices();
        })
        .catch(() => {
          setStatusMessage({ type: 'error', text: t('upgradeFailed') });
        })
        .finally(() => {
          confirmingRef.current = false;
          router.replace('/billing');
        });
    } else if (status === 'failed') {
      setStatusMessage({ type: 'error', text: t('upgradeFailed') });
      router.replace('/billing');
    }
  }, [searchParams, orgId]);

  // Auto-dismiss status message after 5 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Set default gateway when gateways are loaded
  useEffect(() => {
    if (paymentGateways && paymentGateways.length > 0 && !selectedGateway) {
      const enabledGateways = paymentGateways.filter((gw) => gw.enabled);
      if (enabledGateways.length > 0) {
        setSelectedGateway(enabledGateways[0].gateway);
      }
    }
  }, [paymentGateways, selectedGateway]);

  async function handleUpgrade(plan: string) {
    if (!orgId || !selectedGateway) return;
    setCheckoutLoading(plan);
    setStatusMessage(null);

    try {
      const { data } = await api.post(`/organizations/${orgId}/subscription/checkout`, {
        plan,
        billingCycle,
        gateway: selectedGateway,
      });
      const checkoutUrl = data.data.checkoutUrl;
      // Redirect to payment gateway checkout
      window.location.href = checkoutUrl;
    } catch {
      setStatusMessage({ type: 'error', text: t('upgradeFailed') });
      setCheckoutLoading(null);
    }
  }

  async function doCancelSubscription(immediate: boolean) {
    if (!orgId || !subscription) return;
    const periodEnd = fmtDate(subscription.currentPeriodEnd, locale);

    setCancelLoading(true);
    setStatusMessage(null);
    try {
      await api.post(`/organizations/${orgId}/subscription/cancel`, { immediate });
      setStatusMessage({
        type: 'success',
        text: immediate ? t('canceled') : t('canceledAtPeriodEnd', { date: periodEnd }),
      });
      refetch();
    } catch {
      setStatusMessage({ type: 'error', text: t('upgradeFailed') });
    } finally {
      setCancelLoading(false);
    }
  }

  function handleCancel() {
    if (!orgId || !subscription) return;
    setShowCancelDialog(true);
  }

  async function handleSpendingCapSave(enabled: boolean, amount?: number) {
    if (!orgId) return;
    setSpendingCapSaving(true);
    setSpendingCapSaved(false);
    setStatusMessage(null);
    try {
      await api.post(`/organizations/${orgId}/subscription/spending-cap`, {
        enabled,
        amount,
      });
      setSpendingCapSaved(true);
      refetch();
      setTimeout(() => setSpendingCapSaved(false), 3000);
    } catch {
      setStatusMessage({ type: 'error', text: t('upgradeFailed') });
    } finally {
      setSpendingCapSaving(false);
    }
  }

  function planDisplayName(plan: string): string {
    const cfg = planConfigs?.find((p) => p.plan === plan);
    if (cfg) return isAr ? (cfg.displayNameAr || cfg.displayName) : cfg.displayName;
    const map: Record<string, string> = {
      FREE: t('free'),
      STARTER: t('starter'),
      PROFESSIONAL: t('professional'),
    };
    return map[plan] ?? plan;
  }

  function parseFeatures(featuresStr: string): string[] {
    try { return JSON.parse(featuresStr); } catch { return []; }
  }

  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<string | null>(null);

  async function fetchInvoicePdf(invoiceId: string): Promise<Blob | null> {
    if (!orgId) return null;
    const token = localStorage.getItem('accessToken');
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const resp = await fetch(
      `${baseUrl}/organizations/${orgId}/subscription/invoices/${invoiceId}/pdf`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) throw new Error('Failed to fetch PDF');
    return resp.blob();
  }

  async function handleDownloadInvoice(invoiceId: string) {
    setDownloadingInvoice(invoiceId);
    try {
      const blob = await fetchInvoicePdf(invoiceId);
      if (!blob) return;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId.slice(-8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setStatusMessage({ type: 'error', text: t('downloadFailed') });
    } finally {
      setDownloadingInvoice(null);
    }
  }

  async function handleViewInvoice(invoiceId: string) {
    setViewingInvoice(invoiceId);
    try {
      const blob = await fetchInvoicePdf(invoiceId);
      if (!blob) return;
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      setStatusMessage({ type: 'error', text: t('downloadFailed') });
    } finally {
      setViewingInvoice(null);
    }
  }

  function usagePercentage(used: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  function usageColor(percentage: number): string {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-primary';
  }

  function statusText(status: string): string {
    try {
      return t(`status.${status}`);
    } catch {
      return status;
    }
  }

  function getGatewayStyle(gateway: string): { bg: string; text: string } {
    switch (gateway) {
      case 'KASHIER':
        return { bg: 'bg-orange-100', text: 'text-orange-700' };
      case 'STRIPE':
        return { bg: 'bg-purple-100', text: 'text-purple-700' };
      case 'PAYPAL':
        return { bg: 'bg-blue-100', text: 'text-blue-700' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700' };
    }
  }

  const usageItems = subscription
    ? [
        {
          label: t('messages'),
          icon: MessageSquare,
          used: subscription.messagesUsed,
          limit: subscription.messagesLimit,
          color: 'text-blue-600',
          bg: 'bg-blue-100',
        },
        {
          label: t('agents'),
          icon: Bot,
          used: subscription.agentsUsed,
          limit: subscription.agentsLimit,
          color: 'text-purple-600',
          bg: 'bg-purple-100',
        },
        {
          label: t('aiConversations'),
          icon: Zap,
          used: subscription.aiConversationsUsed,
          limit: subscription.aiConversationsLimit,
          color: 'text-green-600',
          bg: 'bg-green-100',
        },
      ]
    : [];

  const plans = (planConfigs ?? []).map((cfg) => {
    const price = billingCycle === 'yearly' ? cfg.yearlyPrice : cfg.monthlyPrice;
    return {
      key: cfg.plan,
      name: isAr ? (cfg.displayNameAr || cfg.displayName) : cfg.displayName,
      price: price === 0 ? t('freePrice') : `$${price}`,
      monthlyPrice: cfg.monthlyPrice,
      yearlyPrice: cfg.yearlyPrice,
      popular: cfg.isPopular,
      features: parseFeatures(isAr ? cfg.featuresAr : cfg.features),
      overagePrice: cfg.overagePricePerConversation,
    };
  });

  return (
    <>
    <div>
      <Breadcrumb
        items={[
          { label: tb('dashboard'), href: '/dashboard' },
          { label: ts('billing') },
        ]}
        className="mb-4"
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Status message banner */}
      {statusMessage && (
        <div
          className={`mb-6 rounded-xl px-4 py-3 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-40 rounded-xl bg-muted" />
          <div className="h-48 rounded-xl bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
      ) : (
        <>
          {/* Payment Gateway Selector */}
          {paymentGateways && paymentGateways.length > 0 && (
            <div className="rounded-xl border bg-card p-6 shadow-sm mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t('paymentMethod')}</h2>
                  <p className="text-sm text-muted-foreground">{t('selectPaymentGateway')}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {paymentGateways
                  .filter((gw) => gw.enabled)
                  .map((gateway) => (
                    <button
                      key={gateway.gateway}
                      onClick={() => setSelectedGateway(gateway.gateway)}
                      className={`flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all ${
                        selectedGateway === gateway.gateway
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-muted hover:border-primary/50 hover:bg-accent'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{gateway.displayName}</span>
                          {selectedGateway === gateway.gateway && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        {gateway.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {gateway.description}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Current Plan Card */}
          {subscription && (
            <div className="rounded-xl border bg-card p-6 shadow-sm mb-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-semibold">{t('currentPlan')}</h2>
                    <span className="rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">
                      {planDisplayName(subscription.plan)}
                    </span>
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                        subscription.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : subscription.status === 'PAST_DUE'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {statusText(subscription.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('period')}: {fmtDate(subscription.currentPeriodStart, locale)} —{' '}
                    {fmtDate(subscription.currentPeriodEnd, locale)}
                  </p>

                  {/* Cancel subscription button (only for paid plans) */}
                  {subscription.plan !== 'FREE' && (
                    <button
                      onClick={handleCancel}
                      disabled={cancelLoading}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t('cancelSubscription')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Usage Section */}
          {subscription && (
            <div className="rounded-xl border bg-card p-6 shadow-sm mb-6">
              <h2 className="text-lg font-semibold mb-4">{t('usage')}</h2>
              <div className="space-y-5">
                {usageItems.map((item) => {
                  const pct = usagePercentage(item.used, item.limit);
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`rounded-lg p-1.5 ${item.bg}`}>
                            <item.icon className={`h-4 w-4 ${item.color}`} />
                          </div>
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {item.used} {t('of')} {item.limit}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-muted">
                        <div
                          className={`h-2.5 rounded-full transition-all ${usageColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {pct >= 90 && (
                        <p className="text-xs text-red-600 mt-1">
                          {pct}% {t('used')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spending Cap Section */}
          {subscription && (
            <div className="mb-6">
              <SpendingCapSection
                isLoading={false}
                spendingCapEnabled={subscription.spendingCapEnabled}
                spendingCapAmount={subscription.spendingCapAmount || 0}
                onSave={handleSpendingCapSave}
                isSaving={spendingCapSaving}
                showSaved={spendingCapSaved}
              />
            </div>
          )}

          {/* Available Plans */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{t('availablePlans')}</h2>
              <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    billingCycle === 'monthly'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('monthly')}
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    billingCycle === 'yearly'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('yearly')}
                  <span className="ms-1 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {t('savePercent')}
                  </span>
                </button>
              </div>
            </div>
            <div className={`grid grid-cols-1 gap-4 ${plans.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {plans.map((plan) => {
                const isCurrent = subscription?.plan === plan.key;
                const isUpgrade = plan.key !== 'FREE' && !isCurrent;
                const isLoading = checkoutLoading === plan.key;

                return (
                  <div
                    key={plan.key}
                    className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${
                      plan.popular ? 'border-primary shadow-md' : ''
                    } ${isCurrent ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">{plan.name}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                          {t('currentPlanBadge')}
                        </span>
                      )}
                    </div>
                    <div className="mb-4">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      {plan.key !== 'FREE' && (
                        <span className="text-sm text-muted-foreground">
                          {billingCycle === 'yearly' ? t('perYear') : t('perMonth')}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {plan.overagePrice > 0 && (
                      <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                              {t('overagePricing')}
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                              {t('overagePrice', { price: plan.overagePrice.toFixed(2) })}
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              {t('overageDescription')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
                      >
                        {t('currentPlanBadge')}
                      </button>
                    ) : isUpgrade ? (
                      <button
                        onClick={() => handleUpgrade(plan.key)}
                        disabled={isLoading || checkoutLoading !== null}
                        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('upgrade')}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
                      >
                        {t('free')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invoice History */}
          <div className="rounded-xl border bg-card p-6 shadow-sm mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-muted p-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">{t('invoiceHistory')}</h2>
            </div>
            {loadingInvoices ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded bg-muted" />
                ))}
              </div>
            ) : invoices && invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-start pb-3 font-medium">{t('invoiceDate')}</th>
                      <th className="text-start pb-3 font-medium">{t('invoiceAmount')}</th>
                      <th className="text-start pb-3 font-medium">{t('gateway')}</th>
                      <th className="text-start pb-3 font-medium">{t('invoiceStatusLabel')}</th>
                      <th className="text-start pb-3 font-medium">{t('invoiceDueDate')}</th>
                      <th className="text-start pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((invoice) => {
                      const gatewayStyle = getGatewayStyle((invoice as any).gateway || 'UNKNOWN');
                      return (
                      <tr key={invoice.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3">
                          {fmtDate(invoice.createdAt, locale)}
                        </td>
                        <td className="py-3 font-medium">
                          {invoice.currency} {Number(invoice.amount).toFixed(2)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${gatewayStyle.bg} ${gatewayStyle.text}`}
                          >
                            {(invoice as any).gateway || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              invoice.status === 'PAID'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : invoice.status === 'PENDING'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : invoice.status === 'FAILED'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {t(`invoiceStatus.${invoice.status}`)}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {fmtDate(invoice.dueDate, locale)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewInvoice(invoice.id)}
                              disabled={viewingInvoice === invoice.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                            >
                              {viewingInvoice === invoice.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                              {t('viewInvoice')}
                            </button>
                            <button
                              onClick={() => handleDownloadInvoice(invoice.id)}
                              disabled={downloadingInvoice === invoice.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                            >
                              {downloadingInvoice === invoice.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              {t('downloadInvoice')}
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('noInvoices')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
    <ConfirmDialog {...confirmProps} />
    {/* Cancel Subscription Dialog */}
    {showCancelDialog && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) setShowCancelDialog(false); }}
      >
        <div className="mx-4 w-full max-w-lg animate-in fade-in zoom-in-95 rounded-xl border bg-card p-6 shadow-lg">
          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold">{t('cancelDialogTitle')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('cancelDialogMessage')}</p>
            </div>
            <button onClick={() => setShowCancelDialog(false)} className="rounded-lg p-1 hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Options */}
          <div className="space-y-3 mb-5">
            {/* Cancel at period end */}
            <button
              onClick={() => { setShowCancelDialog(false); doCancelSubscription(false); }}
              disabled={cancelLoading}
              className="w-full flex items-start gap-3 rounded-xl border-2 border-muted p-4 text-start hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 mt-0.5">
                <Calendar className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-semibold">{t('cancelAtEnd')}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('cancelAtEndDesc', { date: subscription ? fmtDate(subscription.currentPeriodEnd, locale) : '' })}
                </p>
              </div>
            </button>

            {/* Cancel now */}
            <button
              onClick={() => { setShowCancelDialog(false); doCancelSubscription(true); }}
              disabled={cancelLoading}
              className="w-full flex items-start gap-3 rounded-xl border-2 border-muted p-4 text-start hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 mt-0.5">
                <Zap className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">{t('cancelNow')}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{t('cancelNowDesc')}</p>
              </div>
            </button>
          </div>

          {/* Keep subscription */}
          <button
            onClick={() => setShowCancelDialog(false)}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('keepSubscription')}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
