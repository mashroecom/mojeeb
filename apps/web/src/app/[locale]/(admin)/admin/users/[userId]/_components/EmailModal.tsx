'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSendUserEmail } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { Send, X, Loader2 } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
}

export function EmailModal({
  isOpen,
  onClose,
  userId,
  userEmail,
}: EmailModalProps) {
  const t = useTranslations('admin');
  const addToast = useToastStore((s) => s.addToast);
  const sendEmail = useSendUserEmail();

  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setEmailSubject('');
    setEmailBody('');
    onClose();
  };

  const handleSend = () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      addToast('error', t('userActions.emailFieldsRequired'));
      return;
    }
    sendEmail.mutate(
      { userId, subject: emailSubject, body: emailBody },
      {
        onSuccess: () => {
          addToast('success', t('userActions.emailSent'));
          handleClose();
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {t('userActions.sendEmailTo')} {userEmail}
          </h3>
          <button
            onClick={handleClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('userActions.emailSubject')}
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={t('userActions.emailSubjectPlaceholder')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('userActions.emailBody')}
            </label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder={t('userActions.emailBodyPlaceholder')}
              rows={6}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleClose}
              className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSend}
              disabled={sendEmail.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {sendEmail.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t('userActions.send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
