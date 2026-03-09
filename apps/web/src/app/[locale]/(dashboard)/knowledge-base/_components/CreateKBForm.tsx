'use client';

import { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

interface CreateKBFormProps {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  isPending: boolean;
  onCancel: () => void;
}

export function CreateKBForm({
  name,
  setName,
  description,
  setDescription,
  onSubmit,
  isPending,
  onCancel,
}: CreateKBFormProps) {
  const t = useTranslations('dashboard.knowledgeBase');
  const tc = useTranslations('common');

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 rounded-xl border bg-card p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold mb-4">{t('createKb')}</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="kb-name" className="block text-sm font-medium mb-1">
            {t('name')} <span className="text-red-500">*</span>
          </label>
          <input
            id="kb-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="kb-description" className="block text-sm font-medium mb-1">
            {t('description')}
          </label>
          <input
            id="kb-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {tc('create')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}
