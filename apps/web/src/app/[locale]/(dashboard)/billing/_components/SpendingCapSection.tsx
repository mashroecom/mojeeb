'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Section } from '../../settings/_components/SectionWrapper';
import { DollarSign, Save, Loader2, CheckCircle, Info } from 'lucide-react';
import { useState } from 'react';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

interface SpendingCapSectionProps {
  isLoading: boolean;
  spendingCapEnabled: boolean;
  spendingCapAmount: number;
  onSave: (enabled: boolean, amount?: number) => Promise<void>;
  isSaving: boolean;
  showSaved: boolean;
}

export function SpendingCapSection({
  isLoading,
  spendingCapEnabled: initialEnabled,
  spendingCapAmount: initialAmount,
  onSave,
  isSaving,
  showSaved,
}: SpendingCapSectionProps) {
  const t = useTranslations('dashboard.billing');

  const [enabled, setEnabled] = useState(initialEnabled);
  const [amount, setAmount] = useState(initialAmount?.toString() || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (enabled) {
      const numAmount = parseFloat(amount);
      if (!amount || isNaN(numAmount) || numAmount <= 0) {
        setError(t('spendingCapAmountError') || 'Please enter a valid amount greater than 0');
        return;
      }
      await onSave(true, numAmount);
    } else {
      await onSave(false);
    }
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setError(null);
  };

  const handleAmountChange = (value: string) => {
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  return (
    <Section icon={DollarSign} title={t('spendingCap') || 'Spending Cap'}>
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info banner */}
          <div className="flex gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-blue-900 dark:text-blue-200">
              {t('spendingCapDescription') || 'Set a maximum limit for overage charges. Once reached, AI features will be paused until the next billing cycle.'}
            </p>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="spendingCapEnabled" className="block text-sm font-medium">
                {t('spendingCapEnabled') || 'Enable Spending Cap'}
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('spendingCapEnabledHint') || 'Protect your budget from unexpected overage charges'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => handleToggle(!enabled)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                enabled ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
                  enabled ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </div>

          {/* Amount Input */}
          {enabled && (
            <div>
              <label htmlFor="spendingCapAmount" className="block text-sm font-medium mb-1.5">
                {t('spendingCapAmount') || 'Maximum Overage Amount (USD)'}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-muted-foreground text-sm">$</span>
                </div>
                <input
                  id="spendingCapAmount"
                  type="text"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="100.00"
                  className={cn(inputClass, 'pl-7', error && 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500')}
                  dir="ltr"
                />
              </div>
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                {t('spendingCapAmountHint') || 'Enter the maximum amount you want to spend on overages per billing cycle'}
              </p>
            </div>
          )}

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving || (enabled && !amount)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                (isSaving || (enabled && !amount)) && 'cursor-not-allowed opacity-50',
              )}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('saveChanges') || 'Save Changes'}
            </button>
            {showSaved && (
              <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                {t('saved') || 'Saved'}
              </span>
            )}
          </div>
        </form>
      )}
    </Section>
  );
}
