/**
 * Pure authorisation helpers for the public web chat endpoints.
 *
 * A visitor is identified by the id their widget generated. It is the only credential a
 * visitor has, so every endpoint that reads or changes a conversation must be scoped to
 * the channel in the URL *and* that visitor id — a conversation id alone is not enough.
 */
const MAX_VISITOR_ID_LENGTH = 200;

export function isValidVisitorId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_VISITOR_ID_LENGTH;
}

/** Visitor id from a query string value (`?visitorId=`); arrays and objects are rejected. */
export function visitorIdFromQuery(value: unknown): string | null {
  return isValidVisitorId(value) ? value : null;
}

/**
 * Prisma filter that matches a conversation only if it is on this channel and belongs to
 * this visitor. Returns null when any part is missing, so callers cannot accidentally run
 * an unscoped query.
 */
export function visitorConversationWhere(
  channelId: unknown,
  conversationId: unknown,
  visitorId: unknown,
): { id: string; channelId: string; customerId: string } | null {
  if (typeof channelId !== 'string' || !channelId) return null;
  if (typeof conversationId !== 'string' || !conversationId) return null;
  if (!isValidVisitorId(visitorId)) return null;
  return { id: conversationId, channelId, customerId: visitorId };
}
