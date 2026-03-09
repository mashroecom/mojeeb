'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useTemplates, useTemplateSuggestions } from '@/hooks/useTemplates';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  FileText,
  Search,
  Sparkles,
  User,
  Hash,
  MessageSquare,
  ShoppingCart,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Template {
  id: string;
  title: string;
  titleAr?: string | null;
  content: string;
  contentAr?: string | null;
  category: string;
  shortcut?: string | null;
  variables: string[];
  isShared: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface TemplateSuggestion {
  template: Template;
  relevance: number;
  reasoning: string;
}

export interface TemplatePickerProps {
  conversationId?: string;
  onSelect: (template: Template) => void;
  onClose?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'greeting', label: 'Greeting' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'closing', label: 'Closing' },
  { value: 'product_info', label: 'Product Info' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'feedback', label: 'Feedback' },
];

const VARIABLE_ICONS: Record<string, typeof User> = {
  customer_name: User,
  agent_name: User,
  conversation_id: MessageSquare,
  order_number: ShoppingCart,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplatePicker({
  conversationId,
  onSelect,
  onClose,
  className,
}: TemplatePickerProps) {
  const t = useTranslations('templates');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  // State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);

  // Refs
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fetch templates and AI suggestions
  const { data: templates = [], isLoading: templatesLoading } = useTemplates({
    search: search || undefined,
    category: category || undefined,
  });

  const { data: suggestionsData, isLoading: suggestionsLoading } = useTemplateSuggestions(
    conversationId || '',
    !!conversationId,
  );

  const suggestions = suggestionsData?.suggestions || [];

  // Combine templates: AI suggestions first, then regular templates
  const allItems = useMemo(() => {
    const items: Array<{ type: 'suggestion' | 'template'; data: Template; meta?: { relevance: number; reasoning: string } }> = [];

    // Add AI suggestions
    if (suggestions.length > 0) {
      suggestions.forEach((suggestion) => {
        items.push({
          type: 'suggestion',
          data: suggestion.template,
          meta: { relevance: suggestion.relevance, reasoning: suggestion.reasoning },
        });
      });
    }

    // Add regular templates (excluding ones already in suggestions)
    const suggestionIds = new Set(suggestions.map((s) => s.template.id));
    templates.forEach((template) => {
      if (!suggestionIds.has(template.id)) {
        items.push({
          type: 'template',
          data: template,
        });
      }
    });

    return items;
  }, [templates, suggestions]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, allItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && focusIndex >= 0) {
        e.preventDefault();
        const item = allItems[focusIndex];
        if (item) {
          onSelect(item.data);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [allItems, focusIndex, onClose, onSelect]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [focusIndex]);

  // Reset focus when items change
  useEffect(() => {
    setFocusIndex(-1);
  }, [search, category]);

  // Render variable badges
  const renderVariableBadges = (variables: string[]) => {
    if (!variables || variables.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {variables.map((variable) => {
          const Icon = VARIABLE_ICONS[variable] || Hash;
          return (
            <Badge key={variable} variant="neutral" size="sm" className="gap-1">
              <Icon className="h-2.5 w-2.5" />
              {variable}
            </Badge>
          );
        })}
      </div>
    );
  };

  // Render template item
  const renderTemplateItem = (
    item: { type: 'suggestion' | 'template'; data: Template; meta?: { relevance: number; reasoning: string } },
    index: number,
  ) => {
    const { data: template, type, meta } = item;
    const isFocused = focusIndex === index;
    const title = isRTL && template.titleAr ? template.titleAr : template.title;
    const content = isRTL && template.contentAr ? template.contentAr : template.content;
    const isSuggestion = type === 'suggestion';

    return (
      <button
        key={`${type}-${template.id}`}
        ref={(el) => (itemRefs.current[index] = el)}
        onClick={() => onSelect(template)}
        className={cn(
          'w-full text-start p-3 rounded-lg border transition-colors',
          'hover:bg-accent hover:border-primary/30',
          isFocused && 'bg-accent border-primary',
          !isFocused && 'border-border',
        )}
        onMouseEnter={() => setFocusIndex(index)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isSuggestion && (
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
            <h3 className="text-sm font-medium truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {template.shortcut && (
              <Badge variant="neutral" size="sm">
                {template.shortcut}
              </Badge>
            )}
            {template.isShared ? (
              <Badge variant="primary" size="sm">
                Team
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Personal
              </Badge>
            )}
          </div>
        </div>

        {/* Content Preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
          {content}
        </p>

        {/* Variables */}
        {renderVariableBadges(template.variables)}

        {/* AI Reasoning (for suggestions) */}
        {isSuggestion && meta?.reasoning && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground italic">
              {meta.reasoning}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-2 text-[10px] text-muted-foreground">
          <span className="capitalize">{template.category.replace('_', ' ')}</span>
          {template.usageCount > 0 && (
            <span>Used {template.usageCount}×</span>
          )}
        </div>
      </button>
    );
  };

  const isLoading = templatesLoading || suggestionsLoading;
  const hasNoResults = !isLoading && allItems.length === 0;

  return (
    <div className={cn('flex flex-col h-full max-h-[500px]', className)}>
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Templates</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <span className="text-xl">×</span>
            </button>
          )}
        </div>

        {/* Search */}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search templates..."
          className="w-full"
        />

        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                category === cat.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading templates...</p>
          </div>
        )}

        {/* Empty State */}
        {hasNoResults && (
          <EmptyState
            icon={Search}
            title="No templates found"
            description={
              search || category
                ? 'Try adjusting your search or filters'
                : 'Create your first template to get started'
            }
          />
        )}

        {/* AI Suggestions Section */}
        {!isLoading && suggestions.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">AI Suggested</h3>
              <Badge variant="primary" size="sm">
                {suggestions.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {allItems
                .filter((item) => item.type === 'suggestion')
                .map((item, idx) => {
                  const globalIndex = allItems.findIndex((i) => i === item);
                  return renderTemplateItem(item, globalIndex);
                })}
            </div>
          </div>
        )}

        {/* Regular Templates Section */}
        {!isLoading && templates.length > 0 && (
          <div>
            {suggestions.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">All Templates</h3>
              </div>
            )}
            <div className="space-y-2">
              {allItems
                .filter((item) => item.type === 'template')
                .map((item, idx) => {
                  const globalIndex = allItems.findIndex((i) => i === item);
                  return renderTemplateItem(item, globalIndex);
                })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!isLoading && allItems.length > 0 && (
        <div className="shrink-0 p-3 border-t border-border text-center text-[10px] text-muted-foreground">
          Use ↑↓ to navigate, Enter to select, Esc to close
        </div>
      )}
    </div>
  );
}
