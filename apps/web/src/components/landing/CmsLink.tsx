'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { resolveCmsLink } from './cms';

interface CmsLinkProps {
  /** Admin-entered link (site-relative path, http(s) URL or `#anchor`) */
  href: string | null | undefined;
  /** Site-relative path used when `href` is empty or not an allowed URL */
  fallbackHref: string;
  className?: string;
  children: ReactNode;
}

/**
 * Link for admin-entered targets: internal paths go through the locale-aware
 * `<Link>`, external URLs open as plain anchors, anything else falls back.
 */
export function CmsLink({ href, fallbackHref, className, children }: CmsLinkProps) {
  const target = resolveCmsLink(href) ?? { kind: 'internal' as const, href: fallbackHref };

  if (target.kind === 'internal') {
    return (
      <Link href={target.href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={target.href}
      className={className}
      {...(target.kind === 'external' ? { rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}
