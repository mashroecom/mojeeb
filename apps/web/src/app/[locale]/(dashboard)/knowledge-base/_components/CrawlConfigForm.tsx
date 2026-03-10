'use client';

import React, { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, ChevronDown, Globe, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

interface CrawlConfigFormProps {
  kbId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CrawlConfigForm({ kbId, onSuccess, onCancel }: CrawlConfigFormProps) {
  const t = useTranslations('dashboard.knowledgeBase');
  const tc = useTranslations('common');
  const orgId = useAuthStore((s) => s.organization?.id);

  const [startUrl, setStartUrl] = useState('');
  const [crawlType, setCrawlType] = useState<'single' | 'multi'>('single');
  const [maxDepth, setMaxDepth] = useState(2);
  const [urlPatterns, setUrlPatterns] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!startUrl.trim()) {
      toast.error(t('urlValidation'));
      return;
    }

    // Basic URL validation
    try {
      new URL(startUrl);
    } catch {
      toast.error(t('urlValidation'));
      return;
    }

    setIsSubmitting(true);

    try {
      if (crawlType === 'single') {
        // For single page, add as a regular URL document
        await api.post(`/organizations/${orgId}/knowledge-bases/${kbId}/documents`, {
          title: new URL(startUrl).hostname,
          contentType: 'URL',
          sourceUrl: startUrl,
        });
        toast.success(t('documentAdded'));
      } else {
        // For multi-page, create a crawl job
        const payload: any = {
          startUrl,
          maxDepth: maxDepth,
        };

        if (urlPatterns.trim()) {
          payload.urlPatterns = urlPatterns.split(',').map(p => p.trim()).filter(Boolean);
        }

        await api.post(`/organizations/${orgId}/knowledge-bases/${kbId}/crawl`, payload);
        toast.success(t('crawlJobStarted'));
      }

      // Reset form
      setStartUrl('');
      setCrawlType('single');
      setMaxDepth(2);
      setUrlPatterns('');
      setShowAdvanced(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Crawl config error:', error);
      toast.error(error.response?.data?.message || t('crawlStartFailed'));
    } finally {
      setIsSubmitting(false);
    }
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
          onChange={(e) => setStartUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={isSubmitting}
          required
        />
        <p className="text-xs text-muted-foreground mt-1.5">{t('urlHint')}</p>
      </div>

      {/* Crawl Type */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t('crawlType')}
        </label>
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
          {crawlType === 'single'
            ? t('singlePageDescription')
            : t('multiPageDescription')}
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
                  onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {t('maxDepthHint')}
                </p>
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
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {t('urlPatternHint')}
                </p>
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
