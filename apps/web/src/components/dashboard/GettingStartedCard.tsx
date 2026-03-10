'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAgents } from '@/hooks/useAgents';
import { useChannels } from '@/hooks/useChannels';
import { cn } from '@/lib/utils';
import { Rocket, X, Bot, Globe, MessageSquare, Check, ArrowRight } from 'lucide-react';

const DISMISS_KEY = 'mojeeb_getting_started_dismissed';

export function GettingStartedCard() {
  const t = useTranslations('gettingStarted');
  const { data: agents } = useAgents();
  const { data: channels } = useChannels();
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
  }, []);

  const hasAgent = (agents?.length ?? 0) > 0;
  const hasChannel = (channels?.length ?? 0) > 0;
  // Consider "test agent" done if they have both an agent and a channel
  const hasTested = hasAgent && hasChannel;

  const steps = [
    {
      done: hasAgent,
      label: t('createAgent'),
      desc: t('createAgentDesc'),
      href: '/agents/new',
      icon: Bot,
    },
    {
      done: hasChannel,
      label: t('connectChannel'),
      desc: t('connectChannelDesc'),
      href: '/agents',
      icon: Globe,
    },
    {
      done: hasTested,
      label: t('testAgent'),
      desc: t('testAgentDesc'),
      href: hasAgent ? `/agents` : '/agents/new',
      icon: MessageSquare,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // Don't show if dismissed or all complete
  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <div className="mb-6 rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t('title')}</h3>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={t('dismiss')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Steps */}
      <div className="divide-y">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-center gap-4 px-6 py-4">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full shrink-0 transition-colors',
                  step.done
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {step.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.done && 'line-through text-muted-foreground',
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
              {step.done ? (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  {t('completed')}
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  {t('go')}
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="border-t px-6 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">
            {t('progressLabel', { count: completedCount, total: steps.length })}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
