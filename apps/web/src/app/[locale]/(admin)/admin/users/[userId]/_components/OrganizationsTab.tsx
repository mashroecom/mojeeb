'use client';

import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Building2, MessageSquare, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrganizationsTabProps {
  memberships?: Array<{
    id: string;
    role: string;
    orgId?: string;
    org?: {
      id: string;
      name: string;
      slug?: string;
      _count?: {
        conversations: number;
        agents: number;
      };
    };
  }> | null;
}

export function OrganizationsTab({ memberships }: OrganizationsTabProps) {
  const t = useTranslations('admin');
  const router = useRouter();

  if (!memberships || memberships.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {t('userDetail.noOrganizations')}
      </p>
    );
  }

  return (
    <div className="divide-y">
      {memberships.map((membership) => (
        <div
          key={membership.id || membership.org?.id}
          className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <button
                onClick={() =>
                  router.push(`/admin/organizations/${membership.org?.id ?? membership.orgId}`)
                }
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                {membership.org?.name ?? '—'}
              </button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {membership.org?.slug && <span>{membership.org.slug}</span>}
                {membership.org?._count && (
                  <>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {membership.org._count.conversations}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      {membership.org._count.agents}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              membership.role === 'OWNER'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : membership.role === 'ADMIN'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            )}
          >
            {membership.role}
          </span>
        </div>
      ))}
    </div>
  );
}
