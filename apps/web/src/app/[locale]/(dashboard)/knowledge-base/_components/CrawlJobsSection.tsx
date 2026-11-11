'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Globe, Loader2 } from 'lucide-react';
import { type CrawlJob, isCrawlJobActive } from '@/hooks/useKnowledgeBase';
import { CrawlProgressView } from './CrawlProgressView';

interface CrawlJobsSectionProps {
  kbId: string;
  jobs: CrawlJob[] | undefined;
  isError: boolean;
}

/** How many past crawls are listed before "Show all" */
const COLLAPSED_COUNT = 3;

/**
 * The website crawls of a knowledge base: whatever is queued or running (with
 * live progress) followed by the most recent finished ones. Renders nothing
 * for a knowledge base that never crawled a website.
 */
export function CrawlJobsSection({ kbId, jobs, isError }: CrawlJobsSectionProps) {
  const t = useTranslations('dashboard.knowledgeBase.crawlJobs');
  const [showAll, setShowAll] = useState(false);

  if (isError && !jobs) {
    return (
      <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>
      </div>
    );
  }
  if (!jobs || jobs.length === 0) return null;

  const anyActive = jobs.some(isCrawlJobActive);
  // Active jobs are never hidden behind "Show all"
  const visible = showAll
    ? jobs
    : jobs.filter((job, index) => index < COLLAPSED_COUNT || isCrawlJobActive(job));

  return (
    <section
      className="mb-6 rounded-xl border bg-card shadow-sm"
      aria-labelledby="crawl-jobs-title"
      data-testid="crawl-jobs"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <h2 id="crawl-jobs-title" className="text-lg font-semibold">
              {t('title')}
            </h2>
            {anyActive && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <ul className="divide-y border-t">
        {visible.map((job) => (
          <CrawlProgressView key={job.id} kbId={kbId} job={job} />
        ))}
      </ul>

      {jobs.length > visible.length || showAll ? (
        <div className="border-t px-6 py-3">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {showAll ? t('showFewer') : t('showAll', { count: jobs.length })}
          </button>
        </div>
      ) : null}
    </section>
  );
}
