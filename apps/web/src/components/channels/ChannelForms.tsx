'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Channel, ChannelType } from '@/hooks/useChannels';
import {
  MessageCircle,
  Facebook,
  Instagram,
  Globe,
  X,
  Check,
  Copy,
  Loader2,
  AlertTriangle,
  Settings,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Channel config
// ---------------------------------------------------------------------------

export const CHANNEL_CONFIG: Record<
  string,
  {
    type: ChannelType;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    popular: boolean;
  }
> = {
  whatsapp: {
    type: 'WHATSAPP',
    icon: MessageCircle,
    color: 'bg-green-500',
    popular: true,
  },
  messenger: {
    type: 'MESSENGER',
    icon: Facebook,
    color: 'bg-blue-500',
    popular: false,
  },
  instagram: {
    type: 'INSTAGRAM',
    icon: Instagram,
    color: 'bg-pink-500',
    popular: false,
  },
  webchat: {
    type: 'WEBCHAT',
    icon: Globe,
    color: 'bg-purple-500',
    popular: true,
  },
};

export const CHANNEL_KEYS = ['whatsapp', 'messenger', 'instagram', 'webchat'] as const;

export function getChannelKey(type: ChannelType): string {
  return type.toLowerCase();
}

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border bg-card p-4 sm:p-6 shadow-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form field component
// ---------------------------------------------------------------------------

export function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ms-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp connect form
// ---------------------------------------------------------------------------

export function WhatsAppForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (credentials: Record<string, string>, name: string) => void;
  isPending: boolean;
}) {
  const t = useTranslations('dashboard.channels');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ phoneNumberId, accessToken, appSecret, verifyToken }, `WhatsApp - ${phoneNumberId}`);
  };

  const isValid =
    phoneNumberId.trim() && accessToken.trim() && appSecret.trim() && verifyToken.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        {t('whatsappInstructions')}
      </div>
      <FormField
        label={t('phoneNumberId')}
        value={phoneNumberId}
        onChange={setPhoneNumberId}
        placeholder="e.g. 123456789012345"
      />
      <FormField
        label={t('accessToken')}
        value={accessToken}
        onChange={setAccessToken}
        placeholder="EAAx..."
      />
      <FormField
        label={t('appSecret')}
        value={appSecret}
        onChange={setAppSecret}
        placeholder="abcdef123456..."
      />
      <FormField
        label={t('verifyToken')}
        value={verifyToken}
        onChange={setVerifyToken}
        placeholder="my-custom-verify-token"
      />
      <button
        type="submit"
        disabled={!isValid || isPending}
        className={cn(
          'w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          (!isValid || isPending) && 'cursor-not-allowed opacity-50',
        )}
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('connecting')}
          </span>
        ) : (
          t('connect')
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Messenger connect form
// ---------------------------------------------------------------------------

export function MessengerForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (credentials: Record<string, string>, name: string) => void;
  isPending: boolean;
}) {
  const t = useTranslations('dashboard.channels');
  const [pageId, setPageId] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ pageId, pageAccessToken }, `Messenger - ${pageId}`);
  };

  const isValid = pageId.trim() && pageAccessToken.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        {t('messengerInstructions')}
      </div>
      <FormField
        label={t('pageId')}
        value={pageId}
        onChange={setPageId}
        placeholder="e.g. 123456789012345"
      />
      <FormField
        label={t('pageAccessToken')}
        value={pageAccessToken}
        onChange={setPageAccessToken}
        placeholder="EAAx..."
      />
      <button
        type="submit"
        disabled={!isValid || isPending}
        className={cn(
          'w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          (!isValid || isPending) && 'cursor-not-allowed opacity-50',
        )}
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('connecting')}
          </span>
        ) : (
          t('connect')
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Instagram connect form
// ---------------------------------------------------------------------------

export function InstagramForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (credentials: Record<string, string>, name: string) => void;
  isPending: boolean;
}) {
  const t = useTranslations('dashboard.channels');
  const [accountId, setAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ accountId, accessToken }, `Instagram - ${accountId}`);
  };

  const isValid = accountId.trim() && accessToken.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        {t('instagramInstructions')}
      </div>
      <FormField
        label={t('accountId')}
        value={accountId}
        onChange={setAccountId}
        placeholder="e.g. 17841405..."
      />
      <FormField
        label={t('accessToken')}
        value={accessToken}
        onChange={setAccessToken}
        placeholder="EAAx..."
      />
      <button
        type="submit"
        disabled={!isValid || isPending}
        className={cn(
          'w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          (!isValid || isPending) && 'cursor-not-allowed opacity-50',
        )}
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('connecting')}
          </span>
        ) : (
          t('connect')
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// WebChat connect form
// ---------------------------------------------------------------------------

export function WebChatForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (credentials: Record<string, string>, name: string) => void;
  isPending: boolean;
}) {
  const t = useTranslations('dashboard.channels');
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [greeting, setGreeting] = useState('');
  const [position, setPosition] = useState('bottom-right');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ primaryColor, greeting, position }, name);
  };

  const isValid = name.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        {t('webchatInstructions')}
      </div>
      <FormField
        label={t('channelName')}
        value={name}
        onChange={setName}
        placeholder={t('channelNamePlaceholder')}
      />

      {/* Color Picker */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">{t('primaryColor')}</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded border bg-background p-0.5"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => {
              let val = e.target.value;
              if (!val.startsWith('#')) val = '#' + val;
              if (/^#[0-9a-fA-F]{0,6}$/.test(val)) setPrimaryColor(val);
            }}
            onBlur={() => {
              if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) setPrimaryColor('#6366f1');
            }}
            dir="ltr"
            maxLength={7}
            className="w-24 rounded border bg-background px-2 py-1 text-xs font-mono outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="#000000"
          />
        </div>
      </div>

      {/* Greeting Message */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">{t('greeting')}</label>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder={t('greetingPlaceholder')}
          rows={3}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary resize-none"
        />
      </div>

      {/* Widget Position */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">{t('widgetPosition')}</label>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
        >
          <option value="bottom-right">{t('positionBottomRight')}</option>
          <option value="bottom-left">{t('positionBottomLeft')}</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={!isValid || isPending}
        className={cn(
          'w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          (!isValid || isPending) && 'cursor-not-allowed opacity-50',
        )}
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('connecting')}
          </span>
        ) : (
          t('connect')
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// WebChat settings panel (shown for connected webchat channels)
// ---------------------------------------------------------------------------

export function WebChatSettingsPanel({
  channel,
  onSave,
  isPending,
}: {
  channel: Channel;
  onSave: (
    channelId: string,
    settings: { primaryColor?: string; greeting?: string; position?: string },
  ) => void;
  isPending: boolean;
}) {
  const t = useTranslations('dashboard.channels');
  const creds = channel.credentials || {};

  const [primaryColor, setPrimaryColor] = useState(creds.primaryColor || '#6366f1');
  const [greeting, setGreeting] = useState(creds.greeting || '');
  const [position, setPosition] = useState(creds.position || 'bottom-right');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(channel.id, { primaryColor, greeting, position });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-4 rounded-lg border p-4 space-y-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Settings className="h-4 w-4 text-muted-foreground" />
        {t('webchatSettings')}
      </h4>

      {/* Color Picker */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t('primaryColor')}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded border bg-background p-0.5"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => {
              let val = e.target.value;
              if (!val.startsWith('#')) val = '#' + val;
              if (/^#[0-9a-fA-F]{0,6}$/.test(val)) setPrimaryColor(val);
            }}
            onBlur={() => {
              if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) setPrimaryColor('#6366f1');
            }}
            dir="ltr"
            maxLength={7}
            className="w-24 rounded border bg-background px-2 py-1 text-xs font-mono outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="#000000"
          />
        </div>
      </div>

      {/* Greeting Message */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t('greeting')}
        </label>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder={t('greetingPlaceholder')}
          rows={3}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary resize-none"
        />
      </div>

      {/* Widget Position */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t('widgetPosition')}
        </label>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
        >
          <option value="bottom-right">{t('positionBottomRight')}</option>
          <option value="bottom-left">{t('positionBottomLeft')}</option>
        </select>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isPending}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          isPending && 'cursor-not-allowed opacity-50',
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('savingSettings')}
          </>
        ) : saved ? (
          <>
            <Check className="h-4 w-4" />
            {t('settingsSaved')}
          </>
        ) : (
          t('saveSettings')
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connect modal - renders the right form based on channel type
// ---------------------------------------------------------------------------

export function ConnectModal({
  open,
  onClose,
  channelKey,
  onConnect,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  channelKey: string;
  onConnect: (type: ChannelType, credentials: Record<string, string>, name: string) => void;
  isPending: boolean;
}) {
  const t = useTranslations('dashboard.channels');

  const config = CHANNEL_CONFIG[channelKey];
  if (!config) return null;

  const titleKey = `connect${channelKey.charAt(0).toUpperCase() + channelKey.slice(1)}` as
    | 'connectWhatsApp'
    | 'connectMessenger'
    | 'connectInstagram'
    | 'connectWebchat';

  const handleSubmit = (credentials: Record<string, string>, name: string) => {
    onConnect(config.type, credentials, name);
  };

  return (
    <Modal open={open} onClose={onClose} title={t(titleKey)}>
      {channelKey === 'whatsapp' && <WhatsAppForm onSubmit={handleSubmit} isPending={isPending} />}
      {channelKey === 'messenger' && (
        <MessengerForm onSubmit={handleSubmit} isPending={isPending} />
      )}
      {channelKey === 'instagram' && (
        <InstagramForm onSubmit={handleSubmit} isPending={isPending} />
      )}
      {channelKey === 'webchat' && <WebChatForm onSubmit={handleSubmit} isPending={isPending} />}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Disconnect confirm modal
// ---------------------------------------------------------------------------

export function DisconnectModal({
  open,
  onClose,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const t = useTranslations('dashboard.channels');

  return (
    <Modal open={open} onClose={onClose} title={t('disconnect')}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/40">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">{t('disconnectConfirm')}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t('close')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90',
              isPending && 'cursor-not-allowed opacity-50',
            )}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('disconnect')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// WebChat embed code display
// ---------------------------------------------------------------------------

export function EmbedCodeBlock({ channel }: { channel: Channel }) {
  const t = useTranslations('dashboard.channels');
  const [copied, setCopied] = useState(false);
  const [embedMode, setEmbedMode] = useState<'default' | 'headless'>('default');

  const baseUrl =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace('/api/v1', '')
      : '';

  const defaultEmbed = `<script id="mojeeb-chat-widget"
  src="${baseUrl}/widget.js"
  data-channel-id="${channel.id}"
  data-mode="default"
  data-config='{}'>
</script>`;

  const headlessEmbed = `<!-- 1. Add the widget script -->
<script id="mojeeb-chat-widget"
  src="${baseUrl}/widget.js"
  data-channel-id="${channel.id}"
  data-mode="headless"
  data-config='{}'>
</script>

<!-- 2. Use your own button -->
<button id="my-chat-btn">Chat with us</button>

<!-- 3. Attach the widget to your button -->
<script>
  document.addEventListener('DOMContentLoaded', function() {
    MojeebWidget.attach('#my-chat-btn');
  });
</script>`;

  const embedCode = embedMode === 'default' ? defaultEmbed : headlessEmbed;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [embedCode]);

  return (
    <div className="mt-3">
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {t('embedCode')}
      </label>

      {/* Mode toggle */}
      <div className="mb-2 flex gap-2">
        <button
          onClick={() => setEmbedMode('default')}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
            embedMode === 'default'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {t('defaultMode')}
        </button>
        <button
          onClick={() => setEmbedMode('headless')}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
            embedMode === 'headless'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {t('headlessMode')}
        </button>
      </div>

      <div className="relative">
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
          <code>{embedCode}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-lg bg-background border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              {t('copied')}
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              {t('copyCode')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
