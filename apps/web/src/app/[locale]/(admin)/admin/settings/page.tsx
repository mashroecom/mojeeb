'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bell,
  Building2,
  Globe,
  MessageCircle,
  Palette,
  Search,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/hooks/useToast';
import { AdminPageHeader } from '@/components/admin';
import { ErrorState } from '@/components/ui/ErrorState';
import { SaveBar } from './_components/fields';
import { useSiteSettingsForm, type SiteField } from './_components/useSiteSettingsForm';
import {
  AppearanceTab,
  ContentSeoTab,
  GeneralTab,
  SupportChatTab,
} from './_components/SiteSettingsTabs';
import { NotificationsTab, OrgDefaultsTab, SecurityTab } from './_components/ConfigSettingsTabs';

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

// The first four tabs edit the single SiteSettings row (/admin/site-settings) and share
// one save bar; the last three each save their own SystemConfig category.
const SITE_TABS = ['general', 'appearance', 'contentSeo', 'supportChat'] as const;

type SiteTab = (typeof SITE_TABS)[number];
type TabId = SiteTab | 'security' | 'notifications' | 'orgDefaults';

const TABS: { id: TabId; icon: LucideIcon }[] = [
  { id: 'general', icon: Globe },
  { id: 'appearance', icon: Palette },
  { id: 'contentSeo', icon: Search },
  { id: 'supportChat', icon: MessageCircle },
  { id: 'security', icon: ShieldCheck },
  { id: 'notifications', icon: Bell },
  { id: 'orgDefaults', icon: Building2 },
];

function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function isSiteTab(tab: TabId): tab is SiteTab {
  return (SITE_TABS as readonly string[]).includes(tab);
}

/** Which site tab shows a given field — used to jump to the first invalid field on save. */
function tabForField(field: SiteField): SiteTab {
  if (field.startsWith('supportChat')) return 'supportChat';
  if (field === 'primaryColor' || field === 'secondaryColor') return 'appearance';
  if (
    field === 'googleAnalyticsId' ||
    field === 'customHeadScripts' ||
    field === 'maintenanceMode' ||
    field === 'maintenanceMessage'
  ) {
    return 'contentSeo';
  }
  return 'general';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  const t = useTranslations('admin.settings');
  const ts = useTranslations('admin.siteSettings');
  const tc = useTranslations('admin.common');
  const addToast = useToastStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const form = useSiteSettingsForm();

  // Keep the active tab in the URL hash so a reload or a shared link lands on the same tab.
  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '');
    if (isTabId(fromHash)) setActiveTab(fromHash);
  }, []);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
  }

  async function handleSiteSave() {
    const result = await form.save();
    if (result.ok) {
      addToast('success', t('saved'));
      return;
    }
    const firstField = result.fields?.[0];
    if (firstField) selectTab(tabForField(firstField));
    if (result.reason === 'channel') addToast('error', t('supportChat.invalidIntegrationId'));
    else if (result.reason === 'validation') addToast('error', t('fixErrors'));
    else addToast('error', t('failedSave'));
  }

  return (
    <div>
      <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Tab strip */}
      <div
        role="tablist"
        aria-label={t('title')}
        className="mb-6 flex flex-wrap gap-1 rounded-lg border bg-card p-1"
      >
        {TABS.map(({ id, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={isActive}
              aria-controls={isSiteTab(id) ? 'settings-panel-site' : `settings-panel-${id}`}
              onClick={() => selectTab(id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(`tabs.${id}`)}
            </button>
          );
        })}
      </div>

      {/* Site settings tabs (shared form) */}
      <div
        role="tabpanel"
        id="settings-panel-site"
        aria-labelledby={`settings-tab-${isSiteTab(activeTab) ? activeTab : 'general'}`}
        hidden={!isSiteTab(activeTab)}
      >
        {form.query.isLoading ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
                <div className="mb-5 h-5 w-40 rounded bg-muted" />
                <div className="space-y-4">
                  <div className="h-10 rounded-lg bg-muted" />
                  <div className="h-10 rounded-lg bg-muted" />
                  <div className="h-20 rounded-lg bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : form.query.isError || !form.settings ? (
          <div className="rounded-xl border bg-card shadow-sm">
            <ErrorState
              title={tc('error')}
              retryLabel={tc('retry')}
              onRetry={() => form.query.refetch()}
            />
          </div>
        ) : (
          <>
            {activeTab === 'general' && <GeneralTab form={form} />}
            {activeTab === 'appearance' && <AppearanceTab form={form} />}
            {activeTab === 'contentSeo' && <ContentSeoTab form={form} />}
            {activeTab === 'supportChat' && <SupportChatTab form={form} />}
            <SaveBar
              dirty={form.dirty}
              saving={form.saving}
              onSave={handleSiteSave}
              onDiscard={form.discard}
              saveLabel={ts('save')}
              savingLabel={t('saving')}
              discardLabel={t('discard')}
              unsavedLabel={t('unsavedChanges')}
            />
          </>
        )}
      </div>

      {/* SystemConfig tabs stay mounted so unsaved edits survive switching tabs. */}
      <div
        role="tabpanel"
        id="settings-panel-security"
        aria-labelledby="settings-tab-security"
        hidden={activeTab !== 'security'}
      >
        <SecurityTab />
      </div>
      <div
        role="tabpanel"
        id="settings-panel-notifications"
        aria-labelledby="settings-tab-notifications"
        hidden={activeTab !== 'notifications'}
      >
        <NotificationsTab />
      </div>
      <div
        role="tabpanel"
        id="settings-panel-orgDefaults"
        aria-labelledby="settings-tab-orgDefaults"
        hidden={activeTab !== 'orgDefaults'}
      >
        <OrgDefaultsTab />
      </div>
    </div>
  );
}
