import { DeliveryStatus } from '@prisma/client';

/** One delivery receipt from a WhatsApp Cloud API webhook (`value.statuses[]`). */
export interface WhatsAppStatusUpdate {
  /** The wamid Meta returned when we sent the message (stored as Message.externalId). */
  externalMessageId: string;
  /** Business phone number the receipt belongs to (`value.metadata.phone_number_id`). */
  phoneNumberId: string;
  status: DeliveryStatus;
  timestamp: Date;
  recipientId?: string;
  failureReason?: string;
}

const STATUS_MAP: Record<string, DeliveryStatus> = {
  sent: DeliveryStatus.SENT,
  delivered: DeliveryStatus.DELIVERED,
  read: DeliveryStatus.READ,
  failed: DeliveryStatus.FAILED,
};

interface RawStatusError {
  code?: number | string;
  title?: string;
  message?: string;
  error_data?: { details?: string };
}

/**
 * Short, groupable failure reason from Meta's `errors[]`, e.g.
 * "Message undeliverable (131026)". Details vary per recipient, so they are left out to
 * keep the admin "top failure reasons" breakdown meaningful.
 */
export function formatWhatsAppFailureReason(errors: unknown): string | undefined {
  const first = (Array.isArray(errors) ? errors[0] : undefined) as RawStatusError | undefined;
  if (!first || typeof first !== 'object') return undefined;
  const title = first.title || first.message || first.error_data?.details;
  const code = first.code !== undefined && first.code !== null ? String(first.code) : '';
  if (title && code) return `${title} (${code})`;
  if (title) return String(title);
  if (code) return `WhatsApp error ${code}`;
  return undefined;
}

/**
 * Extract delivery receipts from a WhatsApp webhook payload. Malformed entries, unknown
 * status values and receipts that cannot be tied to a phone number are skipped — the
 * caller must be able to scope every receipt to a channel.
 */
export function parseWhatsAppStatuses(payload: unknown): WhatsAppStatusUpdate[] {
  const updates: WhatsAppStatusUpdate[] = [];
  const data = payload as { entry?: unknown } | null | undefined;
  if (!data || typeof data !== 'object' || !Array.isArray(data.entry)) return updates;

  for (const entry of data.entry as any[]) {
    if (!entry || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!change || change.field !== 'messages') continue;
      const value = change.value;
      if (!value || !Array.isArray(value.statuses)) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (typeof phoneNumberId !== 'string' || !phoneNumberId) continue;

      for (const raw of value.statuses) {
        if (!raw || typeof raw.id !== 'string' || !raw.id) continue;
        const status = STATUS_MAP[String(raw.status)];
        if (!status) continue;

        const seconds = parseInt(String(raw.timestamp), 10);
        updates.push({
          externalMessageId: raw.id,
          phoneNumberId,
          status,
          timestamp: Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(),
          recipientId: typeof raw.recipient_id === 'string' ? raw.recipient_id : undefined,
          failureReason:
            status === DeliveryStatus.FAILED ? formatWhatsAppFailureReason(raw.errors) : undefined,
        });
      }
    }
  }

  return updates;
}
