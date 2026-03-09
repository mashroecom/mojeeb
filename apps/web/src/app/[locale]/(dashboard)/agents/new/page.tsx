'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { Link, useRouter } from '@/i18n/navigation';
import { useCreateAgent } from '@/hooks/useAgents';
import { AGENT_TEMPLATES, type AgentTemplate } from '@/lib/agent-templates';
import { cn } from '@/lib/utils';
import { useZodForm } from '@/hooks/useZodForm';
import { createAgentSchema } from '@mojeeb/shared-utils';
import {
  ArrowLeft,
  Headphones,
  Briefcase,
  HelpCircle,
  Calendar,
  ShoppingCart,
  Bot,
  Globe,
  MessageCircle,
  ClipboardList,
  GraduationCap,
  Save,
  Loader2,
} from 'lucide-react';

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Headphones,
  Briefcase,
  HelpCircle,
  Calendar,
  ShoppingCart,
  Bot,
  Globe,
  MessageCircle,
  ClipboardList,
  GraduationCap,
};

const labelClass = 'block text-sm font-medium mb-1.5';
const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

export default function CreateAgentPage() {
  const t = useTranslations('dashboard.agents');
  const tt = useTranslations('dashboard.agents.templates');
  const router = useRouter();
  const createAgent = useCreateAgent();

  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  const form = useZodForm({
    schema: createAgentSchema,
    initialValues: {
      name: '',
      language: 'ar' as 'ar' | 'en',
      aiProvider: 'OPENAI' as const,
      aiModel: 'gpt-4o',
      enableLeadExtraction: false,
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    // Validate form
    const isValid = await form.handleSubmit();
    if (!isValid) {
      return;
    }

    const systemPrompt = selectedTemplate.systemPromptTemplate({
      agentName: form.values.name || '',
      language: form.values.language || 'ar',
      additionalInstructions: additionalInstructions.trim() || undefined,
    });

    createAgent.mutate(
      {
        name: form.values.name!,
        systemPrompt,
        templateType: selectedTemplate.id,
        aiProvider: 'OPENAI',
        aiModel: 'gpt-4o',
        language: form.values.language,
        temperature: selectedTemplate.defaultTemperature,
        maxTokens: selectedTemplate.defaultMaxTokens,
        enableEmotionDetection: selectedTemplate.enableEmotionDetection,
        enableLeadExtraction: form.values.enableLeadExtraction,
        enableHumanHandoff: selectedTemplate.enableHumanHandoff,
        handoffThreshold: selectedTemplate.handoffThreshold,
      },
      {
        onSuccess: () => {
          router.push('/agents');
        },
      },
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/agents"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold">{t('createAgent')}</h1>
      </div>

      {!selectedTemplate ? (
        /* ============================================================ */
        /* Step 1: Template Selection                                    */
        /* ============================================================ */
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="text-xl font-semibold">{t('chooseTemplate')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('chooseTemplateSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_TEMPLATES.map((template) => {
              const Icon = ICON_MAP[template.iconName] || Bot;
              return (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template);
                    form.setFieldValue('enableLeadExtraction', template.enableLeadExtraction);
                  }}
                  className="group rounded-xl border bg-card p-6 text-start shadow-sm transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold group-hover:text-primary">
                    {tt(template.nameKey)}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {tt(template.descriptionKey)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* Step 2: Customization Form                                    */
        /* ============================================================ */
        <div className="mx-auto max-w-2xl">
          {/* Change template button */}
          <button
            type="button"
            onClick={() => setSelectedTemplate(null)}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {t('changeTemplate')}
          </button>

          {/* Selected template badge */}
          <div className="mb-6 flex items-center gap-3">
            {(() => {
              const Icon = ICON_MAP[selectedTemplate.iconName] || Bot;
              return (
                <div className="inline-flex rounded-lg bg-primary/10 p-2.5">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              );
            })()}
            <div>
              <h2 className="text-lg font-semibold">
                {tt(selectedTemplate.nameKey)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {tt(selectedTemplate.descriptionKey)}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              {/* Agent Name */}
              <div>
                <label htmlFor="name" className={labelClass}>
                  {t('name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={form.values.name || ''}
                  onChange={form.handleChange('name')}
                  onBlur={form.handleBlur('name')}
                  placeholder={t('namePlaceholder')}
                  className={inputClass}
                />
                {form.errors.name && (
                  <p className="mt-1 text-xs text-destructive">{form.errors.name}</p>
                )}
              </div>

              {/* Language */}
              <div>
                <label htmlFor="language" className={labelClass}>
                  {t('language')}
                </label>
                <select
                  id="language"
                  value={form.values.language || 'ar'}
                  onChange={form.handleChange('language')}
                  onBlur={form.handleBlur('language')}
                  className={inputClass}
                >
                  <option value="ar">{t('languageAr')}</option>
                  <option value="en">{t('languageEn')}</option>
                </select>
                {form.errors.language && (
                  <p className="mt-1 text-xs text-destructive">{form.errors.language}</p>
                )}
              </div>

              {/* Additional Instructions */}
              <div>
                <label htmlFor="instructions" className={labelClass}>
                  {t('additionalInstructions')}
                </label>
                <textarea
                  id="instructions"
                  rows={4}
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  placeholder={t('additionalInstructionsPlaceholder')}
                  className={cn(inputClass, 'resize-y')}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t('additionalInstructionsHint')}
                </p>
              </div>

              {/* Enable Lead Extraction */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.values.enableLeadExtraction || false}
                  onClick={() => form.setFieldValue('enableLeadExtraction', !form.values.enableLeadExtraction)}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                    form.values.enableLeadExtraction ? 'bg-primary' : 'bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                      form.values.enableLeadExtraction ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0',
                    )}
                  />
                </button>
                <div>
                  <label className="text-sm font-medium">{t('enableLeadExtraction')}</label>
                  <p className="text-xs text-muted-foreground">{t('enableLeadExtractionHint')}</p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3">
              <Link
                href="/agents"
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t('cancel')}
              </Link>
              <button
                type="submit"
                disabled={createAgent.isPending || !form.values.name?.trim()}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                  (createAgent.isPending || !form.values.name?.trim()) &&
                    'cursor-not-allowed opacity-50',
                )}
              >
                {createAgent.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {createAgent.isPending ? '...' : t('createAgent')}
              </button>
            </div>

            {/* Error display */}
            {createAgent.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                {isAxiosError(createAgent.error) && createAgent.error.response?.status === 402
                  ? t('limitReached')
                  : t('somethingWentWrong')}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
