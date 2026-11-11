import { describe, it, expect } from 'vitest';
import { formatWhatsAppFailureReason, parseWhatsAppStatuses } from './whatsapp.statuses';

function payload(value: Record<string, unknown>, field = 'messages') {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA_ID', changes: [{ field, value }] }],
  };
}

const metadata = { display_phone_number: '15550001111', phone_number_id: 'PHONE_1' };

describe('parseWhatsAppStatuses', () => {
  it('parses sent / delivered / read receipts with their phone number id', () => {
    const result = parseWhatsAppStatuses(
      payload({
        messaging_product: 'whatsapp',
        metadata,
        statuses: [
          { id: 'wamid.A', status: 'sent', timestamp: '1767261600', recipient_id: '201000000001' },
          { id: 'wamid.A', status: 'delivered', timestamp: '1767261605', recipient_id: '2010' },
          { id: 'wamid.B', status: 'read', timestamp: 1767261610 },
        ],
      }),
    );

    expect(result).toEqual([
      {
        externalMessageId: 'wamid.A',
        phoneNumberId: 'PHONE_1',
        status: 'SENT',
        timestamp: new Date(1767261600 * 1000),
        recipientId: '201000000001',
        failureReason: undefined,
      },
      {
        externalMessageId: 'wamid.A',
        phoneNumberId: 'PHONE_1',
        status: 'DELIVERED',
        timestamp: new Date(1767261605 * 1000),
        recipientId: '2010',
        failureReason: undefined,
      },
      {
        externalMessageId: 'wamid.B',
        phoneNumberId: 'PHONE_1',
        status: 'READ',
        timestamp: new Date(1767261610 * 1000),
        recipientId: undefined,
        failureReason: undefined,
      },
    ]);
  });

  it('extracts the failure reason from errors[]', () => {
    const [update] = parseWhatsAppStatuses(
      payload({
        metadata,
        statuses: [
          {
            id: 'wamid.F',
            status: 'failed',
            timestamp: '1767261600',
            errors: [
              {
                code: 131026,
                title: 'Message undeliverable',
                message: 'Message undeliverable',
                error_data: { details: 'Recipient is not a valid WhatsApp user' },
              },
            ],
          },
        ],
      }),
    );

    expect(update?.status).toBe('FAILED');
    expect(update?.failureReason).toBe('Message undeliverable (131026)');
  });

  it('collects receipts across entries and changes', () => {
    const result = parseWhatsAppStatuses({
      entry: [
        {
          changes: [
            { field: 'messages', value: { metadata, statuses: [{ id: 'a', status: 'sent' }] } },
          ],
        },
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'PHONE_2' },
                statuses: [{ id: 'b', status: 'read' }],
              },
            },
          ],
        },
      ],
    });

    expect(result.map((u) => [u.externalMessageId, u.phoneNumberId, u.status])).toEqual([
      ['a', 'PHONE_1', 'SENT'],
      ['b', 'PHONE_2', 'READ'],
    ]);
  });

  it('returns nothing for a payload that only carries inbound messages', () => {
    expect(
      parseWhatsAppStatuses(
        payload({ metadata, messages: [{ id: 'wamid.IN', from: '2010', type: 'text' }] }),
      ),
    ).toEqual([]);
  });

  it('skips unknown statuses, entries without an id and other webhook fields', () => {
    expect(
      parseWhatsAppStatuses(
        payload({
          metadata,
          statuses: [
            { id: 'wamid.X', status: 'deleted' },
            { status: 'delivered' },
            { id: '', status: 'delivered' },
            null,
            'garbage',
          ],
        }),
      ),
    ).toEqual([]);
    expect(
      parseWhatsAppStatuses(
        payload({ metadata, statuses: [{ id: 'wamid.X', status: 'read' }] }, 'account_update'),
      ),
    ).toEqual([]);
  });

  it('skips receipts that cannot be scoped to a phone number', () => {
    expect(
      parseWhatsAppStatuses(payload({ statuses: [{ id: 'wamid.X', status: 'read' }] })),
    ).toEqual([]);
  });

  it('falls back to the current time for a missing or invalid timestamp', () => {
    const before = Date.now();
    const [update] = parseWhatsAppStatuses(
      payload({ metadata, statuses: [{ id: 'wamid.X', status: 'delivered', timestamp: 'abc' }] }),
    );
    expect(update!.timestamp.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('tolerates malformed payloads', () => {
    for (const bad of [null, undefined, 'x', 42, {}, { entry: 'nope' }, { entry: [null, {}] }]) {
      expect(parseWhatsAppStatuses(bad)).toEqual([]);
    }
    expect(parseWhatsAppStatuses(payload({ metadata, statuses: 'nope' }))).toEqual([]);
  });
});

describe('formatWhatsAppFailureReason', () => {
  it('formats title and code', () => {
    expect(formatWhatsAppFailureReason([{ code: 131047, title: 'Re-engagement message' }])).toBe(
      'Re-engagement message (131047)',
    );
  });

  it('falls back through message, details and bare code', () => {
    expect(formatWhatsAppFailureReason([{ message: 'Rate limit hit' }])).toBe('Rate limit hit');
    expect(formatWhatsAppFailureReason([{ error_data: { details: 'Blocked' } }])).toBe('Blocked');
    expect(formatWhatsAppFailureReason([{ code: 500 }])).toBe('WhatsApp error 500');
  });

  it('returns undefined when there is no usable error', () => {
    expect(formatWhatsAppFailureReason(undefined)).toBeUndefined();
    expect(formatWhatsAppFailureReason([])).toBeUndefined();
    expect(formatWhatsAppFailureReason([{}])).toBeUndefined();
    expect(formatWhatsAppFailureReason('boom')).toBeUndefined();
  });
});
