'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* ---------------------------------- Card ---------------------------------- */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...rest}
    />
  ),
);
Card.displayName = 'Card';

/* ------------------------------- CardHeader ------------------------------- */

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...rest}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

/* -------------------------------- CardTitle ------------------------------- */

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...rest }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...rest}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

/* ----------------------------- CardDescription ---------------------------- */

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...rest }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...rest}
    />
  ),
);
CardDescription.displayName = 'CardDescription';

/* ------------------------------- CardContent ------------------------------ */

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn('p-6 pt-0', className)}
      {...rest}
    />
  ),
);
CardContent.displayName = 'CardContent';

/* ------------------------------- CardFooter ------------------------------- */

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...rest}
    />
  ),
);
CardFooter.displayName = 'CardFooter';
