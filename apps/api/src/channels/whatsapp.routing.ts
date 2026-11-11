import crypto from 'crypto';

/**
 * Pure helpers that decide which channel (tenant) a WhatsApp webhook event belongs to and
 * whether the request is authentic for it. No database or config access.
 */

function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Check Meta's `X-Hub-Signature-256` header against the raw request body. */
export function verifyMetaSignature(rawBody: Buffer, signature: unknown, secret: string): boolean {
  if (typeof signature !== 'string' || !signature || !secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualStrings(expected, signature);
}

/** A webhook verification token is valid when it equals one of the configured tokens. */
export function matchesVerifyToken(token: unknown, configured: (string | undefined)[]): boolean {
  if (typeof token !== 'string' || !token) return false;
  let matched = false;
  for (const candidate of configured) {
    // No early exit: compare against every candidate
    if (candidate && timingSafeEqualStrings(candidate, token)) matched = true;
  }
  return matched;
}

export interface WhatsAppEventGroup {
  /** `value.metadata.phone_number_id`, or null when the change does not carry one. */
  phoneNumberId: string | null;
  /** A webhook payload containing only this number's `messages` changes. */
  payload: { object?: unknown; entry: { id?: unknown; changes: unknown[] }[] };
}

/**
 * Split a webhook payload by business phone number. One request can carry changes for
 * several numbers, and each number belongs to a different channel (and organization).
 */
export function groupWhatsAppChangesByPhoneNumber(payload: unknown): WhatsAppEventGroup[] {
  const groups = new Map<string | null, WhatsAppEventGroup>();
  const data = payload as { object?: unknown; entry?: unknown } | null | undefined;
  if (!data || typeof data !== 'object' || !Array.isArray(data.entry)) return [];

  for (const entry of data.entry as any[]) {
    if (!entry || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!change || change.field !== 'messages') continue;
      const raw = change.value?.metadata?.phone_number_id;
      const phoneNumberId = typeof raw === 'string' && raw ? raw : null;

      let group = groups.get(phoneNumberId);
      if (!group) {
        group = { phoneNumberId, payload: { object: data.object, entry: [] } };
        groups.set(phoneNumberId, group);
      }
      group.payload.entry.push({ id: entry.id, changes: [change] });
    }
  }

  return [...groups.values()];
}

export interface WhatsAppChannelCandidate {
  id: string;
  isActive: boolean;
  createdAt: Date;
  /** The channel's own Meta app secret (decrypted), if the organization provided one. */
  appSecret?: string | null;
}

export type WhatsAppChannelResolution<T extends WhatsAppChannelCandidate> =
  | { status: 'ok'; channel: T; verifiedBy: 'channel-secret' | 'platform-secret' }
  | { status: 'unknown_number' }
  | { status: 'bad_signature' };

function preferred<T extends WhatsAppChannelCandidate>(channels: T[]): T {
  // Active channels first, then the one that was connected first
  return [...channels].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) || a.createdAt.getTime() - b.createdAt.getTime(),
  )[0]!;
}

/**
 * Pick the channel an event for one phone number belongs to.
 *
 * `candidates` must be exactly the WhatsApp channels registered for that phone number id —
 * there is deliberately no fallback to "some other WhatsApp channel". The request is
 * accepted when it is signed with that channel's own app secret, or with the platform's
 * app secret (`platformSignatureValid`). A request signed with one organization's secret
 * can therefore never be applied to another organization's number.
 */
export function resolveWhatsAppChannel<T extends WhatsAppChannelCandidate>(
  candidates: T[],
  platformSignatureValid: boolean,
  verifyWithSecret: (secret: string) => boolean,
): WhatsAppChannelResolution<T> {
  const ownSecretMatches = candidates.filter(
    (channel) => !!channel.appSecret && verifyWithSecret(channel.appSecret),
  );
  if (ownSecretMatches.length > 0) {
    return { status: 'ok', channel: preferred(ownSecretMatches), verifiedBy: 'channel-secret' };
  }
  if (!platformSignatureValid) return { status: 'bad_signature' };
  if (candidates.length === 0) return { status: 'unknown_number' };
  return { status: 'ok', channel: preferred(candidates), verifiedBy: 'platform-secret' };
}
