'use client';

import { useId, type ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Form primitives shared by the admin settings tabs. */

export const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

const invalidClass =
  'border-destructive focus-visible:border-destructive focus-visible:ring-destructive';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function SettingsCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border bg-card shadow-sm', className)}>
      <div className="border-b px-5 py-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" />}
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Labelled field wrapper
// ---------------------------------------------------------------------------

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive" aria-live="polite">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'url' | 'tel' | 'number';
  placeholder?: string;
  hint?: string;
  error?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Force LTR for values that are always Latin (URLs, emails, IDs). */
  ltr?: boolean;
  name?: string;
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  error,
  maxLength,
  min,
  max,
  ltr,
  name,
}: TextFieldProps) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        inputMode={type === 'number' ? 'numeric' : undefined}
        dir={ltr || type === 'number' ? 'ltr' : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          inputClass,
          (ltr || type === 'number') && 'rtl:text-right',
          error && invalidClass,
        )}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  maxLength,
  rows = 3,
  ltr,
  rtl,
  mono,
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  maxLength?: number;
  rows?: number;
  ltr?: boolean;
  /** Force RTL for content that is always Arabic. */
  rtl?: boolean;
  mono?: boolean;
  name?: string;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        dir={ltr ? 'ltr' : rtl ? 'rtl' : undefined}
        aria-invalid={error ? true : undefined}
        className={cn(inputClass, 'resize-y', mono && 'font-mono text-xs', error && invalidClass)}
      />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  ltr,
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
  ltr?: boolean;
  name?: string;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={ltr ? 'ltr' : undefined}
        className={cn(inputClass, ltr && 'rtl:text-right')}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  error,
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  name?: string;
}) {
  const id = useId();
  const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <Field id={id} label={label} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={isHex ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border bg-background p-1"
        />
        <input
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          dir="ltr"
          placeholder="#6366f1"
          aria-invalid={error ? true : undefined}
          className={cn(inputClass, 'font-mono uppercase rtl:text-right', error && invalidClass)}
        />
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  name,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      name={name}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-green-500' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          checked ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

/** A label + description on one side and a switch on the other. */
export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  name,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} name={name} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save bar
// ---------------------------------------------------------------------------

export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel,
  savingLabel,
  discardLabel,
  unsavedLabel,
  children,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel: string;
  savingLabel: string;
  discardLabel: string;
  unsavedLabel: string;
  /** Extra actions rendered before the discard/save buttons. */
  children?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <p
        className={cn(
          'flex items-center gap-2 text-sm text-muted-foreground transition-opacity',
          dirty ? 'opacity-100' : 'opacity-0',
        )}
        aria-live="polite"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        {dirty ? unsavedLabel : ''}
      </p>
      <div className="flex items-center gap-2">
        {children}
        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty || saving}
          className="rounded-lg border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        >
          {discardLabel}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          data-testid="settings-save"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}
