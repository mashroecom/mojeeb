import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import {
  groupWhatsAppChangesByPhoneNumber,
  matchesVerifyToken,
  resolveWhatsAppChannel,
  verifyMetaSignature,
} from './whatsapp.routing';

const sign = (body: Buffer, secret: string) =>
  'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

describe('verifyMetaSignature', () => {
  const body = Buffer.from('{"entry":[]}');

  it('accepts the signature made with the secret', () => {
    expect(verifyMetaSignature(body, sign(body, 's3cret'), 's3cret')).toBe(true);
  });

  it('rejects another secret, a tampered body and malformed headers', () => {
    expect(verifyMetaSignature(body, sign(body, 'other'), 's3cret')).toBe(false);
    expect(verifyMetaSignature(Buffer.from('{"entry":[1]}'), sign(body, 's3cret'), 's3cret')).toBe(
      false,
    );
    expect(verifyMetaSignature(body, 'sha256=abc', 's3cret')).toBe(false);
    expect(verifyMetaSignature(body, undefined, 's3cret')).toBe(false);
    expect(verifyMetaSignature(body, ['a', 'b'], 's3cret')).toBe(false);
  });

  it('never accepts anything when the secret is empty', () => {
    expect(verifyMetaSignature(body, sign(body, ''), '')).toBe(false);
  });
});

describe('matchesVerifyToken', () => {
  it('matches any configured token', () => {
    expect(matchesVerifyToken('tok-b', ['tok-a', 'tok-b'])).toBe(true);
  });

  it('rejects unknown, empty and non-string tokens', () => {
    expect(matchesVerifyToken('nope', ['tok-a'])).toBe(false);
    expect(matchesVerifyToken('', ['', undefined])).toBe(false);
    expect(matchesVerifyToken(undefined, [''])).toBe(false);
    expect(matchesVerifyToken(['tok-a'], ['tok-a'])).toBe(false);
    expect(matchesVerifyToken('tok-a', [])).toBe(false);
  });
});

describe('groupWhatsAppChangesByPhoneNumber', () => {
  const change = (phone: string | undefined, extra: Record<string, unknown>) => ({
    field: 'messages',
    value: { ...(phone ? { metadata: { phone_number_id: phone } } : {}), ...extra },
  });

  it('splits one payload into a payload per phone number', () => {
    const groups = groupWhatsAppChangesByPhoneNumber({
      object: 'whatsapp_business_account',
      entry: [
        { id: 'W1', changes: [change('A', { messages: [{ id: 'm1' }] })] },
        {
          id: 'W2',
          changes: [change('B', { messages: [{ id: 'm2' }] }), change('A', { statuses: [] })],
        },
      ],
    });

    expect(groups.map((g) => g.phoneNumberId)).toEqual(['A', 'B']);
    expect(groups[0]!.payload.entry).toHaveLength(2);
    expect(groups[1]!.payload.entry).toEqual([
      { id: 'W2', changes: [change('B', { messages: [{ id: 'm2' }] })] },
    ]);
  });

  it('keeps changes without a phone number in a null group and skips other fields', () => {
    const groups = groupWhatsAppChangesByPhoneNumber({
      entry: [
        {
          changes: [
            change(undefined, { messages: [{ id: 'm1' }] }),
            { field: 'account_update', value: { metadata: { phone_number_id: 'A' } } },
          ],
        },
      ],
    });
    expect(groups.map((g) => g.phoneNumberId)).toEqual([null]);
  });

  it('tolerates malformed payloads', () => {
    for (const bad of [null, undefined, 'x', {}, { entry: 'no' }, { entry: [null, {}] }]) {
      expect(groupWhatsAppChangesByPhoneNumber(bad)).toEqual([]);
    }
  });
});

describe('resolveWhatsAppChannel', () => {
  const channel = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    appSecret: null as string | null,
    ...overrides,
  });
  const signedWith = (secret: string) => (candidate: string) => candidate === secret;
  const never = () => false;

  it('routes a platform-signed event to the channel registered for the number', () => {
    const result = resolveWhatsAppChannel([channel('a')], true, never);
    expect(result).toMatchObject({ status: 'ok', verifiedBy: 'platform-secret' });
    expect(result.status === 'ok' && result.channel.id).toBe('a');
  });

  it('drops a verified event for a number no channel is registered for', () => {
    expect(resolveWhatsAppChannel([], true, never)).toEqual({ status: 'unknown_number' });
  });

  it('rejects an event that neither secret verifies', () => {
    expect(resolveWhatsAppChannel([channel('a', { appSecret: 'sa' })], false, never)).toEqual({
      status: 'bad_signature',
    });
    expect(resolveWhatsAppChannel([], false, never)).toEqual({ status: 'bad_signature' });
  });

  it("accepts an event signed with the channel's own app secret", () => {
    const result = resolveWhatsAppChannel(
      [channel('a', { appSecret: 'sa' })],
      false,
      signedWith('sa'),
    );
    expect(result).toMatchObject({ status: 'ok', verifiedBy: 'channel-secret' });
  });

  it("does not let one organization's secret verify another organization's number", () => {
    // Body signed with org B's secret, but the event is for org A's number
    const result = resolveWhatsAppChannel(
      [channel('a', { appSecret: 'sa' })],
      false,
      signedWith('sb'),
    );
    expect(result).toEqual({ status: 'bad_signature' });
  });

  it('prefers the channel whose own secret verifies when several claim the number', () => {
    const result = resolveWhatsAppChannel(
      [
        channel('squatter', { createdAt: new Date('2025-01-01T00:00:00Z'), appSecret: 'other' }),
        channel('owner', { appSecret: 'sa' }),
      ],
      true,
      signedWith('sa'),
    );
    expect(result.status === 'ok' && result.channel.id).toBe('owner');
  });

  it('with only the platform secret, prefers active then oldest', () => {
    const result = resolveWhatsAppChannel(
      [
        channel('inactive-oldest', { isActive: false, createdAt: new Date('2024-01-01') }),
        channel('newer', { createdAt: new Date('2026-06-01') }),
        channel('older', { createdAt: new Date('2025-06-01') }),
      ],
      true,
      never,
    );
    expect(result.status === 'ok' && result.channel.id).toBe('older');
  });

  it('ignores empty channel secrets', () => {
    expect(resolveWhatsAppChannel([channel('a', { appSecret: '' })], false, () => true)).toEqual({
      status: 'bad_signature',
    });
  });
});
