import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row {
  id: string;
  conversationId: string;
  orgId: string;
  channelId: string;
  channelType: string;
  channelExternalId: string | null;
  role: string;
  externalId: string | null;
  deliveryStatus: string;
  createdAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  failureReason: string | null;
}

// Minimal in-memory stand-in for the two Prisma calls the service makes. It understands
// exactly the where-shapes the service builds, so tenant scoping is really exercised.
const { rows, emitToOrg, prismaMock } = vi.hoisted(() => {
  const rows: Row[] = [];

  function matches(row: Row, where: any): boolean {
    if (!where) return true;
    if (where.AND) return (where.AND as any[]).every((clause) => matches(row, clause));
    if (where.id !== undefined) {
      if (typeof where.id === 'string' ? row.id !== where.id : !where.id.in.includes(row.id))
        return false;
    }
    if (where.externalId !== undefined && row.externalId !== where.externalId) return false;
    if (where.conversationId !== undefined && row.conversationId !== where.conversationId)
      return false;
    if (where.role && !where.role.in.includes(row.role)) return false;
    if (where.deliveryStatus && !where.deliveryStatus.in.includes(row.deliveryStatus)) return false;
    if (where.conversation?.channelId && row.channelId !== where.conversation.channelId)
      return false;
    const channel = where.conversation?.channel;
    if (channel) {
      if (row.channelType !== channel.type || row.channelExternalId !== channel.externalId)
        return false;
    }
    return true;
  }

  const prismaMock = {
    message: {
      findMany: vi.fn(async ({ where }: any) =>
        rows
          .filter((row) => matches(row, where))
          .map((row) => ({
            ...row,
            conversation: { orgId: row.orgId },
          })),
      ),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const hit = rows.filter((row) => matches(row, where));
        hit.forEach((row) => Object.assign(row, data));
        return { count: hit.length };
      }),
    },
  };

  return { rows, emitToOrg: vi.fn(), prismaMock };
});

vi.mock('../config/database', () => ({ prisma: prismaMock }));
vi.mock('../config/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../websocket/index', () => ({ emitToOrg }));

import { messageDeliveryService } from './messageDelivery.service';

const createdAt = new Date('2026-01-01T10:00:00.000Z');
const t = (seconds: number) => new Date(createdAt.getTime() + seconds * 1000);

function seed(overrides: Partial<Row> = {}): Row {
  const row: Row = {
    id: `msg_${rows.length + 1}`,
    conversationId: 'conv_1',
    orgId: 'org_1',
    channelId: 'ch_1',
    channelType: 'WHATSAPP',
    channelExternalId: 'PHONE_1',
    role: 'AI_AGENT',
    externalId: 'wamid.1',
    deliveryStatus: 'SENT',
    createdAt,
    deliveredAt: null,
    readAt: null,
    failureReason: null,
    ...overrides,
  };
  rows.push(row);
  return row;
}

function receipt(status: string, seconds: number, overrides: Record<string, unknown> = {}) {
  return {
    externalMessageId: 'wamid.1',
    phoneNumberId: 'PHONE_1',
    status,
    timestamp: t(seconds),
    ...overrides,
  } as any;
}

beforeEach(() => {
  rows.length = 0;
  vi.clearAllMocks();
});

describe('applyWhatsAppStatuses', () => {
  it('advances SENT -> DELIVERED -> READ and notifies the dashboard each time', async () => {
    const row = seed();

    await messageDeliveryService.applyWhatsAppStatuses([receipt('DELIVERED', 3)]);
    expect(row).toMatchObject({ deliveryStatus: 'DELIVERED', deliveredAt: t(3), readAt: null });

    await messageDeliveryService.applyWhatsAppStatuses([receipt('READ', 9)]);
    expect(row).toMatchObject({ deliveryStatus: 'READ', deliveredAt: t(3), readAt: t(9) });

    expect(emitToOrg).toHaveBeenCalledTimes(2);
    expect(emitToOrg).toHaveBeenLastCalledWith('org_1', 'message:status', {
      messageId: row.id,
      conversationId: 'conv_1',
      deliveryStatus: 'READ',
      deliveredAt: t(3),
      readAt: t(9),
      failureReason: null,
    });
  });

  it('ignores receipts that arrive out of order', async () => {
    const row = seed();

    await messageDeliveryService.applyWhatsAppStatuses([receipt('READ', 9)]);
    const applied = await messageDeliveryService.applyWhatsAppStatuses([
      receipt('DELIVERED', 3),
      receipt('SENT', 1),
    ]);

    expect(applied).toEqual([]);
    expect(row).toMatchObject({ deliveryStatus: 'READ', deliveredAt: t(9), readAt: t(9) });
    expect(emitToOrg).toHaveBeenCalledTimes(1);
  });

  it('is idempotent for repeated receipts', async () => {
    const row = seed();

    const first = await messageDeliveryService.applyWhatsAppStatuses([receipt('DELIVERED', 3)]);
    const second = await messageDeliveryService.applyWhatsAppStatuses([receipt('DELIVERED', 60)]);

    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
    expect(row.deliveredAt).toEqual(t(3));
    expect(emitToOrg).toHaveBeenCalledTimes(1);
  });

  it('tolerates receipts for unknown message ids', async () => {
    const row = seed();

    const applied = await messageDeliveryService.applyWhatsAppStatuses([
      receipt('READ', 5, { externalMessageId: 'wamid.unknown' }),
    ]);

    expect(applied).toEqual([]);
    expect(row.deliveryStatus).toBe('SENT');
    expect(prismaMock.message.updateMany).not.toHaveBeenCalled();
    expect(emitToOrg).not.toHaveBeenCalled();
  });

  it("never applies a receipt to another channel's message with the same provider id", async () => {
    const other = seed({ orgId: 'org_2', conversationId: 'conv_2', channelExternalId: 'PHONE_2' });

    const applied = await messageDeliveryService.applyWhatsAppStatuses([receipt('READ', 5)]);

    expect(applied).toEqual([]);
    expect(other).toMatchObject({ deliveryStatus: 'SENT', readAt: null });
  });

  it('with a channel id, ignores another channel that claims the same phone number', async () => {
    const mine = seed({ externalId: 'wamid.mine' });
    const squatter = seed({ channelId: 'ch_2', orgId: 'org_2', conversationId: 'conv_2' });

    await messageDeliveryService.applyWhatsAppStatuses(
      [receipt('READ', 5), receipt('READ', 5, { externalMessageId: 'wamid.mine' })],
      'ch_1',
    );

    expect(mine.deliveryStatus).toBe('READ');
    expect(squatter.deliveryStatus).toBe('SENT');
  });

  it('only matches WhatsApp channels and outbound messages', async () => {
    const webchat = seed({ channelType: 'WEBCHAT' });
    const inbound = seed({ role: 'CUSTOMER' });

    await messageDeliveryService.applyWhatsAppStatuses([receipt('READ', 5)]);

    expect(webchat.deliveryStatus).toBe('SENT');
    expect(inbound.deliveryStatus).toBe('SENT');
  });

  it('stores the failure reason and keeps FAILED terminal', async () => {
    const row = seed();

    await messageDeliveryService.applyWhatsAppStatuses([
      receipt('FAILED', 2, { failureReason: 'Message undeliverable (131026)' }),
    ]);
    await messageDeliveryService.applyWhatsAppStatuses([receipt('DELIVERED', 4)]);

    expect(row).toMatchObject({
      deliveryStatus: 'FAILED',
      failureReason: 'Message undeliverable (131026)',
      deliveredAt: null,
    });
  });

  it('does not fail a message that was already delivered', async () => {
    const row = seed({ deliveryStatus: 'DELIVERED', deliveredAt: t(3) });

    await messageDeliveryService.applyWhatsAppStatuses([
      receipt('FAILED', 5, { failureReason: 'late failure' }),
    ]);

    expect(row).toMatchObject({ deliveryStatus: 'DELIVERED', failureReason: null });
  });

  it('keeps processing the batch when one receipt throws', async () => {
    const row = seed();
    prismaMock.message.findMany.mockRejectedValueOnce(new Error('db down'));

    const applied = await messageDeliveryService.applyWhatsAppStatuses([
      receipt('DELIVERED', 3, { externalMessageId: 'wamid.boom' }),
      receipt('DELIVERED', 3),
    ]);

    expect(applied).toHaveLength(1);
    expect(row.deliveryStatus).toBe('DELIVERED');
  });
});

describe('applyUpdate', () => {
  it('skips the row when a newer receipt wins the race', async () => {
    const row = seed();
    // Another worker marks the message READ between our read and our compare-and-set
    prismaMock.message.findMany.mockImplementationOnce(async () => {
      const snapshot = [{ ...row, conversation: { orgId: row.orgId } }];
      Object.assign(row, { deliveryStatus: 'READ', deliveredAt: t(1), readAt: t(2) });
      return snapshot;
    });

    const result = await messageDeliveryService.applyUpdate(
      { id: row.id },
      { status: 'DELIVERED' as any, at: t(5) },
    );

    expect(result).toEqual({ matched: 1, applied: [] });
    expect(row).toMatchObject({ deliveryStatus: 'READ', deliveredAt: t(1), readAt: t(2) });
    expect(emitToOrg).not.toHaveBeenCalled();
  });

  it('applies a webchat receipt only to the listed messages of that conversation', async () => {
    const mine = seed({ channelType: 'WEBCHAT', externalId: null });
    const sibling = seed({ channelType: 'WEBCHAT', externalId: null });
    const foreign = seed({ channelType: 'WEBCHAT', externalId: null, conversationId: 'conv_2' });

    const result = await messageDeliveryService.applyUpdate(
      { id: { in: [mine.id, foreign.id] }, conversationId: 'conv_1' },
      { status: 'READ' as any, at: t(4) },
    );

    expect(result.applied.map((u) => u.messageId)).toEqual([mine.id]);
    expect(mine).toMatchObject({ deliveryStatus: 'READ', deliveredAt: t(4), readAt: t(4) });
    expect(sibling.deliveryStatus).toBe('SENT');
    expect(foreign.deliveryStatus).toBe('SENT');
  });
});

describe('recordSendResult', () => {
  it('stores the provider id and marks a queued message SENT', async () => {
    const row = seed({ deliveryStatus: 'QUEUED', externalId: null });

    await messageDeliveryService.recordSendResult(row.id, {
      success: true,
      externalId: 'wamid.new',
    });

    expect(row).toMatchObject({ deliveryStatus: 'SENT', externalId: 'wamid.new' });
  });

  it('does not reset a message whose receipt arrived before the send result', async () => {
    const row = seed({ deliveryStatus: 'DELIVERED', deliveredAt: t(1), externalId: null });

    await messageDeliveryService.recordSendResult(row.id, { success: true, externalId: 'ext_1' });

    expect(row).toMatchObject({ deliveryStatus: 'DELIVERED', externalId: 'ext_1' });
  });

  it('marks a rejected send FAILED with the provider error', async () => {
    const row = seed({ externalId: null });

    await messageDeliveryService.recordSendResult(row.id, {
      success: false,
      externalId: '',
      error: 'Missing WhatsApp credentials',
    });

    expect(row).toMatchObject({
      deliveryStatus: 'FAILED',
      failureReason: 'Missing WhatsApp credentials',
      externalId: null,
    });
  });
});
