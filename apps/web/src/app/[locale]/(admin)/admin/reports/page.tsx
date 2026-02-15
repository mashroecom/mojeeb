'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import {
  LayoutDashboard,
  DollarSign,
  Users,
  CreditCard,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportConfig {
  key: string;
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
  endpoint: string;
  filename: string;
}

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

const reportConfigs: ReportConfig[] = [
  {
    key: 'platform-overview',
    titleKey: 'platformOverview',
    descKey: 'platformOverviewDesc',
    icon: <LayoutDashboard className="h-8 w-8" />,
    endpoint: '/admin/reports/platform-overview',
    filename: 'platform-overview.pdf',
  },
  {
    key: 'revenue',
    titleKey: 'revenue',
    descKey: 'revenueDesc',
    icon: <DollarSign className="h-8 w-8" />,
    endpoint: '/admin/reports/revenue',
    filename: 'revenue-report.pdf',
  },
  {
    key: 'user-growth',
    titleKey: 'userGrowth',
    descKey: 'userGrowthDesc',
    icon: <Users className="h-8 w-8" />,
    endpoint: '/admin/reports/user-growth',
    filename: 'user-growth.pdf',
  },
  {
    key: 'subscriptions',
    titleKey: 'subscriptions',
    descKey: 'subscriptionsDesc',
    icon: <CreditCard className="h-8 w-8" />,
    endpoint: '/admin/reports/subscriptions',
    filename: 'subscription-analysis.pdf',
  },
];

// ---------------------------------------------------------------------------
// ReportCard component
// ---------------------------------------------------------------------------

function ReportCard({ report }: { report: ReportConfig }) {
  const t = useTranslations('admin.reports');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    setError('');
    setDownloading(true);
    try {
      const searchParams = new URLSearchParams();
      if (startDate) searchParams.set('startDate', startDate);
      if (endDate) searchParams.set('endDate', endDate);
      const query = searchParams.toString();
      const url = `${report.endpoint}${query ? `?${query}` : ''}`;

      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = report.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      setError(t('downloadError'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm flex flex-col">
      <div className="flex items-start gap-4 mb-4">
        <div className="rounded-lg bg-primary/10 p-3 text-primary">{report.icon}</div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{t(report.titleKey)}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t(report.descKey)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t('endDate')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>}

      <div className="mt-auto">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('generating')}
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              {t('downloadPdf')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const t = useTranslations('admin.reports');

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {reportConfigs.map((report) => (
          <ReportCard key={report.key} report={report} />
        ))}
      </div>
    </div>
  );
}
