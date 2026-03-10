'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Loader2, Users2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/dateFormat';

interface Lead {
  id: string;
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  status: string;
  interests?: string[];
  createdAt: string;
  org?: {
    name: string;
  };
}

interface LeadsTabProps {
  isLoading: boolean;
  leadsData?: {
    leads: Lead[];
    totalPages: number;
  } | null;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function LeadsTab({ isLoading, leadsData, currentPage, onPageChange }: LeadsTabProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!leadsData?.leads?.length) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('userDetail.noLeads')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {leadsData.leads.map((lead) => (
        <div
          key={lead.id}
          className="flex items-center justify-between p-4 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800"
        >
          <div className="flex items-center gap-3">
            <Users2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {lead.name || lead.email || 'Unknown'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {lead.company && <>{lead.company} · </>}
                {lead.org?.name}
              </p>
              {lead.phone && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('userDetail.phone')}: {lead.phone}
                </p>
              )}
              {lead.interests && lead.interests.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {lead.interests.map((interest) => (
                    <span
                      key={interest}
                      className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-right text-sm">
            <span
              className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                lead.status === 'NEW'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : lead.status === 'CONTACTED'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    : lead.status === 'QUALIFIED'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : lead.status === 'CONVERTED'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
              )}
            >
              {lead.status}
            </span>
            <p className="text-gray-400 dark:text-gray-500 mt-1">
              {fmtDate(lead.createdAt, locale)}
            </p>
          </div>
        </div>
      ))}
      {leadsData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {currentPage} / {leadsData.totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= leadsData.totalPages}
            className="text-sm text-blue-600 disabled:text-gray-400"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
