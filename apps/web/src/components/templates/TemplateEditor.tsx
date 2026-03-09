'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  User,
  MessageSquare,
  Hash,
  ShoppingCart,
  Info,
  Globe
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateEditorProps {
  initialValues?: {
    title?: string;
    titleAr?: string;
    content?: string;
    contentAr?: string;
    category?: string;
    shortcut?: string;
    isShared?: boolean;
  };
  onSave: (data: TemplateFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  className?: string;
}

export interface TemplateFormData {
  title: string;
  titleAr: string;
  content: string;
  contentAr: string;
  category: string;
  shortcut: string;
  isShared: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VARIABLES = [
  { key: 'customer_name', label: 'Customer Name', icon: User },
  { key: 'agent_name', label: 'Agent Name', icon: User },
  { key: 'conversation_id', label: 'Conversation ID', icon: MessageSquare },
  { key: 'order_number', label: 'Order Number', icon: ShoppingCart },
];

const CATEGORIES = [
  { value: 'greeting', label: 'Greeting' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'closing', label: 'Closing' },
  { value: 'product_info', label: 'Product Info' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'feedback', label: 'Feedback' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateEditor({
  initialValues,
  onSave,
  onCancel,
  loading = false,
  className,
}: TemplateEditorProps) {
  const t = useTranslations('admin.messageTemplates');
  const tc = useTranslations('common');

  // Form state
  const [title, setTitle] = useState(initialValues?.title || '');
  const [titleAr, setTitleAr] = useState(initialValues?.titleAr || '');
  const [content, setContent] = useState(initialValues?.content || '');
  const [contentAr, setContentAr] = useState(initialValues?.contentAr || '');
  const [category, setCategory] = useState(initialValues?.category || '');
  const [shortcut, setShortcut] = useState(initialValues?.shortcut || '');
  const [isShared, setIsShared] = useState(initialValues?.isShared ?? false);
  const [activeTab, setActiveTab] = useState('en');

  // Refs for textarea focus
  const contentEnRef = useRef<HTMLTextAreaElement>(null);
  const contentArRef = useRef<HTMLTextAreaElement>(null);

  // Insert variable into the active textarea
  const insertVariable = (variableKey: string) => {
    const variableText = `{{${variableKey}}}`;
    const ref = activeTab === 'en' ? contentEnRef : contentArRef;
    const textarea = ref.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = activeTab === 'en' ? content : contentAr;
    const before = currentContent.substring(0, start);
    const after = currentContent.substring(end);
    const newContent = before + variableText + after;

    if (activeTab === 'en') {
      setContent(newContent);
    } else {
      setContentAr(newContent);
    }

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variableText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      titleAr,
      content,
      contentAr,
      category,
      shortcut,
      isShared,
    });
  };

  // Validation
  const isValid = title.trim() && content.trim() && category;

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {/* Basic Info Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Basic Information</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORIES}
            placeholder="Select category..."
            required
          />
          <Input
            label="Shortcut"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            placeholder="e.g., /greet"
            maxLength={20}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isShared"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="isShared" className="text-sm font-medium">
            Share with team (visible to all agents in organization)
          </label>
        </div>
      </div>

      {/* Variable Insertion Buttons */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Hash className="h-4 w-4" />
          <span>Insert Variables</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map((variable) => {
            const Icon = variable.icon;
            return (
              <Button
                key={variable.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable(variable.key)}
                disabled={loading}
              >
                <Icon className="h-3.5 w-3.5" />
                {variable.label}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Click a button to insert a variable at the cursor position. Variables will be replaced with actual values when the template is used.
        </p>
      </div>

      {/* Bilingual Content Tabs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span>Content (Bilingual)</span>
        </div>

        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            {
              key: 'en',
              label: 'English',
              content: (
                <div className="space-y-4">
                  <Input
                    label="Title (English)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter template title..."
                    maxLength={100}
                    required
                  />
                  <Textarea
                    ref={contentEnRef}
                    label="Content (English)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter template content..."
                    rows={6}
                    maxLength={1000}
                    showCount
                    required
                  />
                </div>
              ),
            },
            {
              key: 'ar',
              label: 'العربية',
              content: (
                <div className="space-y-4" dir="rtl">
                  <Input
                    label="العنوان (بالعربية)"
                    value={titleAr}
                    onChange={(e) => setTitleAr(e.target.value)}
                    placeholder="أدخل عنوان القالب..."
                    maxLength={100}
                  />
                  <Textarea
                    ref={contentArRef}
                    label="المحتوى (بالعربية)"
                    value={contentAr}
                    onChange={(e) => setContentAr(e.target.value)}
                    placeholder="أدخل محتوى القالب..."
                    rows={6}
                    maxLength={1000}
                    showCount
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={loading}
        >
          {tc('cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={!isValid || loading}
        >
          {tc('save')}
        </Button>
      </div>
    </form>
  );
}
