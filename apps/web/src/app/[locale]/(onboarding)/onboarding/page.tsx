'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useCreateAgent } from '@/hooks/useAgents';
import { useConnectChannel, useAssignAgent } from '@/hooks/useChannels';
import { AGENT_TEMPLATES, type AgentTemplate } from '@/lib/agent-templates';
import { cn } from '@/lib/utils';
import {
  Bot,
  Globe,
  MessageCircle,
  Clock,
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
  Lightbulb,
  PartyPopper,
  SkipForward,
} from 'lucide-react';

// Map icon names to components (same as agents/new)
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

const STEPS = ['welcome', 'createAgent', 'connectChannel', 'done'] as const;
type Step = (typeof STEPS)[number];

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({ currentStep }: { currentStep: Step }) {
  const t = useTranslations('onboarding.progress');
  const currentIdx = STEPS.indexOf(currentStep);

  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isActive = idx === currentIdx;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isActive && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                  !isCompleted && !isActive && 'bg-muted text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-[11px] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {t(step)}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 w-12 sm:w-20 rounded-full transition-colors',
                  idx < currentIdx ? 'bg-primary' : 'bg-muted',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Welcome
// ---------------------------------------------------------------------------

function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const t = useTranslations('onboarding.welcome');
  const ts = useTranslations('onboarding');
  const user = useAuthStore((s) => s.user);

  const features = [
    { icon: Bot, title: t('feature1Title'), desc: t('feature1Desc') },
    { icon: Globe, title: t('feature2Title'), desc: t('feature2Desc') },
    { icon: Clock, title: t('feature3Title'), desc: t('feature3Desc') },
  ];

  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mb-6 inline-flex rounded-full bg-primary/10 p-4">
        <Sparkles className="h-10 w-10 text-primary" />
      </div>
      <h1 className="text-3xl font-bold">
        {t('title', { name: user?.firstName || '' })}
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-6 text-center shadow-sm"
            >
              <div className="mx-auto mb-3 inline-flex rounded-lg bg-primary/10 p-3">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('getStarted')}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
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

function CreateAgentStep({
  onNext,
  onSkip,
  onBack,
  onAgentCreated,
}: {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  onAgentCreated: (agentId: string) => void;
}) {
  const t = useTranslations('onboarding.createAgent');
  const ts = useTranslations('onboarding');
  const tt = useTranslations('dashboard.agents.templates');
  const createAgent = useCreateAgent();

  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [instructions, setInstructions] = useState('');

  const handleCreate = () => {
    if (!selectedTemplate || !name.trim()) return;

    const systemPrompt = selectedTemplate.systemPromptTemplate({
      agentName: name,
      language,
      additionalInstructions: instructions.trim() || undefined,
    });

    createAgent.mutate(
      {
        name,
        systemPrompt,
        templateType: selectedTemplate.id,
        aiProvider: 'OPENAI',
        aiModel: 'gpt-4o',
        language,
        temperature: selectedTemplate.defaultTemperature,
        maxTokens: selectedTemplate.defaultMaxTokens,
        enableEmotionDetection: selectedTemplate.enableEmotionDetection,
        enableLeadExtraction: selectedTemplate.enableLeadExtraction,
        enableHumanHandoff: selectedTemplate.enableHumanHandoff,
        handoffThreshold: selectedTemplate.handoffThreshold,
      },
      {
        onSuccess: (agent) => {
          onAgentCreated(agent.id);
          onNext();
        },
      },
    );
  };

  const inputClass =
    'w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {!selectedTemplate ? (
        // Template grid
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_TEMPLATES.map((template) => {
            const Icon = ICON_MAP[template.iconName] || Bot;
            return (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className="group rounded-xl border bg-card p-5 text-start shadow-sm transition-all hover:border-primary hover:shadow-md"
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
        // Customize form
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => setSelectedTemplate(null)}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {ts('back')}
          </button>

          {/* Selected template badge */}
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
              <p className="text-xs text-muted-foreground">
                {tt(selectedTemplate.descriptionKey)}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t('nameLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t('nameHint')}</p>
            </div>

            {/* Language */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t('languageLabel')}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'ar' | 'en')}
                className={inputClass}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Instructions */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t('instructionsLabel')}
              </label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t('instructionsPlaceholder')}
                className={cn(inputClass, 'resize-y')}
              />
              <div className="mt-1 flex items-start gap-1.5">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <p className="text-xs text-muted-foreground">{t('instructionsHint')}</p>
              </div>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={createAgent.isPending || !name.trim()}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                (createAgent.isPending || !name.trim()) && 'cursor-not-allowed opacity-50',
              )}
            >
              {createAgent.isPending ? (
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

            {createAgent.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                {createAgent.error instanceof Error
                  ? createAgent.error.message
                  : 'Something went wrong'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer with skip/back */}
      <div className="mt-8 flex items-center justify-between border-t pt-5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {ts('back')}
        </button>
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {ts('skip')}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Connect Channel
// ---------------------------------------------------------------------------

function ConnectChannelStep({
  onNext,
  onSkip,
  onBack,
  createdAgentId,
}: {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  createdAgentId: string | null;
}) {
  const t = useTranslations('onboarding.connectChannel');
  const ts = useTranslations('onboarding');
  const connectChannel = useConnectChannel();
  const assignAgent = useAssignAgent();
  const [channelName, setChannelName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    if (!channelName.trim()) return;
    setIsConnecting(true);

    connectChannel.mutate(
      {
        type: 'WEBCHAT',
        name: channelName.trim(),
        credentials: {},
      },
      {
        onSuccess: (channel) => {
          // Auto-assign the agent if one was created
          if (createdAgentId) {
            assignAgent.mutate(
              { channelId: channel.id, agentId: createdAgentId, isPrimary: true },
              {
                onSuccess: () => {
                  setIsConnecting(false);
                  onNext();
                },
                onError: () => {
                  // Channel connected but agent assign failed — still move forward
                  setIsConnecting(false);
                  onNext();
                },
              },
            );
          } else {
            setIsConnecting(false);
            onNext();
          }
        },
        onError: () => {
          setIsConnecting(false);
        },
      },
    );
  };

  const inputClass =
    'w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

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
        {/* WebChat — primary option */}
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
                <label className="mb-1.5 block text-sm font-medium">
                  {t('webchatNameLabel')}
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder={t('webchatNamePlaceholder')}
                  className={inputClass}
                />
              </div>

              <button
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

              {connectChannel.isError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  {connectChannel.error instanceof Error
                    ? connectChannel.error.message
                    : 'Something went wrong'}
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
                      'flex h-7 w-7 items-center justify-center rounded-md shrink-0',
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

      {/* Footer with skip/back */}
      <div className="mt-8 flex items-center justify-between border-t pt-5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {ts('back')}
        </button>
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {ts('skip')}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Complete
// ---------------------------------------------------------------------------

function CompleteStep({
  agentCreated,
  channelCreated,
}: {
  agentCreated: boolean;
  channelCreated: boolean;
}) {
  const t = useTranslations('onboarding.complete');
  const router = useRouter();

  const items = [
    {
      done: agentCreated,
      label: agentCreated ? t('agentReady') : t('agentSkipped'),
    },
    {
      done: channelCreated,
      label: channelCreated ? t('channelReady') : t('channelSkipped'),
    },
  ];

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mb-6 inline-flex rounded-full bg-green-100 p-4 dark:bg-green-900/30">
        <PartyPopper className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-8 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-4',
              item.done ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' : 'bg-card',
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                item.done
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {item.done ? <Check className="h-4 w-4" /> : <SkipForward className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                'text-sm font-medium',
                item.done ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground',
              )}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Tip */}
      <div className="mt-6 flex items-start gap-2 rounded-lg border bg-amber-50/50 p-4 text-start dark:bg-amber-950/20">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-sm text-muted-foreground">{t('tip')}</p>
      </div>

      <button
        onClick={() => router.push('/dashboard')}
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t('goToDashboard')}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard Page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [agentCreated, setAgentCreated] = useState(false);
  const [channelCreated, setChannelCreated] = useState(false);
  const router = useRouter();

  const goTo = (s: Step) => setStep(s);
  const skipAll = () => router.push('/dashboard');

  return (
    <div>
      <Stepper currentStep={step} />

      {step === 'welcome' && (
        <WelcomeStep onNext={() => goTo('createAgent')} onSkip={skipAll} />
      )}

      {step === 'createAgent' && (
        <CreateAgentStep
          onNext={() => goTo('connectChannel')}
          onSkip={() => goTo('connectChannel')}
          onBack={() => goTo('welcome')}
          onAgentCreated={(id) => {
            setCreatedAgentId(id);
            setAgentCreated(true);
          }}
        />
      )}

      {step === 'connectChannel' && (
        <ConnectChannelStep
          onNext={() => {
            setChannelCreated(true);
            goTo('done');
          }}
          onSkip={() => goTo('done')}
          onBack={() => goTo('createAgent')}
          createdAgentId={createdAgentId}
        />
      )}

      {step === 'done' && (
        <CompleteStep agentCreated={agentCreated} channelCreated={channelCreated} />
      )}
    </div>
  );
}
