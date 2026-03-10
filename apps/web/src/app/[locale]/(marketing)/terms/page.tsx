'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Scale } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function useLegalContent(type: string) {
  return useQuery({
    queryKey: ['public', 'legal', type],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/public/legal/${type}`);
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function TermsPage() {
  const t = useTranslations('terms');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { data, isLoading } = useLegalContent('terms');

  const content = data ? (isAr ? data.contentAr : data.contentEn) : null;
  const hasContent = content && content.trim().length > 0;
  const lastUpdated = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  // Fallback: hardcoded sections from translations
  const sections = [
    'intro',
    'acceptance',
    'services',
    'accounts',
    'usage',
    'intellectualProperty',
    'termination',
    'liability',
    'changes',
    'contact',
  ] as const;
  const sectionsWithItems = ['services', 'usage'];

  return (
    <div className="py-16 sm:py-24">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Scale className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t('title')}</h1>
          <p className="mt-4 text-muted-foreground">
            {lastUpdated ? `${t('lastUpdatedLabel')}: ${lastUpdated}` : t('lastUpdated')}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border bg-card p-6">
                <div className="h-6 w-1/3 bg-muted rounded mb-3" />
                <div className="h-4 w-full bg-muted rounded mb-2" />
                <div className="h-4 w-3/4 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : hasContent ? (
          /* Dynamic content from database */
          <div
            className="prose prose-gray dark:prose-invert max-w-none [&_h1]:text-2xl [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-medium [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:text-muted-foreground [&_li]:leading-relaxed [&_a]:text-primary"
            dir={isAr ? 'rtl' : 'ltr'}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          /* Fallback: static sections from translations */
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section} className="rounded-xl border bg-card p-6 sm:p-8">
                <h2 className="mb-4 text-xl font-semibold sm:text-2xl">{t(`${section}.title`)}</h2>
                <p className="leading-relaxed text-muted-foreground">{t(`${section}.content`)}</p>
                {sectionsWithItems.includes(section) && (
                  <ul className="mt-4 list-disc space-y-2 ps-6 text-muted-foreground">
                    {(t.raw(`${section}.items`) as string[]).map((item, index) => (
                      <li key={index} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Simple markdown to HTML renderer for legal content */
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)/, '<p>$1</p>');
}
