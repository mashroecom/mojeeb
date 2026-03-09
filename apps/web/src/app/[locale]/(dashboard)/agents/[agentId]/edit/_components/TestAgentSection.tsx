'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useTestAgent } from '@/hooks/useAgents';
import { cn } from '@/lib/utils';
import { MarkdownMessage } from '@/components/ui/MarkdownMessage';
import { Bot, Send, Loader2 } from 'lucide-react';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

interface TestMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function TestAgentSection({ agentId }: { agentId: string }) {
  const t = useTranslations('dashboard.agents');
  const testAgent = useTestAgent();
  const [testInput, setTestInput] = useState('');
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;

    const userMessage = testInput.trim();
    const history = [...messages];
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setTestInput('');

    testAgent.mutate(
      { agentId, message: userMessage, history },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.reply },
          ]);
        },
        onError: (error) => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                error instanceof Error
                  ? error.message
                  : t('testAgentError'),
            },
          ]);
        },
      },
    );
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bot className="h-5 w-5" />
          {t('testAgent')}
        </h2>
      </div>

      {/* Messages area */}
      <div className="h-64 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('testPlaceholder')}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'mb-3 max-w-[80%] rounded-lg px-3 py-2',
              msg.role === 'user'
                ? 'ms-auto bg-primary text-primary-foreground'
                : 'me-auto bg-muted',
            )}
          >
            {msg.role === 'assistant' ? (
              <MarkdownMessage content={msg.content} />
            ) : (
              <p className="text-sm">{msg.content}</p>
            )}
          </div>
        ))}
        {testAgent.isPending && (
          <div className="me-auto mb-3 flex max-w-[80%] items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            ...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleTest} className="border-t p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder={t('testPlaceholder')}
            disabled={testAgent.isPending}
            className={cn(inputClass, 'flex-1')}
          />
          <button
            type="submit"
            disabled={testAgent.isPending || !testInput.trim()}
            className={cn(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90',
              (testAgent.isPending || !testInput.trim()) &&
                'cursor-not-allowed opacity-50',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
