'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaintenanceSectionProps {
  // State
  maintenanceEnabled: boolean;
  maintenanceTitle: string;
  maintenanceTitleAr: string;
  maintenanceMessage: string;
  maintenanceMessageAr: string;

  // Setters
  setMaintenanceEnabled: (value: boolean) => void;
  setMaintenanceTitle: (value: string) => void;
  setMaintenanceTitleAr: (value: string) => void;
  setMaintenanceMessage: (value: string) => void;
  setMaintenanceMessageAr: (value: string) => void;

  // Callbacks
  markChanged: () => void;

  // Translations
  t: (key: string) => string;

  // Classes
  inputCls: string;
  textareaCls: string;
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed',
        value ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          value
            ? 'ltr:translate-x-5 rtl:-translate-x-5'
            : 'ltr:translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  description,
  showToggle = true,
}: {
  title: string;
  description: string;
  showToggle?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4 border-b mb-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Language Tabs
// ---------------------------------------------------------------------------

function LangTabs({ lang, setLang }: { lang: 'en' | 'ar'; setLang: (l: 'en' | 'ar') => void }) {
  return (
    <div className="flex gap-1 rounded-lg border bg-muted/50 p-0.5 w-fit mb-4">
      <button
        onClick={() => setLang('en')}
        className={cn(
          'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
          lang === 'en'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        English
      </button>
      <button
        onClick={() => setLang('ar')}
        className={cn(
          'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
          lang === 'ar'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        العربية
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Maintenance Section Component
// ---------------------------------------------------------------------------

export function MaintenanceSection({
  maintenanceEnabled,
  maintenanceTitle,
  maintenanceTitleAr,
  maintenanceMessage,
  maintenanceMessageAr,
  setMaintenanceEnabled,
  setMaintenanceTitle,
  setMaintenanceTitleAr,
  setMaintenanceMessage,
  setMaintenanceMessageAr,
  markChanged,
  t,
  inputCls,
  textareaCls,
}: MaintenanceSectionProps) {
  const [maintenanceLang, setMaintenanceLang] = useState<'en' | 'ar'>('en');

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('maintenanceSection')}
        description={t('maintenanceSectionDesc')}
        showToggle={false}
      />
      <div className="flex items-center justify-between rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <div>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
              {t('enableMaintenance')}
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              {t('enableMaintenanceDesc')}
            </p>
          </div>
        </div>
        <ToggleSwitch
          value={maintenanceEnabled}
          onChange={() => {
            setMaintenanceEnabled(!maintenanceEnabled);
            markChanged();
          }}
        />
      </div>
      <LangTabs lang={maintenanceLang} setLang={setMaintenanceLang} />
      <div>
        <label className="text-sm font-medium">
          {t('maintenanceTitle')} ({maintenanceLang === 'en' ? 'EN' : 'AR'})
        </label>
        <input
          type="text"
          dir={maintenanceLang === 'ar' ? 'rtl' : 'ltr'}
          value={maintenanceLang === 'en' ? maintenanceTitle : maintenanceTitleAr}
          onChange={(e) => {
            if (maintenanceLang === 'en') setMaintenanceTitle(e.target.value);
            else setMaintenanceTitleAr(e.target.value);
            markChanged();
          }}
          className={inputCls}
        />
      </div>
      <div>
        <label className="text-sm font-medium">
          {t('maintenanceMsg')} ({maintenanceLang === 'en' ? 'EN' : 'AR'})
        </label>
        <textarea
          dir={maintenanceLang === 'ar' ? 'rtl' : 'ltr'}
          value={maintenanceLang === 'en' ? maintenanceMessage : maintenanceMessageAr}
          onChange={(e) => {
            if (maintenanceLang === 'en') setMaintenanceMessage(e.target.value);
            else setMaintenanceMessageAr(e.target.value);
            markChanged();
          }}
          rows={3}
          className={textareaCls}
        />
      </div>
    </div>
  );
}
