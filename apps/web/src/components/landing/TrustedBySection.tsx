'use client';

import { parseJsonArray, type TrustedByLogo } from '@/hooks/useLandingPage';
import { resolveCmsImageUrl } from './cms';

interface TrustedBySectionProps {
  title: string;
  /** `trustedByLogos` from the CMS (a JSON column: array or JSON string) */
  logos: TrustedByLogo[] | string | null | undefined;
}

/**
 * "Trusted by" logo strip. A logo without a usable image falls back to the
 * company name; with no logos at all the section renders nothing.
 */
export function TrustedBySection({ title, logos }: TrustedBySectionProps) {
  const items = parseJsonArray<TrustedByLogo>(logos, [])
    .filter((logo) => logo && typeof logo === 'object')
    .map((logo) => ({
      image: resolveCmsImageUrl(logo.image),
      name: typeof logo.name === 'string' ? logo.name.trim() : '',
    }))
    .filter((logo) => logo.image || logo.name);

  if (items.length === 0) return null;

  return (
    <section id="trusted-by" className="border-y bg-background py-12">
      <div className="container">
        <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
          {items.map((logo, i) => (
            <li key={i} className="flex items-center">
              {logo.image ? (
                <img
                  src={logo.image}
                  alt={logo.name}
                  loading="lazy"
                  className="h-8 w-auto max-w-[160px] object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 sm:h-10"
                />
              ) : (
                <span className="text-lg font-semibold text-muted-foreground">{logo.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
