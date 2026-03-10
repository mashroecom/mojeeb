import { cn } from '@/lib/utils';

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
// Section Header with toggle
// ---------------------------------------------------------------------------

function SectionHeader({
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
// StatsSection Component
// ---------------------------------------------------------------------------

interface StatsSectionProps {
  enabled: boolean;
  onToggleEnabled: () => void;
  customers: string;
  onCustomersChange: (value: string) => void;
  messages: string;
  onMessagesChange: (value: string) => void;
  languages: string;
  onLanguagesChange: (value: string) => void;
  uptime: string;
  onUptimeChange: (value: string) => void;
  translations: {
    title: string;
    description: string;
    customersLabel: string;
    messagesLabel: string;
    languagesLabel: string;
    uptimeLabel: string;
  };
}

const inputCls =
  'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

export function StatsSection({
  enabled,
  onToggleEnabled,
  customers,
  onCustomersChange,
  messages,
  onMessagesChange,
  languages,
  onLanguagesChange,
  uptime,
  onUptimeChange,
  translations,
}: StatsSectionProps) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title={translations.title}
        description={translations.description}
        enabled={enabled}
        onToggle={onToggleEnabled}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">{translations.customersLabel}</label>
          <input
            type="text"
            value={customers}
            onChange={(e) => onCustomersChange(e.target.value)}
            placeholder="500+"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{translations.messagesLabel}</label>
          <input
            type="text"
            value={messages}
            onChange={(e) => onMessagesChange(e.target.value)}
            placeholder="10M+"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{translations.languagesLabel}</label>
          <input
            type="text"
            value={languages}
            onChange={(e) => onLanguagesChange(e.target.value)}
            placeholder="20+"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{translations.uptimeLabel}</label>
          <input
            type="text"
            value={uptime}
            onChange={(e) => onUptimeChange(e.target.value)}
            placeholder="99.9%"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
