'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const variantStyles = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary',
  danger:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
  ghost:
    'hover:bg-muted text-foreground focus-visible:ring-muted',
  outline:
    'border bg-background text-foreground hover:bg-muted focus-visible:ring-primary',
} as const;

const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 py-2.5 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2.5',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...rest}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
