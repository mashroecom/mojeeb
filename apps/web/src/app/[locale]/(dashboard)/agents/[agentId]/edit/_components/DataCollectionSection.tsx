'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Database, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DataCollectionConfig } from '@/hooks/useAgents';

interface DataCollectionSectionProps {
  config: DataCollectionConfig;
  setConfig: (config: DataCollectionConfig) => void;
}

const inputClass =
  'w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50';

export function DataCollectionSection({
  config,
  setConfig,
}: DataCollectionSectionProps) {
  const t = useTranslations('dashboard.agents');
  const [newFieldName, setNewFieldName] = useState('');

  const standardFields = [
    { value: 'name', label: t('fieldName') },
    { value: 'email', label: t('fieldEmail') },
    { value: 'phone', label: t('fieldPhone') },
  ];

  const strategies = [
    { value: 'natural' as const, label: t('strategyNatural') },
    { value: 'upfront' as const, label: t('strategyUpfront') },
    { value: 'end' as const, label: t('strategyEnd') },
  ];

  const toggleRequiredField = (field: string) => {
    const newRequired = config.requiredFields.includes(field)
      ? config.requiredFields.filter((f) => f !== field)
      : [...config.requiredFields, field];
    setConfig({ ...config, requiredFields: newRequired });
  };

  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    const fieldName = newFieldName.trim();
    const newField = {
      name: fieldName,
      type: 'text',
      label: fieldName,
      labelAr: fieldName,
    };
    setConfig({
      ...config,
      customFields: [...(config.customFields || []), newField],
    });
    setNewFieldName('');
  };

  const removeCustomField = (fieldName: string) => {
    setConfig({
      ...config,
      customFields: (config.customFields || []).filter(
        (f) => f.name !== fieldName,
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* Collection Strategy */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('collectionStrategy')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('collectionStrategyHint')}
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-3">
            {strategies.map((strategy) => (
              <button
                key={strategy.value}
                type="button"
                onClick={() =>
                  setConfig({ ...config, collectionStrategy: strategy.value })
                }
                className={cn(
                  'rounded-lg border px-4 py-3 text-start text-sm font-medium transition-colors',
                  config.collectionStrategy === strategy.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                {strategy.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Required Fields */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('requiredFields')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('requiredFieldsHint')}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {standardFields.map((field) => (
            <div key={field.value} className="flex items-center justify-between">
              <span className="text-sm">{field.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={config.requiredFields.includes(field.value)}
                onClick={() => toggleRequiredField(field.value)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  config.requiredFields.includes(field.value)
                    ? 'bg-primary'
                    : 'bg-muted',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                    config.requiredFields.includes(field.value)
                      ? 'ltr:translate-x-5 rtl:-translate-x-5'
                      : 'translate-x-0',
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Fields */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('customFields')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('customFieldsHint')}
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              placeholder={t('customFieldPlaceholder')}
              className={cn(inputClass, 'flex-1')}
              onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
            />
            <button
              type="button"
              onClick={addCustomField}
              disabled={!newFieldName.trim()}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                !newFieldName.trim() && 'cursor-not-allowed opacity-50',
              )}
            >
              <Plus className="h-4 w-4" />
              {t('add')}
            </button>
          </div>

          {config.customFields && config.customFields.length > 0 && (
            <div className="space-y-2">
              {config.customFields.map((field) => (
                <div
                  key={field.name}
                  className="flex items-center justify-between rounded-lg border px-4 py-2"
                >
                  <span className="text-sm">{field.label}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomField(field.name)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('confirmationEnabled')}</p>
              <p className="text-xs text-muted-foreground">
                {t('confirmationEnabledHint')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.confirmationEnabled ?? true}
              onClick={() =>
                setConfig({
                  ...config,
                  confirmationEnabled: !config.confirmationEnabled,
                })
              }
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                config.confirmationEnabled ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                  config.confirmationEnabled
                    ? 'ltr:translate-x-5 rtl:-translate-x-5'
                    : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
