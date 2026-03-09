'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAdminPlans, useUpdatePlan } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Save,
  Pencil,
  X,
  Plus,
  Trash2,
  Star,
  Check,
} from 'lucide-react';

const PLAN_COLORS: Record<string, string> = {
  FREE: 'border-border',
  STARTER: 'border-blue-200 dark:border-blue-800',
  PROFESSIONAL: 'border-purple-200 dark:border-purple-800',
  ENTERPRISE: 'border-amber-200 dark:border-amber-800',
};

const PLAN_BG: Record<string, string> = {
  FREE: 'bg-muted/50',
  STARTER: 'bg-blue-50 dark:bg-blue-900/20',
  PROFESSIONAL: 'bg-purple-50 dark:bg-purple-900/20',
  ENTERPRISE: 'bg-amber-50 dark:bg-amber-900/20',
};

interface PlanData {
  id: string;
  plan: string;
  displayName: string;
  displayNameAr: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  messagesPerMonth: number;
  maxAgents: number;
  maxChannels: number;
  maxKnowledgeBases: number;
  maxTeamMembers: number;
  apiAccess: boolean;
  isPopular: boolean;
  sortOrder: number;
  features: string;
  featuresAr: string;
}

export default function PlansPage() {
  const t = useTranslations('admin.plans');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const { data: plans, isLoading } = useAdminPlans();
  const updatePlan = useUpdatePlan();

  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlanData>>({});

  function startEdit(plan: PlanData) {
    setEditingPlan(plan.plan);
    setEditForm({ ...plan });
  }

  function cancelEdit() {
    setEditingPlan(null);
    setEditForm({});
  }

  function savePlan() {
    if (!editingPlan) return;

    const body: Record<string, unknown> = {};
    const fields = ['displayName', 'displayNameAr', 'monthlyPrice', 'yearlyPrice', 'currency', 'messagesPerMonth', 'maxAgents', 'maxChannels', 'maxKnowledgeBases', 'maxTeamMembers', 'apiAccess', 'isPopular', 'features', 'featuresAr'] as const;

    for (const field of fields) {
      if (editForm[field] !== undefined) {
        body[field] = editForm[field];
      }
    }

    updatePlan.mutate(
      { plan: editingPlan, ...body },
      {
        onSuccess: () => {
          addToast('success', t('saved'));
          cancelEdit();
        },
      },
    );
  }

  function getFeatures(featuresStr: string): string[] {
    try { return JSON.parse(featuresStr); } catch { return []; }
  }

  function setFeatures(features: string[]) {
    setEditForm((s) => ({ ...s, features: JSON.stringify(features) }));
  }

  function setFeaturesAr(features: string[]) {
    setEditForm((s) => ({ ...s, featuresAr: JSON.stringify(features) }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {(plans || []).map((plan: PlanData) => {
          const isEditing = editingPlan === plan.plan;
          const features = getFeatures(isEditing ? (editForm.features || '[]') : plan.features);
          const featuresAr = getFeatures(isEditing ? (editForm.featuresAr || '[]') : plan.featuresAr);

          return (
            <div
              key={plan.id}
              className={cn(
                'rounded-xl border-2 p-6 transition-all',
                PLAN_COLORS[plan.plan] || 'border-border',
                isEditing && 'ring-2 ring-primary/30',
                plan.isPopular && !isEditing && 'ring-2 ring-purple-400/50',
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editForm.displayName || ''}
                        onChange={(e) => setEditForm((s) => ({ ...s, displayName: e.target.value }))}
                        placeholder={t('displayName')}
                        className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      />
                      <input
                        type="text"
                        value={editForm.displayNameAr || ''}
                        onChange={(e) => setEditForm((s) => ({ ...s, displayNameAr: e.target.value }))}
                        placeholder={t('displayNameAr')}
                        dir="rtl"
                        className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold">{plan.displayName}</h3>
                      <p className="text-sm text-muted-foreground">{plan.plan}</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {plan.isPopular && !isEditing && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">
                      <Star className="h-3 w-3 fill-current" />
                      {t('popularBadge')}
                    </span>
                  )}
                  {isEditing ? (
                    <div className="flex gap-1">
                      <button onClick={savePlan} disabled={updatePlan.isPending} className="rounded-lg p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 disabled:opacity-50">
                        {updatePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </button>
                      <button onClick={cancelEdit} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(plan)} className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div className={cn('rounded-lg p-4 mb-4', PLAN_BG[plan.plan] || 'bg-muted/50')}>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">{t('monthlyPrice')}</label>
                      <input type="number" min={0} step={0.01} value={editForm.monthlyPrice ?? 0} onChange={(e) => setEditForm((s) => ({ ...s, monthlyPrice: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border bg-background px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">{t('yearlyPrice')}</label>
                      <input type="number" min={0} step={0.01} value={editForm.yearlyPrice ?? 0} onChange={(e) => setEditForm((s) => ({ ...s, yearlyPrice: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border bg-background px-2 py-1 text-sm" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${plan.monthlyPrice}</span>
                    <span className="text-sm text-muted-foreground">{t('perMonth')}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-lg font-semibold">${plan.yearlyPrice}</span>
                    <span className="text-sm text-muted-foreground">{t('perYear')}</span>
                  </div>
                )}
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {([
                  ['messagesPerMonth', t('messagesPerMonth')],
                  ['maxAgents', t('maxAgents')],
                  ['maxChannels', t('maxChannels')],
                  ['maxKnowledgeBases', t('maxKnowledgeBases')],
                  ['maxTeamMembers', t('maxTeamMembers')],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    {isEditing ? (
                      <input type="number" min={0} value={(editForm as any)[key] ?? 0} onChange={(e) => setEditForm((s) => ({ ...s, [key]: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border bg-background px-2 py-1 text-sm" />
                    ) : (
                      <p className="text-sm font-medium mt-0.5">{(plan as any)[key] >= 999999 ? t('unlimited') : (plan as any)[key].toLocaleString(locale)}</p>
                    )}
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t('apiAccess')}</label>
                  {isEditing ? (
                    <label className="mt-1 flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editForm.apiAccess ?? false} onChange={(e) => setEditForm((s) => ({ ...s, apiAccess: e.target.checked }))} className="h-4 w-4 rounded" />
                      <span className="text-sm">{editForm.apiAccess ? t('yes') : t('no')}</span>
                    </label>
                  ) : (
                    <p className="text-sm font-medium mt-0.5">{plan.apiAccess ? <Check className="h-4 w-4 text-green-500" /> : '—'}</p>
                  )}
                </div>
              </div>

              {/* Popular toggle */}
              {isEditing && (
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input type="checkbox" checked={editForm.isPopular ?? false} onChange={(e) => setEditForm((s) => ({ ...s, isPopular: e.target.checked }))} className="h-4 w-4 rounded" />
                  <span className="text-sm font-medium">{t('isPopular')}</span>
                </label>
              )}

              {/* Features (EN) */}
              <div className="mb-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase">{t('features')}</label>
                <ul className="mt-2 space-y-1">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {isEditing ? (
                        <div className="flex-1 flex gap-1">
                          <input type="text" value={f} onChange={(e) => { const arr = [...features]; arr[i] = e.target.value; setFeatures(arr); }} className="flex-1 rounded border bg-background px-2 py-0.5 text-sm" />
                          <button onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <span>{f}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {isEditing && (
                  <button onClick={() => setFeatures([...features, ''])} className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="h-3 w-3" /> {t('addFeature')}
                  </button>
                )}
              </div>

              {/* Features (AR) */}
              {isEditing && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">{t('featuresAr')}</label>
                  <ul className="mt-2 space-y-1" dir="rtl">
                    {featuresAr.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <div className="flex-1 flex gap-1">
                          <input type="text" value={f} onChange={(e) => { const arr = [...featuresAr]; arr[i] = e.target.value; setFeaturesAr(arr); }} className="flex-1 rounded border bg-background px-2 py-0.5 text-sm" dir="rtl" />
                          <button onClick={() => setFeaturesAr(featuresAr.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setFeaturesAr([...featuresAr, ''])} className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="h-3 w-3" /> {t('addFeature')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
