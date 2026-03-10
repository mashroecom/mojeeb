'use client';

import { useState } from 'react';
import { X, Megaphone } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('announcement-dismissed') === 'true';
    }
    return false;
  });

  const t = useTranslations('dashboard');

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('announcement-dismissed', 'true');
    }
  };

  if (dismissed) return null;

  // No announcement to show by default
  return null;

  // Uncomment and customize when you have an announcement:
  /*
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/30">
      <div className="flex items-center gap-3">
        <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {t('announcement.title')}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {t('announcement.message')}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
  */
}
