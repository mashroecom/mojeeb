'use client';

import { type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
} as const;

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: keyof typeof sizeStyles;
  children: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-4 top-[50%] z-50 mx-auto w-full translate-y-[-50%] rounded-xl border bg-card p-6 shadow-lg',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2',
            sizeStyles[size],
          )}
        >
          {title && (
            <DialogPrimitive.Title className="text-lg font-semibold leading-none">
              {title}
            </DialogPrimitive.Title>
          )}
          {description && (
            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          )}
          <div className={cn(title || description ? 'mt-4' : '')}>{children}</div>
          <DialogPrimitive.Close
            className={cn(
              'absolute end-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DialogOverlay({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
    />
  );
}

export function DialogTrigger({
  children,
  asChild,
}: {
  children: ReactNode;
  asChild?: boolean;
}) {
  return (
    <DialogPrimitive.Trigger asChild={asChild}>{children}</DialogPrimitive.Trigger>
  );
}
