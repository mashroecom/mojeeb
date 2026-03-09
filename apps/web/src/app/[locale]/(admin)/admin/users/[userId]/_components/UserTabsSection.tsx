import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { OrganizationsTab } from './OrganizationsTab';
import { LoginActivityTab } from './LoginActivityTab';
import { SessionsTab } from './SessionsTab';
import { AuditLogTab } from './AuditLogTab';
import { ApiKeysTab } from './ApiKeysTab';
import { ConversationsTab } from './ConversationsTab';
import { LeadsTab } from './LeadsTab';
import { NotificationsTab } from './NotificationsTab';
import { UserActionsTab } from './UserActionsTab';
import {
  Building2,
  MessageSquare,
  Key,
  Globe,
  Monitor,
  History,
  Users2,
  Bell,
  Activity,
} from 'lucide-react';

interface UserTabsSectionProps {
  user: any;
  activeTab: 'orgs' | 'logins' | 'sessions' | 'audit' | 'apikeys' | 'conversations' | 'leads' | 'notifications' | 'useractions';
  onTabChange: (tab: 'orgs' | 'logins' | 'sessions' | 'audit' | 'apikeys' | 'conversations' | 'leads' | 'notifications' | 'useractions') => void;
  loginData: any;
  loginsLoading: boolean;
  loginPage: number;
  onLoginPageChange: (page: number) => void;
  sessionData: any;
  sessionsLoading: boolean;
  sessionPage: number;
  onSessionPageChange: (page: number) => void;
  onKillSession: (sessionId: string) => void;
  onKillAllSessions: () => void;
  killSessionPending: boolean;
  killAllSessionsPending: boolean;
  auditData: any;
  auditLoading: boolean;
  auditPage: number;
  onAuditPageChange: (page: number) => void;
  apiKeysQuery: any;
  apiKeysPage: number;
  onApiKeysPageChange: (page: number) => void;
  conversationsQuery: any;
  conversationsPage: number;
  onConversationsPageChange: (page: number) => void;
  leadsQuery: any;
  leadsPage: number;
  onLeadsPageChange: (page: number) => void;
  notificationsQuery: any;
  notificationsPage: number;
  onNotificationsPageChange: (page: number) => void;
  userActionsQuery: any;
  userActionsPage: number;
  onUserActionsPageChange: (page: number) => void;
}

export function UserTabsSection(props: UserTabsSectionProps) {
  const t = useTranslations('admin');

  const tabs = [
    { key: 'orgs' as const, label: t('userDetail.organizations'), icon: Building2 },
    { key: 'logins' as const, label: t('userDetail.loginActivity'), icon: Globe },
    { key: 'sessions' as const, label: t('userDetail.activeSessions'), icon: Monitor },
    { key: 'audit' as const, label: t('userDetail.auditLog'), icon: History },
    { key: 'apikeys' as const, label: t('userDetail.apiKeys'), icon: Key },
    { key: 'conversations' as const, label: t('userDetail.conversations'), icon: MessageSquare },
    { key: 'leads' as const, label: t('userDetail.leads'), icon: Users2 },
    { key: 'notifications' as const, label: t('userDetail.notifications'), icon: Bell },
    { key: 'useractions' as const, label: t('userDetail.userActions'), icon: Activity },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => props.onTabChange(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors',
              props.activeTab === tab.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {props.activeTab === 'orgs' && (
          <OrganizationsTab memberships={props.user.memberships} />
        )}

        {props.activeTab === 'logins' && (
          <LoginActivityTab
            isLoading={props.loginsLoading}
            loginData={props.loginData}
            currentPage={props.loginPage}
            onPageChange={props.onLoginPageChange}
          />
        )}

        {props.activeTab === 'sessions' && (
          <SessionsTab
            isLoading={props.sessionsLoading}
            sessionData={props.sessionData}
            currentPage={props.sessionPage}
            onPageChange={props.onSessionPageChange}
            onKillSession={props.onKillSession}
            onKillAllSessions={props.onKillAllSessions}
            killSessionPending={props.killSessionPending}
            killAllSessionsPending={props.killAllSessionsPending}
          />
        )}

        {props.activeTab === 'audit' && (
          <AuditLogTab
            isLoading={props.auditLoading}
            auditData={props.auditData}
            currentPage={props.auditPage}
            onPageChange={props.onAuditPageChange}
          />
        )}

        {props.activeTab === 'apikeys' && (
          <ApiKeysTab
            isLoading={props.apiKeysQuery.isLoading}
            apiKeysData={props.apiKeysQuery.data}
            currentPage={props.apiKeysPage}
            onPageChange={props.onApiKeysPageChange}
          />
        )}

        {props.activeTab === 'conversations' && (
          <ConversationsTab
            isLoading={props.conversationsQuery.isLoading}
            conversationsData={props.conversationsQuery.data}
            currentPage={props.conversationsPage}
            onPageChange={props.onConversationsPageChange}
          />
        )}

        {props.activeTab === 'leads' && (
          <LeadsTab
            isLoading={props.leadsQuery.isLoading}
            leadsData={props.leadsQuery.data}
            currentPage={props.leadsPage}
            onPageChange={props.onLeadsPageChange}
          />
        )}

        {props.activeTab === 'notifications' && (
          <NotificationsTab
            isLoading={props.notificationsQuery.isLoading}
            notificationsData={props.notificationsQuery.data}
            currentPage={props.notificationsPage}
            onPageChange={props.onNotificationsPageChange}
          />
        )}

        {props.activeTab === 'useractions' && (
          <UserActionsTab
            isLoading={props.userActionsQuery.isLoading}
            userActionsData={props.userActionsQuery.data}
            currentPage={props.userActionsPage}
            onPageChange={props.onUserActionsPageChange}
          />
        )}
      </div>
    </div>
  );
}
