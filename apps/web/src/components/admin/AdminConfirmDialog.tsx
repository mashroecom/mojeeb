'use client';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const t = useTranslations('admin.common');
  const resolvedConfirmLabel = confirmLabel ?? t('confirm');
  const resolvedCancelLabel = cancelLabel ?? t('cancel');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={ref}
        className="relative w-full max-w-md rounded-xl border bg-card p-6 shadow-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 end-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          {isDanger && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50',
              isDanger ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {loading ? t('processing') : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
