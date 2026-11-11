'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Quote, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicTestimonial } from '@/hooks/useLandingPage';
import { localized, resolveCmsImageUrl } from './cms';

interface TestimonialsSectionProps {
  title: string;
  subtitle: string;
  /** Active testimonials from GET /public/testimonials, already in display order */
  testimonials: PublicTestimonial[];
  /** `testimonialsMaxDisplay` from the CMS */
  maxDisplay: number;
}

const MAX_RATING = 5;

/** Customer quotes. Renders nothing when there are no testimonials to show. */
export function TestimonialsSection({
  title,
  subtitle,
  testimonials,
  maxDisplay,
}: TestimonialsSectionProps) {
  const t = useTranslations('landing.testimonials');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const items = testimonials
    .map((item) => ({
      id: item.id,
      name: localized(isAr, item.name, item.nameAr),
      // "Role · Company" — either part may be missing
      byline: [localized(isAr, item.role, item.roleAr), (item.company || '').trim()]
        .filter(Boolean)
        .join(' · '),
      content: localized(isAr, item.content, item.contentAr),
      photo: resolveCmsImageUrl(item.photoUrl),
      rating: Math.max(0, Math.min(MAX_RATING, Math.round(Number(item.rating) || 0))),
    }))
    .filter((item) => item.content)
    .slice(0, maxDisplay);

  if (items.length === 0) return null;

  return (
    <section id="testimonials" className="py-20 bg-muted/30 scroll-mt-16">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>
        </div>

        <div
          className={cn(
            'mx-auto grid grid-cols-1 gap-8',
            items.length === 1 && 'max-w-2xl',
            items.length === 2 && 'max-w-4xl md:grid-cols-2',
            items.length >= 3 && 'md:grid-cols-2 lg:grid-cols-3',
          )}
        >
          {items.map((item) => (
            <figure
              key={item.id}
              className="flex flex-col rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
            >
              <div className="mb-4 flex items-center justify-between">
                {item.rating > 0 ? (
                  <div
                    className="flex items-center gap-0.5"
                    role="img"
                    aria-label={t('ratingLabel', { rating: item.rating, max: MAX_RATING })}
                  >
                    {Array.from({ length: MAX_RATING }, (_, i) => (
                      <Star
                        key={i}
                        aria-hidden="true"
                        className={cn(
                          'h-4 w-4',
                          i < item.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/30',
                        )}
                      />
                    ))}
                  </div>
                ) : (
                  <span />
                )}
                <Quote className="h-6 w-6 text-primary/20 rtl:-scale-x-100" aria-hidden="true" />
              </div>

              <blockquote className="flex-1 text-sm leading-relaxed text-foreground/90">
                {item.content}
              </blockquote>

              <figcaption className="mt-6 flex items-center gap-3 border-t pt-4">
                {item.photo ? (
                  <img
                    src={item.photo}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{item.name}</div>
                  {item.byline && (
                    <div className="text-xs text-muted-foreground">{item.byline}</div>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
