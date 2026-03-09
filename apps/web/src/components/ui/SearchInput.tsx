'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  onClear?: () => void;
  className?: string;
  clearLabel?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  onClear,
  className,
  clearLabel = 'Clear search',
}: SearchInputProps) {
  const [internal, setInternal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes
  useEffect(() => {
    setInternal(value);
  }, [value]);

  // Debounce internal -> external
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (internal !== value) {
        onChange(internal);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [internal, debounceMs]); // intentionally omit value/onChange to avoid loops

  const handleClear = () => {
    setInternal('');
    onChange('');
    onClear?.();
  };

  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground">
        <Search className="h-4 w-4" />
      </div>
      <input
        type="text"
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-10 w-full rounded-lg border bg-background ps-9 pe-9 text-sm outline-none transition-colors',
          'focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary',
          'placeholder:text-muted-foreground',
        )}
      />
      {internal && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
