'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

/**
 * Renders AI message content as formatted markdown.
 * Used across the project for consistent message rendering.
 */
export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={cn('text-sm leading-relaxed', className)}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc ps-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal ps-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <h1 className="mb-2 text-base font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 text-sm font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.includes('language-');
            if (isBlock) {
              return (
                <pre className="mb-2 overflow-x-auto rounded-md bg-black/10 p-3 text-xs dark:bg-white/10">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-s-2 border-current/30 ps-3 italic opacity-80">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-current/20" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
