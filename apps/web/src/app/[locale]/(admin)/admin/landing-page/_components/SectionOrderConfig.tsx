import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<string, { en: string; ar: string }> = {
  hero: { en: 'Hero', ar: 'الرئيسي' },
  trustedBy: { en: 'Trusted By', ar: 'موثوق من' },
  features: { en: 'Features', ar: 'المميزات' },
  stats: { en: 'Stats', ar: 'الإحصائيات' },
  pricing: { en: 'Pricing', ar: 'الأسعار' },
  testimonials: { en: 'Testimonials', ar: 'آراء العملاء' },
  faq: { en: 'FAQ', ar: 'الأسئلة الشائعة' },
  bottomCta: { en: 'Bottom CTA', ar: 'دعوة للعمل' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SectionOrderConfigProps {
  sectionOrder: string[];
  onMove: (index: number, direction: 'up' | 'down') => void;
  t: (key: string) => string;
}

export function SectionOrderConfig({ sectionOrder, onMove, t }: SectionOrderConfigProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 pb-4 border-b mb-6">
        <div>
          <h2 className="text-lg font-semibold">{t('sectionOrderTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t('sectionOrderDesc')}</p>
        </div>
      </div>
      <div className="space-y-2">
        {sectionOrder.map((key, i) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">
              {SECTION_LABELS[key]?.en || key}
            </span>
            <span className="text-xs text-muted-foreground">
              {SECTION_LABELS[key]?.ar || ''}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onMove(i, 'up')}
                disabled={i === 0}
                className="p-1 hover:bg-muted rounded disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => onMove(i, 'down')}
                disabled={i === sectionOrder.length - 1}
                className="p-1 hover:bg-muted rounded disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
