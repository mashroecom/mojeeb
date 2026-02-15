'use client';

import { useEffect } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore, type ToastType } from '@/hooks/useToast';

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const variantStyles: Record<ToastType, string> = {
  success:
    'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
  error:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
};

const iconStyles: Record<ToastType, string> = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-600 dark:text-blue-400',
};

interface SingleToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  onRemove: (id: string) => void;
}

function SingleToast({ id, type, message, duration, onRemove }: SingleToastProps) {
  const Icon = icons[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);

  return (
    <ToastPrimitive.Root
      className={cn(
        'group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all',
        'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-full data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-end data-[state=closed]:fade-out-0',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        'data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-end',
        variantStyles[type],
      )}
      duration={duration}
      onOpenChange={(open) => {
        if (!open) onRemove(id);
      }}
    >
      <Icon className={cn('h-5 w-5 shrink-0', iconStyles[type])} />
      <ToastPrimitive.Description className="flex-1 text-sm font-medium">
        {message}
      </ToastPrimitive.Description>
      <ToastPrimitive.Close
        className={cn(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-opacity',
          'opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-1',
        )}
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}
      {toasts.map((t) => (
        <SingleToast
          key={t.id}
          id={t.id}
          type={t.type}
          message={t.message}
          duration={t.duration}
          onRemove={removeToast}
        />
      ))}
      <ToastViewport />
    </ToastPrimitive.Provider>
  );
}

export function ToastViewport() {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        'fixed z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4',
        'bottom-0 end-0 sm:max-w-[420px]',
      )}
    />
  );
}
