'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

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
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Generate unique IDs for ARIA attributes
  const titleId = useRef(`confirm-dialog-title-${Math.random().toString(36).substr(2, 9)}`);
  const descriptionId = useRef(
    `confirm-dialog-description-${Math.random().toString(36).substr(2, 9)}`,
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
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          aria-modal="true"
          aria-labelledby={titleId.current}
          aria-describedby={descriptionId.current}
          className={cn(
            'fixed inset-x-4 top-[50%] z-50 mx-auto w-full max-w-md translate-y-[-50%] rounded-xl border bg-card p-6 shadow-lg',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2',
          )}
        >
          <div className="flex items-start gap-3">
            {variant === 'danger' && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            )}
            <div className="flex-1">
              <DialogPrimitive.Title id={titleId.current} className="text-base font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id={descriptionId.current}
                className="mt-1.5 text-sm text-muted-foreground"
              >
                {message}
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              ref={cancelButtonRef}
              onClick={onCancel}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {cancelLabel || ct('cancel')}
            </button>
            <button
              ref={confirmButtonRef}
              onClick={onConfirm}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                variant === 'danger'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {confirmLabel || ct('confirm')}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
