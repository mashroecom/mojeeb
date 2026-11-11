'use client';

import { useTranslations } from 'next-intl';
import { Globe, MessagesSquare, ShieldCheck, Users } from 'lucide-react';
import type { LandingCms } from './cms';

interface StatsSectionProps {
  /** Landing-page CMS content, loaded on the server by the page */
  cms: LandingCms;
}

const STATS = [
  { key: 'customers', field: 'statsCustomers', icon: Users },
  { key: 'messages', field: 'statsMessages', icon: MessagesSquare },
  { key: 'languages', field: 'statsLanguages', icon: Globe },
  { key: 'uptime', field: 'statsUptime', icon: ShieldCheck },
] as const;

/**
 * Key figures. The values are free text typed by the admin ("500+", "99.9%");
 * the labels come from the translations. A figure left empty is skipped.
 */
export function StatsSection({ cms }: StatsSectionProps) {
  const t = useTranslations('landing.stats');

  const stats = STATS.map((stat) => {
    const raw = cms?.[stat.field];
    return { ...stat, value: typeof raw === 'string' ? raw.trim() : '' };
  }).filter((stat) => stat.value);

  if (stats.length === 0) return null;

  return (
    <section id="stats" className="py-16">
      <div className="container">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map(({ key, value, icon: Icon }) => (
            <div
              key={key}
              className="flex flex-col items-center rounded-xl border bg-card p-6 text-center shadow-sm"
            >
              <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2.5 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              {/* dd before dt visually: the figure is the headline, the label explains it */}
              <dt className="order-2 mt-1 text-sm text-muted-foreground">{t(key)}</dt>
              <dd className="order-1 text-3xl font-bold tracking-tight sm:text-4xl">
                {/* <bdi> keeps "500+" / "99.9%" exactly as typed inside RTL text */}
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
