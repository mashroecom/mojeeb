'use client';

import React, { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, ChevronDown, Globe, Filter, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAddDocument, useStartCrawl } from '@/hooks/useKnowledgeBase';
import { toast } from '@/hooks/useToast';
import { useCrawlErrorMessage } from './crawlErrors';

/** Title for a single imported page: "example.com/returns" (the API caps titles at 200). */
function pageTitleFromUrl(url: URL): string {
  const path = url.pathname.replace(/\/$/, '');
  return `${url.hostname}${path}`.slice(0, 200);
}

interface CrawlConfigFormProps {
  kbId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CrawlConfigForm({ kbId, onSuccess, onCancel }: CrawlConfigFormProps) {
  const t = useTranslations('dashboard.knowledgeBase');
  const tc = useTranslations('common');
  const crawlError = useCrawlErrorMessage();
  const addDocumentMutation = useAddDocument();
  const startCrawlMutation = useStartCrawl();

  const [startUrl, setStartUrl] = useState('');
  const [crawlType, setCrawlType] = useState<'single' | 'multi'>('single');
  const [maxDepth, setMaxDepth] = useState(2);
  const [urlPatterns, setUrlPatterns] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Why the last attempt was refused (robots.txt, not a web page, ...): shown
  // next to the field so it stays visible after the toast is gone
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSubmitting = addDocumentMutation.isPending || startCrawlMutation.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(startUrl.trim());
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error();
    } catch {
      setSubmitError(t('urlValidation'));
      toast.error(t('urlValidation'));
      return;
    }

    const onDone = () => {
      setStartUrl('');
      setCrawlType('single');
      setMaxDepth(2);
      setUrlPatterns('');
      setShowAdvanced(false);
      onSuccess?.();
    };
    const onFailed = (fallback: string) => (error: unknown) => {
      const message = crawlError.fromApiError(error, fallback);
      setSubmitError(message);
      toast.error(message);
    };

    if (crawlType === 'single') {
      // A single page is added as a regular URL document
      addDocumentMutation.mutate(
        {
          kbId,
          title: pageTitleFromUrl(parsedUrl),
          contentType: 'URL',
          sourceUrl: parsedUrl.href,
        },
        {
          onSuccess: () => {
            toast.success(t('pageAdded'));
            onDone();
          },
          onError: onFailed(t('pageAddFailed')),
        },
      );
      return;
    }

    // Multi-page: start a crawl job; its progress shows in the crawls list
    const filters = urlPatterns
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    startCrawlMutation.mutate(
      {
        kbId,
        startUrl: parsedUrl.href,
        maxDepth,
        urlPatterns: filters.length > 0 ? filters : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('crawlStarted'));
          onDone();
        },
        onError: onFailed(t('crawlStartFailed')),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Start URL */}
      <div>
        <label htmlFor="startUrl" className="block text-sm font-medium mb-1.5">
          <Globe className="inline-block h-4 w-4 mr-1.5 rtl:mr-0 rtl:ml-1.5 -mt-0.5" />
          {t('websiteUrl')}
        </label>
        <input
          id="startUrl"
          type="url"
          value={startUrl}
          onChange={(e) => {
            setStartUrl(e.target.value);
            setSubmitError(null);
          }}
          placeholder="https://example.com"
          dir="ltr"
          aria-invalid={submitError ? true : undefined}
          aria-describedby={submitError ? 'startUrl-error' : undefined}
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
            submitError && 'border-destructive focus:ring-destructive/40',
          )}
          disabled={isSubmitting}
          required
        />
        {submitError ? (
          <p
            id="startUrl-error"
            role="alert"
            className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
            {submitError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1.5">{t('urlHint')}</p>
        )}
      </div>

      {/* Crawl Type */}
      <div>
        <label className="block text-sm font-medium mb-1.5">{t('crawlType')}</label>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="single"
              checked={crawlType === 'single'}
              onChange={(e) => setCrawlType(e.target.value as 'single' | 'multi')}
              className="h-4 w-4"
              disabled={isSubmitting}
            />
            <span className="text-sm">{t('singlePage')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="multi"
              checked={crawlType === 'multi'}
              onChange={(e) => setCrawlType(e.target.value as 'single' | 'multi')}
              className="h-4 w-4"
              disabled={isSubmitting}
            />
            <span className="text-sm">{t('multiPageCrawl')}</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {crawlType === 'single' ? t('singlePageDescription') : t('multiPageDescription')}
        </p>
      </div>

      {/* Advanced Options (only for multi-page) */}
      {crawlType === 'multi' && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-sm font-medium hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {t('advancedOptions')}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform rtl:-scale-x-100',
                showAdvanced && 'rotate-180',
              )}
            />
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 border-t pt-4">
              {/* Max Depth */}
              <div>
                <label htmlFor="maxDepth" className="block text-sm font-medium mb-1.5">
                  {t('maxDepth')}
                </label>
                <input
                  id="maxDepth"
                  type="number"
                  min="1"
                  max="5"
                  value={maxDepth}
                  onChange={(e) =>
                    setMaxDepth(Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1.5">{t('maxDepthHint')}</p>
              </div>

              {/* URL Pattern Filter */}
              <div>
                <label htmlFor="urlPatterns" className="block text-sm font-medium mb-1.5">
                  {t('urlPatternFilter')}
                </label>
                <input
                  id="urlPatterns"
                  type="text"
                  value={urlPatterns}
                  onChange={(e) => setUrlPatterns(e.target.value)}
                  placeholder="/docs/, /help/, /faq/"
                  dir="ltr"
                  maxLength={1000}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1.5">{t('urlFilterHint')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            {tc('cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !startUrl.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? t('starting') : crawlType === 'single' ? t('addPage') : t('startCrawl')}
        </button>
      </div>
    </form>
  );
}
