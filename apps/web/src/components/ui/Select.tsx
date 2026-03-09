'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...rest }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors',
            'focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error && selectId ? `${selectId}-error` : undefined}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p
            id={selectId ? `${selectId}-error` : undefined}
            className="mt-1.5 text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
