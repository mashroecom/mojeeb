'use client';

import { useTranslations } from 'next-intl';
import { Lightbulb, Brain, MessageSquare, Cpu } from 'lucide-react';
import { AI_MODELS } from '@mojeeb/shared-utils';
import { cn } from '@/lib/utils';

/** Which provider serves a model id (the provider is implied by the model). */
export function providerForModel(modelId: string): 'OPENAI' | 'ANTHROPIC' {
  return AI_MODELS.ANTHROPIC.some((m) => m.id === modelId) || modelId.startsWith('claude-')
    ? 'ANTHROPIC'
    : 'OPENAI';
}

interface BehaviorSectionProps {
  tone: string;
  setTone: (tone: string) => void;
  temperature: number;
  setTemperature: (temperature: number) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
  responseLength: string;
  setResponseLength: (length: string) => void;
}

export function BehaviorSection({
  tone,
  setTone,
  temperature,
  setTemperature,
  aiModel,
  setAiModel,
  responseLength,
  setResponseLength,
}: BehaviorSectionProps) {
  const t = useTranslations('dashboard.agents');

  const tones = [
    { value: 'friendly', label: t('toneFriendly') },
    { value: 'professional', label: t('toneProfessional') },
    { value: 'casual', label: t('toneCasual') },
    { value: 'formal', label: t('toneFormal') },
  ];

  const responseLengths = [
    { value: 'short', label: t('lengthShort') },
    { value: 'medium', label: t('lengthMedium') },
    { value: 'long', label: t('lengthLong') },
  ];

  return (
    <div className="space-y-6">
      {/* Tone */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('tone')}</h2>
            <p className="text-xs text-muted-foreground">{t('toneHint')}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tones.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTone(item.value)}
                className={cn(
                  'rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                  tone === item.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Temperature */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <Brain className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('creativity')}</h2>
            <p className="text-xs text-muted-foreground">{t('creativityHint')}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">{t('precise')}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground">{t('creative')}</span>
          </div>
          <div className="mt-2 text-center">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium">
              {temperature.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* AI model */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('aiModelLabel')}</h2>
            <p className="text-sm text-muted-foreground">{t('aiModelHint')}</p>
          </div>
        </div>
        <div className="p-6">
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            aria-label={t('aiModelLabel')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <optgroup label="Anthropic">
              {AI_MODELS.ANTHROPIC.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="OpenAI">
              {AI_MODELS.OPENAI.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
            {/* A model saved earlier that is no longer in the list stays selectable */}
            {![...AI_MODELS.ANTHROPIC, ...AI_MODELS.OPENAI].some((m) => m.id === aiModel) && (
              <option value={aiModel}>{aiModel}</option>
            )}
          </select>
        </div>
      </div>

      {/* Response Length */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('responseLength')}</h2>
            <p className="text-xs text-muted-foreground">{t('responseLengthHint')}</p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-3">
            {responseLengths.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setResponseLength(item.value)}
                className={cn(
                  'rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                  responseLength === item.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
