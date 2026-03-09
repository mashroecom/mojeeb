import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

export function UserDetailHeader() {
  const router = useRouter();
  const t = useTranslations('admin');

  return (
    <div className="flex items-center gap-4 mb-6">
      <button
        onClick={() => router.push('/admin/users')}
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('userDetail.backToUsers')}
      </button>
      <h1 className="text-2xl font-bold">{t('userDetail.title')}</h1>
    </div>
  );
}
