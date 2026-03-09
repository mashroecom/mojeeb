import { useTranslations } from 'next-intl';
import { MessageSquare, Key, Building2 } from 'lucide-react';

interface UserStatsSectionProps {
  user: {
    _count?: {
      sentMessages?: number;
      apiKeys?: number;
    };
    memberships?: any[];
  };
}

export function UserStatsSection({ user }: UserStatsSectionProps) {
  const t = useTranslations('admin');

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <MessageSquare className="h-4 w-4" />
          <span className="text-xs">{t('userDetail.messagesSent')}</span>
        </div>
        <p className="text-2xl font-bold">{user._count?.sentMessages ?? 0}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Key className="h-4 w-4" />
          <span className="text-xs">{t('userDetail.apiKeys')}</span>
        </div>
        <p className="text-2xl font-bold">{user._count?.apiKeys ?? 0}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Building2 className="h-4 w-4" />
          <span className="text-xs">{t('userDetail.organizations')}</span>
        </div>
        <p className="text-2xl font-bold">{user.memberships?.length ?? 0}</p>
      </div>
    </div>
  );
}
