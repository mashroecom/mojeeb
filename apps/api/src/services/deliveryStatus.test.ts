import { describe, it, expect } from 'vitest';
import { DeliveryStatus } from '@prisma/client';
import { buildTransition, canTransition, UNKNOWN_FAILURE_REASON } from './deliveryStatus';

const { QUEUED, SENT, DELIVERED, READ, FAILED } = DeliveryStatus;
const ALL = [QUEUED, SENT, DELIVERED, READ, FAILED];

const createdAt = new Date('2026-01-01T10:00:00.000Z');
const later = new Date('2026-01-01T10:00:05.000Z');

function message(deliveryStatus: DeliveryStatus, deliveredAt: Date | null = null) {
  return { deliveryStatus, createdAt, deliveredAt };
}

describe('canTransition', () => {
  it('allows every forward step', () => {
    expect(canTransition(QUEUED, SENT)).toBe(true);
    expect(canTransition(QUEUED, DELIVERED)).toBe(true);
    expect(canTransition(SENT, DELIVERED)).toBe(true);
    expect(canTransition(SENT, READ)).toBe(true);
    expect(canTransition(DELIVERED, READ)).toBe(true);
  });

  it('never moves backwards', () => {
    expect(canTransition(READ, DELIVERED)).toBe(false);
    expect(canTransition(READ, SENT)).toBe(false);
    expect(canTransition(DELIVERED, SENT)).toBe(false);
    expect(canTransition(SENT, QUEUED)).toBe(false);
  });

  it('treats a repeated status as a no-op', () => {
    for (const status of ALL) expect(canTransition(status, status)).toBe(false);
  });

  it('only fails messages that were not confirmed delivered', () => {
    expect(canTransition(QUEUED, FAILED)).toBe(true);
    expect(canTransition(SENT, FAILED)).toBe(true);
    expect(canTransition(DELIVERED, FAILED)).toBe(false);
    expect(canTransition(READ, FAILED)).toBe(false);
  });

  it('keeps FAILED terminal', () => {
    for (const status of ALL) expect(canTransition(FAILED, status)).toBe(false);
  });

  it('never returns to QUEUED', () => {
    for (const status of ALL) expect(canTransition(status, QUEUED)).toBe(false);
  });
});

describe('buildTransition', () => {
  it('stamps deliveredAt on DELIVERED', () => {
    expect(buildTransition(message(SENT), { status: DELIVERED, at: later })).toEqual({
      deliveryStatus: DELIVERED,
      deliveredAt: later,
    });
  });

  it('stamps readAt and backfills deliveredAt when the delivered receipt was skipped', () => {
    expect(buildTransition(message(SENT), { status: READ, at: later })).toEqual({
      deliveryStatus: READ,
      readAt: later,
      deliveredAt: later,
    });
  });

  it('keeps the original deliveredAt on READ', () => {
    const deliveredAt = new Date('2026-01-01T10:00:02.000Z');
    expect(buildTransition(message(DELIVERED, deliveredAt), { status: READ, at: later })).toEqual({
      deliveryStatus: READ,
      readAt: later,
      deliveredAt,
    });
  });

  it('returns null for backward, repeated and post-failure updates', () => {
    expect(buildTransition(message(READ), { status: DELIVERED, at: later })).toBeNull();
    expect(buildTransition(message(DELIVERED), { status: SENT, at: later })).toBeNull();
    expect(buildTransition(message(DELIVERED), { status: DELIVERED, at: later })).toBeNull();
    expect(buildTransition(message(DELIVERED), { status: FAILED })).toBeNull();
    expect(buildTransition(message(FAILED), { status: DELIVERED, at: later })).toBeNull();
  });

  it('stores the failure reason, with a fallback and a length cap', () => {
    expect(
      buildTransition(message(SENT), { status: FAILED, failureReason: ' Message undeliverable ' }),
    ).toEqual({ deliveryStatus: FAILED, failureReason: 'Message undeliverable' });
    expect(buildTransition(message(SENT), { status: FAILED })?.failureReason).toBe(
      UNKNOWN_FAILURE_REASON,
    );
    expect(
      buildTransition(message(SENT), { status: FAILED, failureReason: 'x'.repeat(2000) })
        ?.failureReason,
    ).toHaveLength(500);
  });

  it('never records a receipt before the message was created', () => {
    const before = new Date('2026-01-01T09:59:59.000Z');
    expect(buildTransition(message(SENT), { status: DELIVERED, at: before })?.deliveredAt).toEqual(
      createdAt,
    );
  });

  it('falls back to now for a missing or invalid timestamp', () => {
    const now = new Date('2026-01-01T11:00:00.000Z');
    expect(buildTransition(message(SENT), { status: DELIVERED }, now)?.deliveredAt).toEqual(now);
    expect(
      buildTransition(message(SENT), { status: DELIVERED, at: new Date('nope') }, now)?.deliveredAt,
    ).toEqual(now);
  });
});
