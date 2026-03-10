'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { fmtDate } from '@/lib/dateFormat';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/useApiKeys';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { ApiKeyCreated } from '@/hooks/useApiKeys';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  Loader2,
  Code,
  BookOpen,
  Terminal,
  Shield,
  Building,
} from 'lucide-react';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

export default function ApiKeysPage() {
  const t = useTranslations('dashboard.apiKeys');
  const tc = useTranslations('common');
  const ts = useTranslations('dashboard.sidebar');
  const tb = useTranslations('dashboard.breadcrumb');
  const locale = useLocale();
  const orgId = useAuthStore((s) => s.organization?.id);

  const { data: apiKeys, isLoading: apiKeysLoading, error, isError, refetch } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();
  const { confirmProps, confirm } = useConfirmDialog();

  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [activeDocTab, setActiveDocTab] = useState<'overview' | 'auth' | 'endpoints' | 'examples'>(
    'overview',
  );
  const [copiedOrgId, setCopiedOrgId] = useState(false);

  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) return;
    createApiKey.mutate(
      { name: newKeyName.trim() },
      {
        onSuccess: (data) => {
          setCreatedKey(data);
          setNewKeyName('');
          setShowNewKeyDialog(false);
          toast.success(tc('toast.apiKeyCreated'));
        },
        onError: () => toast.error(tc('toast.apiKeyCreateFailed')),
      },
    );
  };

  const handleRevokeApiKey = (keyId: string) => {
    confirm({
      title: t('revoke'),
      message: t('revokeConfirm'),
      confirmLabel: t('revoke'),
      cancelLabel: t('cancel'),
      variant: 'danger',
      onConfirm: () => {
        revokeApiKey.mutate(keyId, {
          onSuccess: () => toast.success(tc('toast.apiKeyRevoked')),
          onError: () => toast.error(tc('toast.apiKeyRevokeFailed')),
        });
      },
    });
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(key);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCopyOrgId = () => {
    if (orgId) {
      navigator.clipboard.writeText(orgId);
      setCopiedOrgId(true);
      setTimeout(() => setCopiedOrgId(false), 2000);
    }
  };

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.mojeeb.app/api/v1';

  return (
    <>
      <div>
        <Breadcrumb
          items={[{ label: tb('dashboard'), href: '/dashboard' }, { label: ts('apiKeys') }]}
          className="mb-4"
        />

        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>

        <div className="mx-auto max-w-4xl space-y-6">
          {/* Organization ID Section */}
          {orgId && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                {t('orgIdSection')}
              </h2>
              <p className="text-sm text-muted-foreground mb-3">{t('orgIdDescription')}</p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 rounded-lg bg-background border px-4 py-2.5 text-sm font-mono"
                  dir="ltr"
                >
                  {orgId}
                </code>
                <button
                  type="button"
                  onClick={handleCopyOrgId}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                  {copiedOrgId ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      {t('copyOrgId')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* API Keys Management */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              {t('manageKeys')}
            </h2>

            {/* Created key banner */}
            {createdKey && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-300">
                  {t('keyCreated')}
                </p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 rounded bg-white px-3 py-1.5 text-xs font-mono dark:bg-gray-900"
                    dir="ltr"
                  >
                    {createdKey.key}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyKey(createdKey.key)}
                    className="rounded-lg border px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    {copiedKeyId === createdKey.key ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t('copyWarning')}</p>
                <button
                  type="button"
                  onClick={() => setCreatedKey(null)}
                  className="mt-2 text-xs text-green-700 underline dark:text-green-400"
                >
                  {t('dismiss')}
                </button>
              </div>
            )}

            {/* Create new key */}
            {showNewKeyDialog ? (
              <div className="mb-4 flex items-center gap-2">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={t('keyNamePlaceholder')}
                  className={cn(inputClass, 'flex-1')}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateApiKey();
                    if (e.key === 'Escape') {
                      setShowNewKeyDialog(false);
                      setNewKeyName('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateApiKey}
                  disabled={createApiKey.isPending || !newKeyName.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {createApiKey.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {t('create')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewKeyDialog(false);
                    setNewKeyName('');
                  }}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                >
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowNewKeyDialog(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  {t('create')}
                </button>
              </div>
            )}

            {/* API keys list */}
            {apiKeysLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} variant="rect" height={48} />
                ))}
              </div>
            ) : isError ? (
              <ErrorState
                title={t('errorLoadingKeys') || 'Failed to load API keys'}
                description={t('errorLoadingKeysDesc') || 'There was a problem loading your API keys. Please try again.'}
                retryLabel={t('retry') || 'Retry'}
                onRetry={() => refetch()}
              />
            ) : apiKeys && apiKeys.length > 0 ? (
              <div className="space-y-2">
                {apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 rounded-lg border px-4 py-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{apiKey.name}</span>
                        <code
                          className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
                          dir="ltr"
                        >
                          {apiKey.keyPrefix}...
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('createdOn')} {fmtDate(apiKey.createdAt, locale)}
                        {apiKey.lastUsedAt && (
                          <>
                            {' '}
                            &middot; {t('lastUsed')} {fmtDate(apiKey.lastUsedAt, locale)}
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeApiKey(apiKey.id)}
                      disabled={revokeApiKey.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('revoke')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Key}
                title={t('noKeys') || 'No API keys yet'}
                description={t('noKeysDesc') || 'Create your first API key to start using the Mojeeb API.'}
                action={{
                  label: t('create') || 'Create API Key',
                  onClick: () => setShowNewKeyDialog(true),
                }}
              />
            )}
          </div>

          {/* API Documentation */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              {t('documentation')}
            </h2>

            {/* Doc tabs */}
            <div className="flex gap-1 mb-6 border-b overflow-x-auto">
              {(['overview', 'auth', 'endpoints', 'examples'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveDocTab(tab)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                    activeDocTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`docs.${tab}`)}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeDocTab === 'overview' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('docs.overviewText')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4">
                    <Code className="h-5 w-5 text-primary mb-2" />
                    <h4 className="text-sm font-semibold mb-1">{t('docs.restApi')}</h4>
                    <p className="text-xs text-muted-foreground">{t('docs.restApiDesc')}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <Shield className="h-5 w-5 text-primary mb-2" />
                    <h4 className="text-sm font-semibold mb-1">{t('docs.secure')}</h4>
                    <p className="text-xs text-muted-foreground">{t('docs.secureDesc')}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <Terminal className="h-5 w-5 text-primary mb-2" />
                    <h4 className="text-sm font-semibold mb-1">{t('docs.easyIntegration')}</h4>
                    <p className="text-xs text-muted-foreground">{t('docs.easyIntegrationDesc')}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="text-sm font-semibold mb-1">{t('docs.baseUrl')}</h4>
                  <code className="text-xs font-mono text-primary" dir="ltr">
                    {baseUrl}
                  </code>
                </div>
              </div>
            )}

            {/* Auth Tab */}
            {activeDocTab === 'auth' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('docs.authText')}</p>
                <div className="rounded-lg bg-gray-900 p-4 overflow-x-auto" dir="ltr">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre">
                    {`# Include your API key in the Authorization header
curl -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     ${baseUrl}/organizations/${orgId || '{orgId}'}/agents`}
                  </pre>
                </div>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
                  <p className="text-xs text-yellow-800 dark:text-yellow-300">
                    <strong>{t('docs.important')}:</strong> {t('docs.keepSecure')}
                  </p>
                </div>
              </div>
            )}

            {/* Endpoints Tab */}
            {activeDocTab === 'endpoints' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">{t('docs.endpointsText')}</p>

                {/* Agents */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold">{t('docs.agentsApi')}</h4>
                  </div>
                  <div className="divide-y" dir="ltr">
                    {[
                      {
                        method: 'GET',
                        path: '/organizations/{orgId}/agents',
                        descKey: 'docs.listAgents',
                      },
                      {
                        method: 'POST',
                        path: '/organizations/{orgId}/agents',
                        descKey: 'docs.createAgent',
                      },
                      {
                        method: 'GET',
                        path: '/organizations/{orgId}/agents/{agentId}',
                        descKey: 'docs.getAgent',
                      },
                      {
                        method: 'PATCH',
                        path: '/organizations/{orgId}/agents/{agentId}',
                        descKey: 'docs.updateAgent',
                      },
                      {
                        method: 'DELETE',
                        path: '/organizations/{orgId}/agents/{agentId}',
                        descKey: 'docs.deleteAgent',
                      },
                      {
                        method: 'POST',
                        path: '/organizations/{orgId}/agents/{agentId}/test',
                        descKey: 'docs.testAgent',
                      },
                    ].map((ep) => (
                      <div
                        key={ep.path + ep.method}
                        className="flex items-center gap-3 px-4 py-2 text-xs"
                      >
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 font-mono font-bold',
                            ep.method === 'GET' &&
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                            ep.method === 'POST' &&
                              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                            ep.method === 'PATCH' &&
                              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                            ep.method === 'DELETE' &&
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                          )}
                        >
                          {ep.method}
                        </span>
                        <code className="font-mono text-muted-foreground flex-1">{ep.path}</code>
                        <span className="text-muted-foreground">{t(ep.descKey)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conversations */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold">{t('docs.conversationsApi')}</h4>
                  </div>
                  <div className="divide-y" dir="ltr">
                    {[
                      {
                        method: 'GET',
                        path: '/organizations/{orgId}/conversations',
                        descKey: 'docs.listConversations',
                      },
                      {
                        method: 'GET',
                        path: '/organizations/{orgId}/conversations/{id}',
                        descKey: 'docs.getConversation',
                      },
                      {
                        method: 'POST',
                        path: '/organizations/{orgId}/conversations/{id}/messages',
                        descKey: 'docs.sendMessage',
                      },
                    ].map((ep) => (
                      <div
                        key={ep.path + ep.method}
                        className="flex items-center gap-3 px-4 py-2 text-xs"
                      >
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 font-mono font-bold',
                            ep.method === 'GET' &&
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                            ep.method === 'POST' &&
                              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                          )}
                        >
                          {ep.method}
                        </span>
                        <code className="font-mono text-muted-foreground flex-1">{ep.path}</code>
                        <span className="text-muted-foreground">{t(ep.descKey)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Knowledge Base */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold">{t('docs.knowledgeBaseApi')}</h4>
                  </div>
                  <div className="divide-y" dir="ltr">
                    {[
                      {
                        method: 'GET',
                        path: '/organizations/{orgId}/knowledge-bases',
                        descKey: 'docs.listKnowledgeBases',
                      },
                      {
                        method: 'POST',
                        path: '/organizations/{orgId}/knowledge-bases',
                        descKey: 'docs.createKb',
                      },
                      {
                        method: 'GET',
                        path: '/organizations/{orgId}/knowledge-bases/{id}',
                        descKey: 'docs.getKnowledgeBase',
                      },
                      {
                        method: 'DELETE',
                        path: '/organizations/{orgId}/knowledge-bases/{id}',
                        descKey: 'docs.deleteKnowledgeBase',
                      },
                      {
                        method: 'POST',
                        path: '/organizations/{orgId}/knowledge-bases/{id}/documents',
                        descKey: 'docs.addDocument',
                      },
                    ].map((ep) => (
                      <div
                        key={ep.path + ep.method}
                        className="flex items-center gap-3 px-4 py-2 text-xs"
                      >
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 font-mono font-bold',
                            ep.method === 'GET' &&
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                            ep.method === 'POST' &&
                              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                            ep.method === 'DELETE' &&
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                          )}
                        >
                          {ep.method}
                        </span>
                        <code className="font-mono text-muted-foreground flex-1">{ep.path}</code>
                        <span className="text-muted-foreground">{t(ep.descKey)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analytics */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold">{t('docs.analyticsApi')}</h4>
                  </div>
                  <div className="divide-y" dir="ltr">
                    {[
                      {
                        method: 'GET',
                        path: '/organizations/{orgId}/analytics/overview',
                        descKey: 'docs.getAnalytics',
                      },
                      {
                        method: 'GET',
                        path: '/organizations/{orgId}/leads',
                        descKey: 'docs.listLeads',
                      },
                      {
                        method: 'GET',
                        path: '/organizations/{orgId}/leads/stats',
                        descKey: 'docs.leadStatistics',
                      },
                    ].map((ep) => (
                      <div
                        key={ep.path + ep.method}
                        className="flex items-center gap-3 px-4 py-2 text-xs"
                      >
                        <span className="rounded px-2 py-0.5 font-mono font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {ep.method}
                        </span>
                        <code className="font-mono text-muted-foreground flex-1">{ep.path}</code>
                        <span className="text-muted-foreground">{t(ep.descKey)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Examples Tab */}
            {activeDocTab === 'examples' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t('docs.listAgents')}</h4>
                  <div className="rounded-lg bg-gray-900 p-4 overflow-x-auto" dir="ltr">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre">
                      {`curl -X GET \\
  "${baseUrl}/organizations/${orgId || '{orgId}'}/agents" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"

# Response:
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "name": "Customer Support Bot",
      "aiProvider": "OPENAI",
      "aiModel": "gpt-4o",
      "isActive": true,
      ...
    }
  ]
}`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">{t('docs.createAgent')}</h4>
                  <div className="rounded-lg bg-gray-900 p-4 overflow-x-auto" dir="ltr">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre">
                      {`curl -X POST \\
  "${baseUrl}/organizations/${orgId || '{orgId}'}/agents" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Sales Assistant",
    "description": "Helps customers with product questions",
    "systemPrompt": "You are a helpful sales assistant...",
    "language": "ar",
    "aiProvider": "OPENAI",
    "aiModel": "gpt-4o"
  }'

# Response:
{
  "success": true,
  "data": {
    "id": "clx...",
    "name": "Sales Assistant",
    "isActive": true,
    ...
  }
}`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">{t('docs.testAgent')}</h4>
                  <div className="rounded-lg bg-gray-900 p-4 overflow-x-auto" dir="ltr">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre">
                      {`curl -X POST \\
  "${baseUrl}/organizations/${orgId || '{orgId}'}/agents/{agentId}/test" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello, what are your business hours?"}'

# Response:
{
  "success": true,
  "data": {
    "reply": "Our business hours are...",
    "tokensUsed": 150
  }
}`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">{t('docs.sendMessage')}</h4>
                  <div className="rounded-lg bg-gray-900 p-4 overflow-x-auto" dir="ltr">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre">
                      {`curl -X POST \\
  "${baseUrl}/organizations/${orgId || '{orgId}'}/conversations/{conversationId}/messages" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Thank you for contacting us!",
    "role": "AGENT"
  }'

# Response:
{
  "success": true,
  "data": {
    "id": "clx...",
    "content": "Thank you for contacting us!",
    "role": "AGENT",
    "createdAt": "2025-01-15T10:30:00Z",
    ...
  }
}`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">{t('docs.getAnalytics')}</h4>
                  <div className="rounded-lg bg-gray-900 p-4 overflow-x-auto" dir="ltr">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre">
                      {`curl -X GET \\
  "${baseUrl}/organizations/${orgId || '{orgId}'}/analytics/overview" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"

# Response:
{
  "success": true,
  "data": {
    "totalConversations": 1250,
    "totalMessages": 8430,
    "activeConversations": 23,
    "resolvedConversations": 1180,
    "avgResponseTime": 1200,
    "handoffRate": 0.05,
    ...
  }
}`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">{t('docs.createKb')}</h4>
                  <div className="rounded-lg bg-gray-900 p-4 overflow-x-auto" dir="ltr">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre">
                      {`curl -X POST \\
  "${baseUrl}/organizations/${orgId || '{orgId}'}/knowledge-bases" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Product FAQ",
    "description": "Frequently asked questions"
  }'

# Response:
{
  "success": true,
  "data": {
    "id": "clx...",
    "name": "Product FAQ",
    ...
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </>
  );
}
