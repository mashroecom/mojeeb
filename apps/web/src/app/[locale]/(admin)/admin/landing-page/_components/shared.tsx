'use client';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

export function ToggleSwitch({
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
// Section Header with toggle
// ---------------------------------------------------------------------------

export function SectionHeader({
  title,
  description,
  enabled,
  onToggle,
  showToggle = true,
}: {
  title: string;
  description: string;
  enabled?: boolean;
  onToggle?: () => void;
  showToggle?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4 border-b mb-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {showToggle && onToggle && (
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'text-xs font-medium',
              enabled ? 'text-green-600' : 'text-muted-foreground',
            )}
          >
            {enabled ? 'ON' : 'OFF'}
          </span>
          <ToggleSwitch value={!!enabled} onChange={onToggle} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Language Tabs
// ---------------------------------------------------------------------------

export function LangTabs({ lang, setLang }: { lang: 'en' | 'ar'; setLang: (l: 'en' | 'ar') => void }) {
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
