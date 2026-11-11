import { DeliveryStatus } from '@prisma/client';

/**
 * Delivery status state machine for outbound messages.
 *
 *   QUEUED -> SENT -> DELIVERED -> READ
 *      \________\-> FAILED
 *
 * Receipts from providers arrive out of order and more than once, so a status may only
 * ever move forward: READ never becomes DELIVERED, a late `sent` never overwrites
 * `delivered`, and a repeated receipt is a no-op. FAILED is terminal and can only be
 * reached before the message was confirmed delivered.
 */
const ALLOWED_PREVIOUS: Record<DeliveryStatus, DeliveryStatus[]> = {
  [DeliveryStatus.QUEUED]: [],
  [DeliveryStatus.SENT]: [DeliveryStatus.QUEUED],
  [DeliveryStatus.DELIVERED]: [DeliveryStatus.QUEUED, DeliveryStatus.SENT],
  [DeliveryStatus.READ]: [DeliveryStatus.QUEUED, DeliveryStatus.SENT, DeliveryStatus.DELIVERED],
  [DeliveryStatus.FAILED]: [DeliveryStatus.QUEUED, DeliveryStatus.SENT],
};

/** Statuses a message may currently be in for it to be moved to `next`. */
export function allowedPreviousStatuses(next: DeliveryStatus): DeliveryStatus[] {
  return ALLOWED_PREVIOUS[next] ?? [];
}

export function canTransition(current: DeliveryStatus, next: DeliveryStatus): boolean {
  return allowedPreviousStatuses(next).includes(current);
}

export interface DeliveryTransitionInput {
  status: DeliveryStatus;
  /** When the provider (or the visitor's widget) says it happened. Defaults to now. */
  at?: Date;
  failureReason?: string | null;
}

export interface DeliveryMessageState {
  deliveryStatus: DeliveryStatus;
  createdAt: Date;
  deliveredAt: Date | null;
}

export interface DeliveryTransitionData {
  deliveryStatus: DeliveryStatus;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
}

export const UNKNOWN_FAILURE_REASON = 'Unknown delivery failure';
const MAX_FAILURE_REASON_LENGTH = 500;

/**
 * Columns to write when moving `message` to `input.status`, or null when the transition
 * is not allowed (backwards, repeated, or out of a terminal state).
 */
export function buildTransition(
  message: DeliveryMessageState,
  input: DeliveryTransitionInput,
  now: Date = new Date(),
): DeliveryTransitionData | null {
  if (!canTransition(message.deliveryStatus, input.status)) return null;

  // Provider timestamps have one-second resolution and may trail our own clock; never
  // record a receipt as happening before the message existed.
  const requested = input.at && !Number.isNaN(input.at.getTime()) ? input.at : now;
  const at = requested < message.createdAt ? message.createdAt : requested;

  switch (input.status) {
    case DeliveryStatus.DELIVERED:
      return { deliveryStatus: input.status, deliveredAt: at };
    case DeliveryStatus.READ:
      // A read receipt implies delivery even if the `delivered` receipt was lost or is late.
      return {
        deliveryStatus: input.status,
        readAt: at,
        deliveredAt: message.deliveredAt ?? at,
      };
    case DeliveryStatus.FAILED:
      return {
        deliveryStatus: input.status,
        failureReason: (input.failureReason?.trim() || UNKNOWN_FAILURE_REASON).slice(
          0,
          MAX_FAILURE_REASON_LENGTH,
        ),
      };
    default:
      return { deliveryStatus: input.status };
  }
}
