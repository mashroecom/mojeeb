'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EscalationSectionProps {
  sentimentEscalation: boolean;
  setSentimentEscalation: (enabled: boolean) => void;
  escalationMessageCount: number;
  setEscalationMessageCount: (count: number) => void;
  escalationKeywords: string[];
  setEscalationKeywords: (keywords: string[]) => void;
}

const inputClass =
  'w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50';

export function EscalationSection({
  sentimentEscalation,
  setSentimentEscalation,
  escalationMessageCount,
  setEscalationMessageCount,
  escalationKeywords,
  setEscalationKeywords,
}: EscalationSectionProps) {
  const t = useTranslations('dashboard.agents');
  const [newKeyword, setNewKeyword] = useState('');

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    if (escalationKeywords.includes(newKeyword.trim())) return;
    setEscalationKeywords([...escalationKeywords, newKeyword.trim()]);
    setNewKeyword('');
  };

  const removeKeyword = (keyword: string) => {
    setEscalationKeywords(escalationKeywords.filter((k) => k !== keyword));
  };

  return (
    <div className="space-y-6">
      {/* Sentiment-based Escalation */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('sentimentEscalation')}</h2>
            <p className="text-xs text-muted-foreground">{t('sentimentEscalationHint')}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('enableSentiment')}</p>
              <p className="text-xs text-muted-foreground">{t('enableSentimentHint')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sentimentEscalation}
              onClick={() => setSentimentEscalation(!sentimentEscalation)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                sentimentEscalation ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                  sentimentEscalation ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Message Count Threshold */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('messageThreshold')}</h2>
            <p className="text-xs text-muted-foreground">{t('messageThresholdHint')}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              max="50"
              value={escalationMessageCount}
              onChange={(e) => setEscalationMessageCount(parseInt(e.target.value) || 5)}
              className={cn(inputClass, 'w-24')}
            />
            <span className="text-sm text-muted-foreground">{t('messages')}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('messageThresholdDescription')}</p>
        </div>
      </div>

      {/* Escalation Keywords */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('escalationKeywords')}</h2>
            <p className="text-xs text-muted-foreground">{t('escalationKeywordsHint')}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder={t('keywordPlaceholder')}
              className={cn(inputClass, 'flex-1')}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            />
            <button
              type="button"
              onClick={addKeyword}
              disabled={!newKeyword.trim()}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                !newKeyword.trim() && 'cursor-not-allowed opacity-50',
              )}
            >
              <Plus className="h-4 w-4" />
              {t('add')}
            </button>
          </div>

          {escalationKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {escalationKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 text-sm"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => removeKeyword(keyword)}
                    className="text-muted-foreground hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {escalationKeywords.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">{t('noKeywords')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
