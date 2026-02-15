'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ct = useTranslations('common');
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onCancel();
      }}
    >
      <div className="mx-4 w-full max-w-md animate-in fade-in zoom-in-95 rounded-xl border bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          {variant === 'danger' && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            {cancelLabel || ct('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {confirmLabel || ct('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage confirm dialog state.
 * Usage:
 *   const { confirmProps, confirm } = useConfirmDialog();
 *   ...
 *   confirm({
 *     title: 'Delete?',
 *     message: 'Are you sure?',
 *     onConfirm: () => doSomething(),
 *   });
 *   ...
 *   <ConfirmDialog {...confirmProps} />
 */
import { useState } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
}

export function useConfirmDialog() {
  const [state, setState] = useState<(ConfirmOptions & { open: true }) | { open: false }>({
    open: false,
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    setState({ ...options, open: true });
  }, []);

  const close = useCallback(() => {
    setState({ open: false });
  }, []);

  const confirmProps: ConfirmDialogProps = state.open
    ? {
        open: true,
        title: state.title,
        message: state.message,
        confirmLabel: state.confirmLabel,
        cancelLabel: state.cancelLabel,
        variant: state.variant,
        onConfirm: () => {
          state.onConfirm();
          close();
        },
        onCancel: close,
      }
    : {
        open: false,
        title: '',
        message: '',
        onConfirm: () => {},
        onCancel: () => {},
      };

  return { confirmProps, confirm };
}
