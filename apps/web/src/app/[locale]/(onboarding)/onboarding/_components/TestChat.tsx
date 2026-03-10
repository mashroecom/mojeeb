'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestChatProps {
  agentId: string;
  agentName: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function TestChat({ agentId, agentName }: TestChatProps) {
  const t = useTranslations('onboarding');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      // Mock agent response for testing
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t('testResponse'),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t('testError'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-sm h-96">
      <div className="border-b px-4 py-3 flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <span className="font-medium">{agentName}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('testPlaceholder')}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[80%] rounded-lg px-3 py-2 text-sm',
              msg.role === 'user'
                ? 'ms-auto bg-primary text-primary-foreground'
                : 'me-auto bg-muted',
            )}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="me-auto flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            ...
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t('testPlaceholder')}
            disabled={loading}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90',
              (loading || !input.trim()) && 'cursor-not-allowed opacity-50',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
