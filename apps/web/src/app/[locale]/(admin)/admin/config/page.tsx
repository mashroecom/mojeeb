'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminConfigs, useUpdateConfig, useTestConfig } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import {
  Loader2,
  Brain,
  CreditCard,
  Mail,
  MessageSquare,
  KeyRound,
  Settings,
  CheckCircle2,
  XCircle,
  Pencil,
  Save,
  X,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  category: string;
  isSecret: boolean;
  label: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  key: string;
  label: string;
  success: boolean;
  message: string;
}

interface TestData {
  success: boolean;
  message: string;
  results: TestResult[];
}

const CATEGORIES = [
  { id: 'ai', icon: Brain, color: 'text-violet-500' },
  { id: 'payment', icon: CreditCard, color: 'text-emerald-500' },
  { id: 'email', icon: Mail, color: 'text-blue-500' },
  { id: 'meta', icon: MessageSquare, color: 'text-sky-500' },
  { id: 'oauth', icon: KeyRound, color: 'text-amber-500' },
  { id: 'general', icon: Settings, color: 'text-muted-foreground' },
] as const;

function ConfigItemCard({
  item,
  onSave,
  isSaving,
  t,
}: {
  item: ConfigItem;
  onSave: (key: string, value: string) => void;
  isSaving: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const hasValue = item.value && item.value.length > 0;

  function startEdit() {
    setEditValue('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditValue('');
  }

  function handleSave() {
    onSave(item.key, editValue);
    setEditing(false);
    setEditValue('');
  }

  return (
    <div className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">{item.label}</h3>
            {hasValue ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {item.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        {!editing ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-muted-foreground">{t('currentValue')}: </span>
              {hasValue ? (
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {item.value}
                  {item.isSecret && <KeyRound className="inline h-3 w-3 ms-1 text-amber-500" />}
                </code>
              ) : (
                <span className="text-xs text-red-400 italic">{t('notConfigured')}</span>
              )}
            </div>
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors shrink-0"
            >
              <Pencil className="h-3 w-3" />
              {t('edit')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type={item.isSecret ? 'password' : 'text'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={item.isSecret ? t('secretHidden') : t('enterValue')}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={cancelEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                <X className="h-3 w-3" />
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !editValue.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {t('save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TestResultsPanel({
  data,
  t,
  onClose,
}: {
  data: TestData;
  t: ReturnType<typeof useTranslations>;
  onClose: () => void;
}) {
  return (
    <div className="mb-6 rounded-xl border bg-card overflow-hidden">
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between',
          data.success ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30',
        )}
      >
        <div className="flex items-center gap-2">
          {data.success ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          )}
          <span className="text-sm font-medium">{t('testResults')}</span>
          <span className="text-xs text-muted-foreground">— {data.message}</span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('closeResults')}
        </button>
      </div>
      {data.results && data.results.length > 0 && (
        <div className="divide-y">
          {data.results.map((result) => (
            <div key={result.key} className="px-4 py-3 flex items-center gap-3">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{result.label}</span>
                <p className="text-xs text-muted-foreground truncate">{result.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConfigPage() {
  const t = useTranslations('admin.config');
  const tc = useTranslations('admin.common');
  const addToast = useToastStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<string>('ai');

  const { data: configs, isLoading } = useAdminConfigs();
  const updateConfig = useUpdateConfig();
  const testConfig = useTestConfig();

  const [testingCategory, setTestingCategory] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestData>>({});

  function handleSave(key: string, value: string) {
    updateConfig.mutate(
      { key, value },
      {
        onSuccess: () => addToast('success', t('saved')),
        onError: () => addToast('error', tc('error')),
      },
    );
  }

  function handleTest(category: string) {
    setTestingCategory(category);
    testConfig.mutate(category, {
      onSuccess: (data: TestData) => {
        setTestResults((prev) => ({ ...prev, [category]: data }));
        if (data.success) {
          addToast('success', t('testSuccess'));
        } else {
          addToast('warning', t('testPartial'));
        }
        setTestingCategory(null);
      },
      onError: () => {
        addToast('error', t('testFailed'));
        setTestingCategory(null);
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categoryItems: ConfigItem[] = configs?.[activeTab] || [];
  const currentTestResult = testResults[activeTab];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeTab === cat.id;
          const catItems: ConfigItem[] = configs?.[cat.id] || [];
          const configuredCount = catItems.filter((i) => i.value && i.value.length > 0).length;
          const totalCount = catItems.length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t(cat.id as any)}</span>
              {totalCount > 0 && (
                <span
                  className={cn(
                    'text-[10px] rounded-full px-1.5 py-0.5 font-bold',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : configuredCount === totalCount
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
                  )}
                >
                  {configuredCount}/{totalCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Test Results */}
      {currentTestResult && (
        <TestResultsPanel
          data={currentTestResult}
          t={t}
          onClose={() => setTestResults((prev) => {
            const next = { ...prev };
            delete next[activeTab];
            return next;
          })}
        />
      )}

      {/* Tab Content */}
      <div className="rounded-xl border bg-card p-6">
        {/* Tab description */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t(activeTab as any)}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t(`${activeTab}Desc` as any)}
            </p>
          </div>
          <button
            onClick={() => handleTest(activeTab)}
            disabled={testingCategory === activeTab}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {testingCategory === activeTab ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('testing')}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {t('testConnection')}
              </>
            )}
          </button>
        </div>

        {/* Config Items Grid */}
        {categoryItems.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {categoryItems.map((item) => (
              <ConfigItemCard
                key={item.id}
                item={item}
                onSave={handleSave}
                isSaving={updateConfig.isPending}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Settings className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{tc('noData')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
