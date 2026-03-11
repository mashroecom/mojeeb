'use client';

import { Plus, X, Upload } from 'lucide-react';
import { SectionHeader } from './shared';
import { inputCls } from './styles';
import type { TrustedByLogo } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TrustedBySectionProps {
  enabled: boolean;
  onToggleEnabled: () => void;
  title: string;
  onTitleChange: (value: string) => void;
  titleAr: string;
  onTitleArChange: (value: string) => void;
  logos: TrustedByLogo[];
  onLogosChange: (logos: TrustedByLogo[]) => void;
  onMarkChanged: () => void;
  uploadImage: {
    mutateAsync: (file: File) => Promise<{ url: string }>;
  };
  addToast: (type: 'error' | 'success', message: string) => void;
  t: (key: string) => string;
}

// ---------------------------------------------------------------------------
// TrustedBySection Component
// ---------------------------------------------------------------------------

export function TrustedBySection({
  enabled,
  onToggleEnabled,
  title,
  onTitleChange,
  titleAr,
  onTitleArChange,
  logos,
  onLogosChange,
  onMarkChanged,
  uploadImage,
  addToast,
  t,
}: TrustedBySectionProps) {
  // Helper functions
  function addLogo() {
    onLogosChange([...logos, { image: '', name: '' }]);
    onMarkChanged();
  }

  function removeLogo(i: number) {
    onLogosChange(logos.filter((_, idx) => idx !== i));
    onMarkChanged();
  }

  async function uploadLogo(i: number, file: File) {
    try {
      const result = await uploadImage.mutateAsync(file);
      onLogosChange(
        logos.map((item, idx) => (idx === i ? { ...item, image: result.url } : item)),
      );
      onMarkChanged();
    } catch {
      addToast('error', 'Upload failed');
    }
  }

  function updateLogoName(i: number, name: string) {
    onLogosChange(logos.map((item, idx) => (idx === i ? { ...item, name } : item)));
    onMarkChanged();
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('trustedBySection')}
        description={t('trustedBySectionDesc')}
        enabled={enabled}
        onToggle={onToggleEnabled}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">{t('trustedByTitleLabel')} (EN)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              onTitleChange(e.target.value);
              onMarkChanged();
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t('trustedByTitleLabel')} (AR)</label>
          <input
            type="text"
            dir="rtl"
            value={titleAr}
            onChange={(e) => {
              onTitleArChange(e.target.value);
              onMarkChanged();
            }}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('logos')}</h3>
        <button
          onClick={addLogo}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('addLogo')}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {logos.map((logo, i) => (
          <div key={i} className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Logo #{i + 1}
              </span>
              <button
                onClick={() => removeLogo(i)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {logo.image ? (
              <img src={logo.image} alt={logo.name} className="h-12 object-contain" />
            ) : (
              <label className="flex items-center justify-center h-12 rounded-lg border-2 border-dashed cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo(i, f);
                  }}
                />
              </label>
            )}
            <input
              type="text"
              value={logo.name}
              placeholder={t('companyName')}
              onChange={(e) => updateLogoName(i, e.target.value)}
              className={inputCls}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
