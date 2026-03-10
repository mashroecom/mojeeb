'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { useAuthStore } from '@/stores/authStore';
import { AGENT_TEMPLATES, type AgentTemplate } from '@/lib/agent-templates';
import { api } from '@/lib/api';
import { setOnboardingCookie } from '@/lib/auth-cookies';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { TestChat } from './_components/TestChat';
import { Confetti } from './_components/Confetti';
import {
  Bot,
  Globe,
  MessageCircle,
  Check,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Sparkles,
  Headphones,
  Briefcase,
  HelpCircle,
  Calendar,
  ShoppingCart,
  ClipboardList,
  GraduationCap,
  Building2,
  BookOpen,
  Plug,
  MessageSquare,
  PartyPopper,
  SkipForward,
  Upload,
  Link as LinkIcon,
  FileText,
  Lightbulb,
  Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const STEPS = ['company', 'agent', 'knowledge', 'channel', 'test', 'done'] as const;
type Step = (typeof STEPS)[number];

const STEP_ICONS: Record<Step, React.ComponentType<{ className?: string }>> = {
  company: Building2,
  agent: Bot,
  knowledge: BookOpen,
  channel: Plug,
  test: MessageSquare,
  done: Check,
};

const INDUSTRIES = [
  'ecommerce',
  'healthcare',
  'education',
  'restaurant',
  'realEstate',
  'services',
  'technology',
  'other',
] as const;

const STORAGE_KEY = 'mojeeb_onboarding_step';

const INPUT_CLASS =
  'w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30';

/** Build a locale-aware absolute path for hard navigation */
function localePath(path: string, locale: string) {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({ currentStep }: { currentStep: Step }) {
  const t = useTranslations('onboarding.progress');
  const currentIdx = STEPS.indexOf(currentStep);

  return (
    <nav className="mb-8" aria-label="Onboarding progress">
      {/* Progress line */}
      <div className="relative mx-auto max-w-2xl mb-4">
        <div className="absolute top-4 start-[calc(100%/12)] end-[calc(100%/12)] h-0.5 bg-muted" />
        <div
          className="absolute top-4 start-[calc(100%/12)] h-0.5 bg-primary transition-all duration-500 ease-in-out"
          style={{ width: `${(currentIdx / (STEPS.length - 1)) * (100 - 100 / 6)}%` }}
        />
      </div>

      <div className="flex items-start justify-between mx-auto max-w-2xl">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isActive = idx === currentIdx;
          const Icon = STEP_ICONS[step];
          return (
            <div key={step} className="flex flex-col items-center w-16 sm:w-20">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all duration-300',
                  isCompleted && 'bg-green-500 text-white scale-90',
                  isActive && 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110',
                  !isCompleted && !isActive && 'bg-muted text-muted-foreground',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-[10px] sm:text-[11px] font-medium text-center leading-tight hidden sm:block',
                  isActive
                    ? 'text-primary'
                    : isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-muted-foreground',
                )}
              >
                {t(step)}
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Bottom nav bar (shared by steps)
// ---------------------------------------------------------------------------

function StepNav({
  onBack,
  onSkip,
  onNext,
  showBack = true,
  showSkip = false,
  showNext = false,
  nextLabel,
  backLabel,
  skipLabel,
}: {
  onBack?: () => void;
  onSkip?: () => void;
  onNext?: () => void;
  showBack?: boolean;
  showSkip?: boolean;
  showNext?: boolean;
  nextLabel?: string;
  backLabel?: string;
  skipLabel?: string;
}) {
  const ts = useTranslations('onboarding');
  return (
    <div className="mt-8 flex items-center justify-between border-t pt-5">
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel || ts('back')}
        </button>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-3">
        {showSkip && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {skipLabel || ts('skip')}
          </button>
        )}
        {showNext && onNext && (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {nextLabel || ts('next')}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Company Info
// ---------------------------------------------------------------------------

function CompanyStep({
  onNext,
  onSkip,
  formData,
  onFormChange,
}: {
  onNext: () => void;
  onSkip: () => void;
  formData: { name: string; industry: string; websiteUrl: string };
  onFormChange: (data: { name: string; industry: string; websiteUrl: string }) => void;
}) {
  const t = useTranslations('onboarding.companyInfo');
  const ts = useTranslations('onboarding');
  const user = useAuthStore((s) => s.user);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/setup/company', {
        name: formData.name.trim(),
        industry: formData.industry || undefined,
        websiteUrl: formData.websiteUrl.trim() || undefined,
      });
      onNext();
    } catch {
      toast.error(ts('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex rounded-full bg-primary/10 p-4">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">{t('title', { name: user?.firstName || '' })}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
        {/* Company Name */}
        <div>
          <label htmlFor="company-name" className="mb-1.5 block text-sm font-medium">
            {t('nameLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            id="company-name"
            type="text"
            value={formData.name}
            onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
            placeholder={t('namePlaceholder')}
            className={INPUT_CLASS}
            autoFocus
          />
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="company-industry" className="mb-1.5 block text-sm font-medium">
            {t('industryLabel')}
          </label>
          <select
            id="company-industry"
            value={formData.industry}
            onChange={(e) => onFormChange({ ...formData, industry: e.target.value })}
            className={INPUT_CLASS}
          >
            <option value="">{t('industryPlaceholder')}</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {t(`industry_${ind}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Website URL */}
        <div>
          <label htmlFor="company-website" className="mb-1.5 block text-sm font-medium">
            {t('websiteLabel')}
          </label>
          <input
            id="company-website"
            type="url"
            value={formData.websiteUrl}
            onChange={(e) => onFormChange({ ...formData, websiteUrl: e.target.value })}
            placeholder="https://example.com"
            className={cn(INPUT_CLASS, 'dir-ltr')}
            dir="ltr"
          />
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !formData.name.trim()}
          className={cn(
            'w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
            (saving || !formData.name.trim()) && 'cursor-not-allowed opacity-50',
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {ts('saving')}
            </>
          ) : (
            <>
              {t('saveButton')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </>
          )}
        </button>
      </div>

      {/* Skip */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <SkipForward className="h-3.5 w-3.5" />
          {ts('skipAll')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Create Agent
// ---------------------------------------------------------------------------

function AgentStep({
  onNext,
  onSkip,
  onBack,
  onAgentCreated,
  existingAgentId,
}: {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  onAgentCreated: (agentId: string, agentName: string) => void;
  existingAgentId: string | null;
}) {
  const t = useTranslations('onboarding.createAgent');
  const ts = useTranslations('onboarding');
  const tt = useTranslations('dashboard.agents.templates');

  const locale = useLocale();
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<'ar' | 'en'>(locale === 'ar' ? 'ar' : 'en');
  const [instructions, setInstructions] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // If agent already exists (from resumed session), let user skip ahead
  const alreadyCreated = !!existingAgentId;

  const handleCreate = async () => {
    if (!selectedTemplate || !name.trim()) return;
    setCreating(true);
    setCreateError('');

    const systemPrompt = selectedTemplate.systemPromptTemplate({
      agentName: name,
      language,
      additionalInstructions: instructions.trim() || undefined,
    });

    try {
      const res = await api.post('/setup/agent', {
        name,
        systemPrompt,
        templateType: selectedTemplate.id,
        language,
        temperature: selectedTemplate.defaultTemperature,
        maxTokens: selectedTemplate.defaultMaxTokens,
        enableEmotionDetection: selectedTemplate.enableEmotionDetection,
        enableLeadExtraction: selectedTemplate.enableLeadExtraction,
        enableHumanHandoff: selectedTemplate.enableHumanHandoff,
        handoffThreshold: selectedTemplate.handoffThreshold,
      });
      const agent = res.data.data;
      onAgentCreated(agent.id, agent.name);
      onNext();
    } catch (err: any) {
      setCreateError(ts('genericError'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {alreadyCreated && (
        <div className="mx-auto max-w-lg mb-6 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
          <Check className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">{t('created')}</p>
        </div>
      )}

      {!selectedTemplate ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_TEMPLATES.map((template) => {
            const Icon = ICON_MAP[template.iconName] || Bot;
            return (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className="group rounded-xl border bg-card p-5 text-start shadow-sm transition-all hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2.5">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold group-hover:text-primary">
                  {tt(template.nameKey)}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {tt(template.descriptionKey)}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => setSelectedTemplate(null)}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {ts('back')}
          </button>

          <div className="mb-6 flex items-center gap-3 rounded-lg border bg-primary/5 p-3">
            {(() => {
              const Icon = ICON_MAP[selectedTemplate.iconName] || Bot;
              return (
                <div className="inline-flex rounded-lg bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              );
            })()}
            <div>
              <p className="text-sm font-semibold">{tt(selectedTemplate.nameKey)}</p>
              <p className="text-xs text-muted-foreground">{tt(selectedTemplate.descriptionKey)}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="agent-name" className="mb-1.5 block text-sm font-medium">
                {t('nameLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                id="agent-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className={INPUT_CLASS}
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">{t('nameHint')}</p>
            </div>

            <div>
              <label htmlFor="agent-language" className="mb-1.5 block text-sm font-medium">
                {t('languageLabel')}
              </label>
              <select
                id="agent-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'ar' | 'en')}
                className={INPUT_CLASS}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <label htmlFor="agent-instructions" className="mb-1.5 block text-sm font-medium">
                {t('instructionsLabel')}
              </label>
              <textarea
                id="agent-instructions"
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t('instructionsPlaceholder')}
                className={cn(INPUT_CLASS, 'resize-y')}
              />
              <div className="mt-1 flex items-start gap-1.5">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <p className="text-xs text-muted-foreground">{t('instructionsHint')}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                (creating || !name.trim()) && 'cursor-not-allowed opacity-50',
              )}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4" />
                  {t('createButton')}
                </>
              )}
            </button>

            {createError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                {createError}
              </div>
            )}
          </div>
        </div>
      )}

      <StepNav
        onBack={onBack}
        onSkip={onSkip}
        onNext={alreadyCreated ? onNext : undefined}
        showBack
        showSkip
        showNext={alreadyCreated}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Knowledge Base
// ---------------------------------------------------------------------------

function KnowledgeStep({
  onNext,
  onSkip,
  onBack,
  agentId,
  onKbAdded,
  kbCount: initialKbCount,
}: {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  agentId: string | null;
  onKbAdded: (count: number) => void;
  kbCount: number;
}) {
  const t = useTranslations('onboarding.trainAgent');
  const ts = useTranslations('onboarding');

  const [tab, setTab] = useState<'text' | 'url' | 'file'>('text');
  const [textContent, setTextContent] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(initialKbCount);

  const handleAddText = async () => {
    if (!textContent.trim() || !agentId) return;
    setSaving(true);
    try {
      await api.post('/setup/knowledge-base', {
        agentId,
        documents: [
          { title: t('defaultDocTitle'), content: textContent.trim(), contentType: 'TEXT' },
        ],
      });
      const newCount = addedCount + 1;
      setAddedCount(newCount);
      onKbAdded(newCount);
      setTextContent('');
      toast.success(t('docAdded'));
    } catch {
      toast.error(ts('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddUrl = async () => {
    if (!urlValue.trim() || !agentId) return;
    setSaving(true);
    try {
      await api.post('/setup/knowledge-base', {
        agentId,
        documents: [{ title: urlValue.trim(), contentType: 'URL', sourceUrl: urlValue.trim() }],
      });
      const newCount = addedCount + 1;
      setAddedCount(newCount);
      onKbAdded(newCount);
      setUrlValue('');
      toast.success(t('docAdded'));
    } catch {
      toast.error(ts('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agentId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('fileTooLarge'));
      return;
    }

    setSaving(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await api.post('/setup/knowledge-base', {
        agentId,
        documents: [{ title: file.name, contentType: 'PDF', fileBase64: base64 }],
      });
      const newCount = addedCount + 1;
      setAddedCount(newCount);
      onKbAdded(newCount);
      toast.success(t('docAdded'));
    } catch {
      toast.error(ts('saveFailed'));
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const tabs = [
    { key: 'text' as const, icon: FileText, label: t('tabText') },
    { key: 'url' as const, icon: LinkIcon, label: t('tabUrl') },
    { key: 'file' as const, icon: Upload, label: t('tabFile') },
  ];

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {!agentId ? (
        <div className="mx-auto max-w-lg text-center py-8">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground opacity-40 mb-3" />
          <p className="text-sm text-muted-foreground">{t('noAgent')}</p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg">
          {/* Tab selector */}
          <div className="flex rounded-lg border bg-muted/30 overflow-hidden mb-6">
            {tabs.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors',
                  tab === key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Text tab */}
          {tab === 'text' && (
            <div className="space-y-4">
              <textarea
                rows={6}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder={t('textPlaceholder')}
                className={cn(INPUT_CLASS, 'resize-y')}
              />
              <button
                type="button"
                onClick={handleAddText}
                disabled={saving || !textContent.trim()}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                  (saving || !textContent.trim()) && 'cursor-not-allowed opacity-50',
                )}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {t('addButton')}
              </button>
            </div>
          )}

          {/* URL tab */}
          {tab === 'url' && (
            <div className="space-y-4">
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder={t('urlPlaceholder')}
                className={INPUT_CLASS}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">{t('urlHint')}</p>
              <button
                type="button"
                onClick={handleAddUrl}
                disabled={saving || !urlValue.trim()}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                  (saving || !urlValue.trim()) && 'cursor-not-allowed opacity-50',
                )}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                {t('importButton')}
              </button>
            </div>
          )}

          {/* File tab */}
          {tab === 'file' && (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 p-8 cursor-pointer hover:bg-muted/40 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm font-medium">{t('fileDropLabel')}</span>
                <span className="text-xs text-muted-foreground mt-1">{t('fileTypes')}</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {saving && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('processing')}
                </div>
              )}
            </div>
          )}

          {/* Added count */}
          {addedCount > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
              <Check className="h-4 w-4" />
              {t('itemsAdded', { count: addedCount })}
            </div>
          )}
        </div>
      )}

      <StepNav
        onBack={onBack}
        onSkip={onSkip}
        onNext={addedCount > 0 ? onNext : undefined}
        showBack
        showSkip
        showNext={addedCount > 0}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Connect Channel
// ---------------------------------------------------------------------------

function ChannelStep({
  onNext,
  onSkip,
  onBack,
  agentId,
  onChannelCreated,
  channelCreated,
}: {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  agentId: string | null;
  onChannelCreated: () => void;
  channelCreated: boolean;
}) {
  const t = useTranslations('onboarding.connectChannel');
  const ts = useTranslations('onboarding');
  const [channelName, setChannelName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  const handleConnect = async () => {
    if (!channelName.trim()) return;
    setIsConnecting(true);
    setConnectError('');

    try {
      await api.post('/setup/channel', {
        type: 'WEBCHAT',
        name: channelName.trim(),
        credentials: {},
        agentId: agentId || undefined,
      });
      setIsConnecting(false);
      onChannelCreated();
      onNext();
    } catch (err: any) {
      setIsConnecting(false);
      setConnectError(ts('genericError'));
    }
  };

  const otherChannels = [
    { icon: MessageCircle, name: 'WhatsApp', color: 'bg-green-500' },
    { icon: MessageCircle, name: 'Messenger', color: 'bg-blue-500' },
    { icon: MessageCircle, name: 'Instagram', color: 'bg-pink-500' },
  ];

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="mx-auto max-w-lg space-y-6">
        {channelCreated && (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              {t('connected')}
            </p>
          </div>
        )}

        {/* WebChat */}
        <div className="rounded-xl border-2 border-primary/30 bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500 shrink-0">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{t('webchatTitle')}</h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {t('webchatRecommended')}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t('webchatDesc')}</p>

              <div className="mt-4">
                <label htmlFor="channel-name" className="mb-1.5 block text-sm font-medium">
                  {t('webchatNameLabel')}
                </label>
                <input
                  id="channel-name"
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder={t('webchatNamePlaceholder')}
                  className={INPUT_CLASS}
                />
              </div>

              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting || !channelName.trim()}
                className={cn(
                  'mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                  (isConnecting || !channelName.trim()) && 'cursor-not-allowed opacity-50',
                )}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('connecting')}
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    {t('connectButton')}
                  </>
                )}
              </button>

              {connectError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  {connectError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Other channels */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-muted-foreground">
            {t('otherChannelsTitle')}
          </h4>
          <p className="mb-3 text-xs text-muted-foreground">{t('otherChannelsDesc')}</p>
          <div className="flex flex-wrap gap-2">
            {otherChannels.map((ch) => {
              const Icon = ch.icon;
              return (
                <div
                  key={ch.name}
                  className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 opacity-60"
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                      ch.color,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm font-medium">{ch.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <StepNav
        onBack={onBack}
        onSkip={onSkip}
        onNext={channelCreated ? onNext : undefined}
        showBack
        showSkip
        showNext={channelCreated}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Test Agent
// ---------------------------------------------------------------------------

function TestStep({
  onNext,
  onBack,
  agentId,
  agentName,
}: {
  onNext: () => void;
  onBack: () => void;
  agentId: string | null;
  agentName?: string;
}) {
  const t = useTranslations('onboarding.testAgent');
  const ts = useTranslations('onboarding');

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {agentId ? (
        <TestChat agentId={agentId} agentName={agentName || 'Agent'} />
      ) : (
        <div className="mx-auto max-w-lg text-center py-12">
          <Bot className="mx-auto h-10 w-10 text-muted-foreground opacity-40 mb-3" />
          <p className="text-sm text-muted-foreground">{t('noAgent')}</p>
        </div>
      )}

      <StepNav onBack={onBack} onNext={onNext} showBack showNext nextLabel={t('continueButton')} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6: Complete
// ---------------------------------------------------------------------------

function CompleteStep({
  agentCreated,
  channelCreated,
  kbCount,
  companyName,
  agentName,
}: {
  agentCreated: boolean;
  channelCreated: boolean;
  kbCount: number;
  companyName: string;
  agentName: string;
}) {
  const t = useTranslations('onboarding.complete');
  const locale = useLocale();
  const [showConfetti, setShowConfetti] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const completeAndNavigate = async (destination: string) => {
    if (completing) return;
    setCompleting(true);
    try {
      await api.post('/setup/complete');
    } catch {
      // best-effort — let user through even if the API fails
    }
    setOnboardingCookie(true);
    localStorage.removeItem(STORAGE_KEY);
    // Hard redirect to bypass React router race conditions with AuthGuard
    window.location.href = localePath(destination, locale);
  };

  const items = [
    {
      done: !!companyName,
      label: companyName ? t('companyReady', { name: companyName }) : t('companySkipped'),
      icon: Building2,
    },
    {
      done: agentCreated,
      label: agentCreated ? t('agentReady', { name: agentName || '' }) : t('agentSkipped'),
      icon: Bot,
    },
    {
      done: kbCount > 0,
      label: kbCount > 0 ? t('kbReady', { count: kbCount }) : t('kbSkipped'),
      icon: BookOpen,
    },
    {
      done: channelCreated,
      label: channelCreated ? t('channelReady') : t('channelSkipped'),
      icon: Plug,
    },
  ];

  return (
    <div className="mx-auto max-w-lg text-center">
      {showConfetti && <Confetti />}

      <div className="mb-6 inline-flex rounded-full bg-green-100 p-4 dark:bg-green-900/30">
        <PartyPopper className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-8 space-y-3 text-start">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-4',
                item.done
                  ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                  : 'bg-card',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                  item.done ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                {item.done ? <Check className="h-4 w-4" /> : <SkipForward className="h-4 w-4" />}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Icon
                  className={cn(
                    'h-4 w-4',
                    item.done ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    item.done ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => completeAndNavigate('/dashboard')}
          disabled={completing}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90',
            completing && 'opacity-50 cursor-not-allowed',
          )}
        >
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          )}
          {t('goToDashboard')}
        </button>
        <button
          type="button"
          onClick={() => completeAndNavigate('/team')}
          disabled={completing}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted',
            completing && 'opacity-50 cursor-not-allowed',
          )}
        >
          <Users className="h-4 w-4" />
          {t('inviteTeam')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard Page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const locale = useLocale();
  const org = useAuthStore((s) => s.organization);

  const [step, setStep] = useState<Step>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && STEPS.includes(saved as Step)) return saved as Step;
    }
    return 'company';
  });

  // Track transition direction for animation
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [animating, setAnimating] = useState(false);

  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentCreated, setAgentCreated] = useState(false);
  const [channelCreated, setChannelCreated] = useState(false);
  const [kbCount, setKbCount] = useState(0);

  // Persist company form data for back navigation
  const [companyForm, setCompanyForm] = useState({
    name: org?.name || '',
    industry: '',
    websiteUrl: '',
  });

  // Load setup status on mount to resume progress
  useEffect(() => {
    api
      .get('/setup/status')
      .then((res) => {
        const status = res.data?.data;
        if (status?.agentId) {
          setCreatedAgentId(status.agentId);
          setAgentCreated(true);
        }
        if (status?.channel) setChannelCreated(true);
        if (status?.knowledgeBase) setKbCount(1);
        if (status?.company && org) {
          setCompanyForm((prev) => ({ ...prev, name: org.name }));
        }
      })
      .catch(() => {});
  }, []);

  // Persist step
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, step);
  }, [step]);

  const goTo = useCallback(
    (target: Step) => {
      const currentIdx = STEPS.indexOf(step);
      const targetIdx = STEPS.indexOf(target);
      const dir = targetIdx > currentIdx ? 'forward' : 'backward';
      setDirection(dir);
      setAnimating(true);
      // Small delay so CSS transition starts from the correct state
      setTimeout(() => {
        setStep(target);
        // Reset animation after transition
        setTimeout(() => setAnimating(false), 350);
      }, 50);
    },
    [step],
  );

  const skipAll = async () => {
    localStorage.removeItem(STORAGE_KEY);
    try {
      await api.post('/setup/complete');
    } catch {
      // best-effort
    }
    setOnboardingCookie(true);
    window.location.href = localePath('/dashboard', locale);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      const idx = STEPS.indexOf(step);
      if (e.key === 'Escape' && idx > 0) {
        goTo(STEPS[idx - 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, goTo]);

  return (
    <div>
      <Stepper currentStep={step} />

      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          animating && direction === 'forward' && 'opacity-0 translate-x-8',
          animating && direction === 'backward' && 'opacity-0 -translate-x-8',
          !animating && 'opacity-100 translate-x-0',
        )}
      >
        {step === 'company' && (
          <CompanyStep
            onNext={() => goTo('agent')}
            onSkip={skipAll}
            formData={companyForm}
            onFormChange={setCompanyForm}
          />
        )}

        {step === 'agent' && (
          <AgentStep
            onNext={() => goTo('knowledge')}
            onSkip={() => goTo('knowledge')}
            onBack={() => goTo('company')}
            existingAgentId={createdAgentId}
            onAgentCreated={(id, name) => {
              setCreatedAgentId(id);
              setAgentName(name);
              setAgentCreated(true);
            }}
          />
        )}

        {step === 'knowledge' && (
          <KnowledgeStep
            onNext={() => goTo('channel')}
            onSkip={() => goTo('channel')}
            onBack={() => goTo('agent')}
            agentId={createdAgentId}
            onKbAdded={(count) => setKbCount(count)}
            kbCount={kbCount}
          />
        )}

        {step === 'channel' && (
          <ChannelStep
            onNext={() => goTo('test')}
            onSkip={() => goTo('test')}
            onBack={() => goTo('knowledge')}
            agentId={createdAgentId}
            onChannelCreated={() => setChannelCreated(true)}
            channelCreated={channelCreated}
          />
        )}

        {step === 'test' && (
          <TestStep
            onNext={() => goTo('done')}
            onBack={() => goTo('channel')}
            agentId={createdAgentId}
            agentName={agentName}
          />
        )}

        {step === 'done' && (
          <CompleteStep
            agentCreated={agentCreated}
            channelCreated={channelCreated}
            kbCount={kbCount}
            companyName={companyForm.name || org?.name || ''}
            agentName={agentName}
          />
        )}
      </div>
    </div>
  );
}
