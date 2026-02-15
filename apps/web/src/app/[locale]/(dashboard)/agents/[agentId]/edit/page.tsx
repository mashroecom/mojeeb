'use client';

import { useState, useEffect, type ComponentType } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAgent, useUpdateAgent } from '@/hooks/useAgents';
import { getTemplateById } from '@/lib/agent-templates';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Save,
  Bot,
  Loader2,
  Headphones,
  Briefcase,
  HelpCircle,
  Calendar,
  ShoppingCart,
  Settings,
  BookOpen,
  Globe,
  MessageSquare,
  CheckCircle,
  Lightbulb,
} from 'lucide-react';

import { FormSkeleton } from './_components/FormSkeleton';
import { KnowledgeBaseSection } from './_components/KnowledgeBaseSection';
import { ChannelsSection } from './_components/ChannelsSection';
import { TestAgentSection } from './_components/TestAgentSection';

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Headphones,
  Briefcase,
  HelpCircle,
  Calendar,
  ShoppingCart,
  Bot,
};

const inputClass =
  'w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50';

type Tab = 'general' | 'knowledge' | 'channels' | 'test';

const TABS: {
  key: Tab;
  icon: ComponentType<{ className?: string }>;
  labelKey: string;
}[] = [
  { key: 'general', icon: Settings, labelKey: 'editAgent' },
  { key: 'knowledge', icon: BookOpen, labelKey: 'knowledgeBases' },
  { key: 'channels', icon: Globe, labelKey: 'channels' },
  { key: 'test', icon: MessageSquare, labelKey: 'testAgent' },
];

export default function EditAgentPage() {
  const t = useTranslations('dashboard.agents');
  const tt = useTranslations('dashboard.agents.templates');
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const { data: agent, isLoading } = useAgent(agentId);
  const updateAgent = useUpdateAgent();

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [saved, setSaved] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('ar');
  const [instructions, setInstructions] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [enableLeadExtraction, setEnableLeadExtraction] = useState(false);

  // Pre-fill form when agent data loads
  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setLanguage(agent.language);
      setInstructions(agent.systemPrompt);
      setIsActive(agent.isActive);
      setEnableLeadExtraction(agent.enableLeadExtraction);
    }
  }, [agent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    updateAgent.mutate(
      {
        id: agentId,
        name: name.trim(),
        language,
        systemPrompt: instructions,
        isActive,
        enableLeadExtraction,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      },
    );
  };

  const template = agent?.templateType
    ? getTemplateById(agent.templateType)
    : null;
  const TemplateIcon = template
    ? ICON_MAP[template.iconName] || Bot
    : Bot;

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/agents"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex flex-1 items-center gap-3 min-w-0">
            {template && (
              <div className="inline-flex rounded-xl bg-primary/10 p-2.5">
                <TemplateIcon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">
                {isLoading ? '...' : agent?.name || t('editAgent')}
              </h1>
              {template && (
                <p className="text-sm text-muted-foreground truncate">
                  {tt(template.nameKey)} &mdash; {tt(template.descriptionKey)}
                </p>
              )}
            </div>
          </div>

          {agent && (
            <span
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                agent.isActive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
              )}
            >
              {agent.isActive ? t('isActive') : t('inactive')}
            </span>
          )}
        </div>
      </div>

      {isLoading && <FormSkeleton />}

      {!isLoading && agent && (
        <div className="mx-auto max-w-3xl">
          {/* ── Tab bar ── */}
          <div className="flex gap-1 border-b mb-8">
            {TABS.map(({ key, icon: Icon, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  activeTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
                )}
              >
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </button>
            ))}
          </div>

          {/* ── General Tab ── */}
          {activeTab === 'general' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Card 1 — Agent Profile */}
              <div className="rounded-xl border bg-card shadow-sm">
                <div className="flex items-center gap-3 border-b px-6 py-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">
                      {t('agentProfile')}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t('agentProfileHint')}
                    </p>
                  </div>
                </div>

                <div className="space-y-5 p-6">
                  {/* Agent Name */}
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      {t('name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('namePlaceholder')}
                      className={inputClass}
                    />
                  </div>

                  {/* Response Language */}
                  <div>
                    <label
                      htmlFor="language"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      {t('responseLanguage')}
                    </label>
                    <select
                      id="language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className={inputClass}
                    >
                      <option value="ar">{t('languageAr')}</option>
                      <option value="en">{t('languageEn')}</option>
                    </select>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {t('responseLanguageHint')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2 — Personality & Instructions */}
              <div className="rounded-xl border bg-card shadow-sm">
                <div className="flex items-center gap-3 border-b px-6 py-4">
                  <div className="rounded-lg bg-amber-500/10 p-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">
                      {t('personalityTitle')}
                    </h2>
                  </div>
                </div>

                <div className="p-6">
                  <label
                    htmlFor="instructions"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    {t('personalityLabel')}
                  </label>
                  <textarea
                    id="instructions"
                    rows={10}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder={t('personalityPlaceholder')}
                    className={cn(inputClass, 'resize-y')}
                  />
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>{t('personalityHint')}</span>
                  </div>
                </div>
              </div>

              {/* Card 3 — Settings */}
              <div className="rounded-xl border bg-card shadow-sm">
                <div className="flex items-center gap-3 border-b px-6 py-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Settings className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">
                      {t('settingsTitle')}
                    </h2>
                  </div>
                </div>

                <div className="p-6">
                  {/* Agent Status */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {t('agentStatus')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('agentStatusHint')}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      onClick={() => setIsActive(!isActive)}
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                        isActive ? 'bg-primary' : 'bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                          isActive ? 'translate-x-5' : 'translate-x-0',
                        )}
                      />
                    </button>
                  </div>

                  <div className="my-4 border-t" />

                  {/* Smart Lead Capture */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {t('smartLeadCapture')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('smartLeadCaptureHint')}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enableLeadExtraction}
                      onClick={() =>
                        setEnableLeadExtraction(!enableLeadExtraction)
                      }
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                        enableLeadExtraction ? 'bg-primary' : 'bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                          enableLeadExtraction
                            ? 'translate-x-5'
                            : 'translate-x-0',
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Save area ── */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {saved && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      {t('updated')}
                    </span>
                  )}
                  {updateAgent.isError && (
                    <span className="text-sm text-red-600">
                      {updateAgent.error instanceof Error
                        ? updateAgent.error.message
                        : t('somethingWentWrong')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/agents"
                    className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {t('cancel')}
                  </Link>
                  <button
                    type="submit"
                    disabled={updateAgent.isPending || !name.trim()}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                      (updateAgent.isPending || !name.trim()) &&
                        'cursor-not-allowed opacity-50',
                    )}
                  >
                    {updateAgent.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {updateAgent.isPending ? t('saving') : t('saveChanges')}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ── Knowledge Bases Tab ── */}
          {activeTab === 'knowledge' && (
            <KnowledgeBaseSection agentId={agentId} />
          )}

          {/* ── Channels Tab ── */}
          {activeTab === 'channels' && (
            <ChannelsSection agentId={agentId} />
          )}

          {/* ── Test Tab ── */}
          {activeTab === 'test' && <TestAgentSection agentId={agentId} />}
        </div>
      )}
    </div>
  );
}
