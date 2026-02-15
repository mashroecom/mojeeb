'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  MessageSquare,
  Heart,
  GitBranch,
  UserCheck,
  BarChart3,
  Clock,
  Bot,
  Globe,
  Shield,
  Webhook,
  BookOpen,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const primaryFeatures = [
  { key: 'multichannel', icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10' },
  { key: 'emotion', icon: Heart, color: 'text-rose-500 bg-rose-500/10' },
  { key: 'routing', icon: GitBranch, color: 'text-amber-500 bg-amber-500/10' },
  { key: 'leads', icon: UserCheck, color: 'text-emerald-500 bg-emerald-500/10' },
  { key: 'analytics', icon: BarChart3, color: 'text-violet-500 bg-violet-500/10' },
  { key: 'availability', icon: Clock, color: 'text-cyan-500 bg-cyan-500/10' },
] as const;

const moreFeatures = [
  { key: 'aiAgents', icon: Bot, color: 'text-violet-500 bg-violet-500/10' },
  { key: 'multilingual', icon: Globe, color: 'text-blue-500 bg-blue-500/10' },
  { key: 'security', icon: Shield, color: 'text-emerald-500 bg-emerald-500/10' },
  { key: 'webhooks', icon: Webhook, color: 'text-amber-500 bg-amber-500/10' },
  { key: 'knowledgeBase', icon: BookOpen, color: 'text-rose-500 bg-rose-500/10' },
] as const;

export default function FeaturesPage() {
  const t = useTranslations('featuresPage');

  return (
    <div>
      {/* Hero */}
      <section className="py-20 sm:py-28">
        <div className="container max-w-4xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* Primary Features (detailed cards) */}
      <section className="border-t bg-muted/30 py-16 sm:py-24">
        <div className="container max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">{t('coreTitle')}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {primaryFeatures.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.key}
                  className="group rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className={cn('mb-4 inline-flex rounded-xl p-3', feat.color)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {t(`core.${feat.key}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t(`core.${feat.key}.description`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* More Features */}
      <section className="py-16 sm:py-24">
        <div className="container max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">{t('moreTitle')}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {moreFeatures.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.key}
                  className="flex gap-4 rounded-2xl border bg-card p-6"
                >
                  <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', feat.color)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold mb-1">
                      {t(`more.${feat.key}.title`)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(`more.${feat.key}.description`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30 py-16 sm:py-24">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{t('ctaTitle')}</h2>
          <p className="mt-4 text-muted-foreground">{t('ctaSubtitle')}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t('ctaButton')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              {t('ctaPricing')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
