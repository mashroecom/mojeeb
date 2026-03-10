'use client';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import * as DialogPrimitive from '@radix-ui/react-dialog';
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
  const isDanger = variant === 'danger';
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Generate unique IDs for ARIA attributes
  const titleId = useRef(`admin-confirm-dialog-title-${Math.random().toString(36).substr(2, 9)}`);
  const descriptionId = useRef(
    `admin-confirm-dialog-description-${Math.random().toString(36).substr(2, 9)}`,
  );

  // Auto-focus the appropriate button when dialog opens
  useEffect(() => {
    if (open) {
      // For danger dialogs, focus the cancel button to prevent accidental confirmation
      // For default dialogs, focus the confirm button
      const targetRef = variant === 'danger' ? cancelButtonRef : confirmButtonRef;
      targetRef.current?.focus();
    }
  }, [open, variant]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          aria-modal="true"
          aria-labelledby={titleId.current}
          aria-describedby={descriptionId.current}
          className={cn(
            'fixed inset-x-4 top-[50%] z-[100] mx-auto w-full max-w-md translate-y-[-50%] rounded-xl border bg-card p-6 shadow-xl',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2',
          )}
        >
          <DialogPrimitive.Close
            className={cn(
              'absolute end-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="flex items-start gap-3 mb-4">
            {isDanger && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            )}
            <div>
              <DialogPrimitive.Title id={titleId.current} className="text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id={descriptionId.current}
                className="text-sm text-muted-foreground mt-1"
              >
                {message}
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
            >
              {resolvedCancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:opacity-50',
                isDanger
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {loading ? t('processing') : resolvedConfirmLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
