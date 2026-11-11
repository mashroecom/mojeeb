'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Bot, Loader2, Lightbulb } from 'lucide-react';
import { useTestAgent } from '@/hooks/useAgents';
import { cn } from '@/lib/utils';

interface TestChatProps {
  agentId: string;
  agentName: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Local error bubble — shown to the user but never sent back as history */
  isError?: boolean;
}

/**
 * Onboarding "test your agent" chat. Talks to the real agent through the same
 * endpoint as the agent editor's test panel, so the reply reflects the agent's
 * prompt and the knowledge added in the previous step.
 */
export function TestChat({ agentId, agentName }: TestChatProps) {
  const t = useTranslations('onboarding.testAgent');
  const testAgent = useTestAgent();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const loading = testAgent.isPending;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading]);

  const handleSend = () => {
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    const history = messages
      .filter((m) => !m.isError)
      .map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');

    testAgent.mutate(
      { agentId, message: userMessage, history },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: t('errorReply'), isError: true },
          ]);
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex h-96 flex-col rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-medium">{agentName}</span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && !loading && (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              {t('emptyChat')}
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'ms-auto bg-primary text-primary-foreground'
                  : msg.isError
                    ? 'me-auto border border-destructive/30 bg-destructive/10 text-destructive'
                    : 'me-auto bg-muted',
              )}
            >
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="me-auto flex w-fit items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span aria-hidden="true">…</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend();
              }}
              placeholder={t('inputPlaceholder')}
              aria-label={t('inputPlaceholder')}
              disabled={loading}
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label={t('send')}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90',
                (loading || !input.trim()) && 'cursor-not-allowed opacity-50',
              )}
            >
              <Send className="h-4 w-4 rtl:-scale-x-100" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-muted/40 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          {t('tipsTitle')}
        </p>
        <ul className="mt-2 list-disc space-y-1 ps-6 text-xs text-muted-foreground">
          <li>{t('tip1')}</li>
          <li>{t('tip2')}</li>
          <li>{t('tip3')}</li>
        </ul>
      </div>
    </div>
  );
}
