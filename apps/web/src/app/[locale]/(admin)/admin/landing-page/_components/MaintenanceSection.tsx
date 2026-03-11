'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SectionHeader, LangTabs, ToggleSwitch } from './shared';
import { inputCls, textareaCls } from './styles';

// ---------------------------------------------------------------------------
// Props
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
