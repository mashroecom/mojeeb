'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useSidebar } from './SidebarContext';
import {
  LayoutDashboard,
  Users,
  Building2,
  BarChart3,
  CreditCard,
  ClipboardList,
  Mail,
  Megaphone,
  Server,
  ScrollText,
  LogOut,
  ArrowLeft,
  X,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Settings,
  Tags,
  Wrench,
  Activity,
  ShieldBan,
  Monitor,
  ToggleLeft,
  Bug,
  Webhook,
  Radio,
  FileText,
  MailOpen,
  FolderOpen,
  Send,
  MessageSquare,
  Shield,
  Bell,
  ArchiveX,
  Bot,
  UserPlus,
  BookOpen,
  Key,
  Receipt,
  Database,
  Star,
  Tag,
  Heart,
  Cpu,
  ShieldAlert,
  TrendingUp,
  Zap,
  HelpCircle,
  Quote,
  Globe,
  Scale,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarGroup {
  key: string;
  icon: LucideIcon;
  collapsible: boolean;
  items: SidebarItem[];
}

// ---------------------------------------------------------------------------
// Sidebar items (flat lookup)
// ---------------------------------------------------------------------------

const allItems: Record<string, SidebarItem> = {
  // Dashboard
  overview: { key: 'overview', href: '/admin', icon: LayoutDashboard },
  // Users & Orgs
  users: { key: 'users', href: '/admin/users', icon: Users },
  organizations: { key: 'organizations', href: '/admin/organizations', icon: Building2 },
  subscriptions: { key: 'subscriptions', href: '/admin/subscriptions', icon: CreditCard },
  // Platform Data
  adminAgents: { key: 'adminAgents', href: '/admin/agents', icon: Bot },
  adminConversations: {
    key: 'adminConversations',
    href: '/admin/conversations',
    icon: MessageSquare,
  },
  adminLeads: { key: 'adminLeads', href: '/admin/leads', icon: UserPlus },
  adminKnowledgeBases: {
    key: 'adminKnowledgeBases',
    href: '/admin/knowledge-bases',
    icon: BookOpen,
  },
  adminApiKeys: { key: 'adminApiKeys', href: '/admin/api-keys', icon: Key },
  adminInvoices: { key: 'adminInvoices', href: '/admin/invoices', icon: Receipt },
  adminWebhooks: { key: 'adminWebhooks', href: '/admin/webhooks', icon: Webhook },
  adminTags: { key: 'adminTags', href: '/admin/tags', icon: Tag },
  // Analytics & Insights
  analytics: { key: 'analytics', href: '/admin/analytics', icon: BarChart3 },
  tokenUsage: { key: 'tokenUsage', href: '/admin/token-usage', icon: Zap },
  csatAnalytics: { key: 'csatAnalytics', href: '/admin/csat-analytics', icon: Star },
  sentimentAnalysis: { key: 'sentimentAnalysis', href: '/admin/sentiment-analysis', icon: Heart },
  conversationQuality: {
    key: 'conversationQuality',
    href: '/admin/conversation-quality',
    icon: Star,
  },
  messageAnalytics: { key: 'messageAnalytics', href: '/admin/message-analytics', icon: BarChart3 },
  leadInsights: { key: 'leadInsights', href: '/admin/lead-insights', icon: TrendingUp },
  apiUsage: { key: 'apiUsage', href: '/admin/api-usage', icon: Key },
  reports: { key: 'reports', href: '/admin/reports', icon: FileText },
  // Content & Communications
  announcements: { key: 'announcements', href: '/admin/announcements', icon: Megaphone },
  faq: { key: 'faq', href: '/admin/faq', icon: HelpCircle },
  testimonials: { key: 'testimonials', href: '/admin/testimonials', icon: Quote },
  landingPageCms: { key: 'landingPageCms', href: '/admin/landing-page', icon: Globe },
  legal: { key: 'legal', href: '/admin/legal', icon: Scale },
  emailTemplates: { key: 'emailTemplates', href: '/admin/email-templates', icon: MailOpen },
  bulkEmail: { key: 'bulkEmail', href: '/admin/bulk-email', icon: Send },
  demoRequests: { key: 'demoRequests', href: '/admin/demo-requests', icon: ClipboardList },
  contactMessages: { key: 'contactMessages', href: '/admin/contact-messages', icon: Mail },
  notifications: { key: 'notifications', href: '/admin/notifications', icon: Bell },
  // Monitoring & Logs
  system: { key: 'system', href: '/admin/system', icon: Server },
  activityMonitor: { key: 'activityMonitor', href: '/admin/activity-monitor', icon: Radio },
  errorLogs: { key: 'errorLogs', href: '/admin/error-logs', icon: Bug },
  webhookLogs: { key: 'webhookLogs', href: '/admin/webhook-logs', icon: Webhook },
  auditLog: { key: 'auditLog', href: '/admin/audit-log', icon: ScrollText },
  loginActivity: { key: 'loginActivity', href: '/admin/login-activity', icon: Activity },
  dlq: { key: 'dlq', href: '/admin/dlq', icon: ArchiveX },
  // Security & Access
  blockedIPs: { key: 'blockedIPs', href: '/admin/blocked-ips', icon: ShieldBan },
  sessions: { key: 'sessions', href: '/admin/sessions', icon: Monitor },
  securityAudit: { key: 'securityAudit', href: '/admin/security-audit', icon: ShieldAlert },
  featureFlags: { key: 'featureFlags', href: '/admin/feature-flags', icon: ToggleLeft },
  // Settings
  adminSettings: { key: 'adminSettings', href: '/admin/settings', icon: Settings },
  plans: { key: 'plans', href: '/admin/plans', icon: Tags },
  config: { key: 'config', href: '/admin/config', icon: Wrench },
  aiModels: { key: 'aiModels', href: '/admin/ai-models', icon: Cpu },
  files: { key: 'files', href: '/admin/files', icon: FolderOpen },
  systemBackup: { key: 'systemBackup', href: '/admin/system-backup', icon: Database },
};

// ---------------------------------------------------------------------------
// Group definitions
// ---------------------------------------------------------------------------

const sidebarGroups: SidebarGroup[] = [
  // Top-level: Dashboard
  {
    key: 'dashboard',
    icon: LayoutDashboard,
    collapsible: false,
    items: [allItems.overview],
  },
  // Users & Subscriptions
  {
    key: 'usersAndOrgs',
    icon: Users,
    collapsible: true,
    items: [allItems.users, allItems.organizations, allItems.subscriptions, allItems.plans],
  },
  // Content & Marketing
  {
    key: 'contentAndComms',
    icon: Globe,
    collapsible: true,
    items: [
      allItems.landingPageCms,
      allItems.faq,
      allItems.testimonials,
      allItems.announcements,
      allItems.legal,
      allItems.demoRequests,
      allItems.contactMessages,
    ],
  },
  // Settings & Configuration
  {
    key: 'settings',
    icon: Settings,
    collapsible: true,
    items: [
      allItems.adminSettings,
      allItems.config,
      allItems.aiModels,
      allItems.emailTemplates,
      allItems.bulkEmail,
      allItems.notifications,
    ],
  },
  // System & Monitoring
  {
    key: 'monitoringAndLogs',
    icon: Server,
    collapsible: true,
    items: [
      allItems.system,
      allItems.errorLogs,
      allItems.webhookLogs,
      allItems.auditLog,
      allItems.loginActivity,
      allItems.tokenUsage,
      allItems.dlq,
      allItems.systemBackup,
    ],
  },
  // Security
  {
    key: 'securityAndAccess',
    icon: Shield,
    collapsible: true,
    items: [allItems.blockedIPs, allItems.sessions, allItems.featureFlags],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'admin-sidebar-groups';

function readExpandedState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupt data
  }
  return {};
}

function writeExpandedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

function isItemActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

function findActiveGroupKey(pathname: string): string | null {
  for (const group of sidebarGroups) {
    for (const item of group.items) {
      if (isItemActive(item.href, pathname)) return group.key;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminSidebar() {
  const t = useTranslations('admin.sidebar');
  const tUser = useTranslations('admin.userDetail');
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { isOpen, close } = useSidebar();

  // ---- expanded / collapsed state per group ----
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Default: all collapsible groups collapsed; dashboard always expanded.
    // Will be reconciled with localStorage + active page in useEffect below.
    return { dashboard: true };
  });

  // Hydrate from localStorage and auto-expand the active group on mount and
  // whenever the pathname changes.
  useEffect(() => {
    const stored = readExpandedState();
    const activeGroupKey = findActiveGroupKey(pathname);

    setExpanded((prev) => {
      const next: Record<string, boolean> = { ...prev, ...stored, dashboard: true };
      if (activeGroupKey && activeGroupKey !== 'dashboard') {
        next[activeGroupKey] = true;
      }
      return next;
    });
  }, [pathname]);

  // Close mobile sidebar on navigation.
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Toggle a collapsible group and persist the new state.
  const toggleGroup = useCallback((groupKey: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      writeExpandedState(next);
      return next;
    });
  }, []);

  // ---- user display ----
  const displayName = user ? `${user.firstName} ${user.lastName}` : t('admin');
  const initials = user ? `${user.firstName[0] || ''}${user.lastName[0] || ''}` : 'A';

  // ---- logout ----
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      clearAuth();
      router.push('/login');
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e bg-card transition-transform duration-300 md:static md:translate-x-0 md:rtl:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full',
        )}
      >
        {/* Logo + Admin Badge */}
        <div className="flex h-16 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white font-bold text-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold">Mojeeb</span>
              <span className="ms-1 text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                Admin
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Back to Dashboard */}
        <div className="border-b p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>{t('backToDashboard')}</span>
          </Link>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {sidebarGroups.map((group) => {
              const GroupIcon = group.icon;
              const isExpanded = group.collapsible ? !!expanded[group.key] : true;

              return (
                <div key={group.key}>
                  {/* Group header */}
                  {group.collapsible ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    >
                      <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 text-start">{t('groups.' + group.key)}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </button>
                  ) : null}

                  {/* Group items */}
                  {isExpanded && (
                    <ul className={cn('space-y-0.5', group.collapsible && 'ps-3')}>
                      {group.items.map((item) => {
                        const active = isItemActive(item.href, pathname);
                        const Icon = item.icon;

                        return (
                          <li key={item.key}>
                            <Link
                              href={item.href}
                              className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                active
                                  ? 'bg-red-600/10 text-red-600 dark:text-red-400'
                                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span>{t(item.key)}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Theme toggle */}
        <div className="px-3 pb-2">
          <ThemeToggle />
        </div>

        {/* User section */}
        <div className="border-t p-3 relative">
          {showMenu && (
            <div className="absolute bottom-full start-3 end-3 mb-1 rounded-lg border bg-card shadow-lg">
              <div className="p-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600/10 text-red-600 text-sm font-medium">
              {initials}
            </div>
            <div className="flex-1 truncate text-start">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-red-600 dark:text-red-400 truncate">
                {tUser('superAdmin')}
              </p>
            </div>
            <ChevronUp
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                !showMenu && 'rotate-180',
              )}
            />
          </button>
        </div>
      </aside>
    </>
  );
}
