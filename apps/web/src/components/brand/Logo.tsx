import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
  /** Accessible name; omit when the mark sits next to the written name */
  title?: string;
}

/**
 * The Mojeeb mark: a speech bubble carrying a check — a message that has been
 * answered. Colours follow the theme tokens, so it works in light and dark.
 */
export function LogoMark({ className, title }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('h-8 w-8 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="48" height="48" rx="13" className="fill-primary" />
      <path
        d="M14 16.5a4.5 4.5 0 0 1 4.5-4.5h11a4.5 4.5 0 0 1 4.5 4.5v8a4.5 4.5 0 0 1-4.5 4.5H24l-6.2 5.2c-.7.6-1.8.1-1.8-.8V29a4.5 4.5 0 0 1-2-3.7z"
        className="fill-primary-foreground"
      />
      <path
        d="M19.5 20.8l3.2 3.2 5.8-6"
        className="stroke-primary"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LogoProps {
  name: string;
  className?: string;
  markClassName?: string;
}

/** Mark and written name side by side. */
export function Logo({ name, className, markClassName }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={markClassName} />
      <span className="text-xl font-bold tracking-tight">{name}</span>
    </span>
  );
}

/** The brand name in the reader's language, unless the admin set a custom site name. */
export function brandName(siteName: string | undefined | null, locale: string): string {
  if (!siteName || siteName === 'Mojeeb') return locale === 'ar' ? 'مجيب' : 'Mojeeb';
  return siteName;
}
