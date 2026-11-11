import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';
import {
  type CustomerChannelType,
  decodeCustomerKey,
  encodeCustomerKey,
  escapeLikePattern,
  roundRating,
} from '../utils/customerKey';

/**
 * Customers directory.
 *
 * There is no Customer table: customers are derived from conversations and identified by
 * (orgId, channel type, customerId) — see utils/customerKey.ts for the reasoning.
 * All aggregation and pagination happens in SQL; every query is filtered by orgId.
 */

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  channel?: CustomerChannelType;
  order?: 'asc' | 'desc';
}

export interface CustomerSummary {
  id: string;
  customerId: string;
  channel: CustomerChannelType;
  /** Channel types the customer used. One entry today (customers are not merged across types). */
  channels: CustomerChannelType[];
  name: string | null;
  email: string | null;
  phone: string | null;
  conversationCount: number;
  firstSeenAt: string;
  lastActiveAt: string;
  lastEmotion: string | null;
}

interface CustomerAggregateRow {
  channelType: CustomerChannelType;
  customerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  lastEmotion: string | null;
  conversationCount: number;
  firstSeenAt: Date;
  lastActiveAt: Date;
}

/** Conversations returned with a profile (most recent first). */
const PROFILE_CONVERSATIONS_LIMIT = 100;
const PROFILE_NOTES_LIMIT = 100;
const PROFILE_LEADS_LIMIT = 50;

const EXPORT_BATCH_SIZE = 2000;
/** Hard cap on exported customers. */
export const EXPORT_MAX_ROWS = 50000;

function toSummary(row: CustomerAggregateRow): CustomerSummary {
  return {
    id: encodeCustomerKey(row.channelType, row.customerId),
    customerId: row.customerId,
    channel: row.channelType,
    channels: [row.channelType],
    name: row.name,
    email: row.email,
    phone: row.phone,
    conversationCount: row.conversationCount,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastActiveAt: row.lastActiveAt.toISOString(),
    lastEmotion: row.lastEmotion,
  };
}

/** WHERE / HAVING fragments shared by the list, count and export queries (bound params only). */
function buildFilters(orgId: string, params: Pick<CustomerListParams, 'search' | 'channel'>) {
  const channelFilter = params.channel
    ? Prisma.sql`AND ch."type" = ${params.channel}::"ChannelType"`
    : Prisma.empty;

  const term = params.search?.trim();
  let having = Prisma.empty;
  if (term) {
    const pattern = `%${escapeLikePattern(term)}%`;
    // A customer matches when any of their conversations carries a matching name, email,
    // phone or raw identifier (the identifier is the phone number on WhatsApp).
    having = Prisma.sql`HAVING bool_or(
      c."customerName" ILIKE ${pattern}
      OR c."customerEmail" ILIKE ${pattern}
      OR c."customerPhone" ILIKE ${pattern}
      OR c."customerId" ILIKE ${pattern}
    )`;
  }

  const from = Prisma.sql`
    FROM "conversations" c
    JOIN "channels" ch ON ch."id" = c."channelId"
    WHERE c."orgId" = ${orgId} ${channelFilter}
    GROUP BY ch."type", c."customerId"
    ${having}`;

  return from;
}

/** Latest non-empty value of each contact column across a customer's conversations. */
const SELECT_LATEST_VALUES = Prisma.sql`
  (array_agg(c."customerName" ORDER BY c."lastMessageAt" DESC)
    FILTER (WHERE c."customerName" IS NOT NULL AND c."customerName" <> ''))[1] AS "name",
  (array_agg(c."customerEmail" ORDER BY c."lastMessageAt" DESC)
    FILTER (WHERE c."customerEmail" IS NOT NULL AND c."customerEmail" <> ''))[1] AS "email",
  (array_agg(c."customerPhone" ORDER BY c."lastMessageAt" DESC)
    FILTER (WHERE c."customerPhone" IS NOT NULL AND c."customerPhone" <> ''))[1] AS "phone",
  (array_agg(c."lastEmotion" ORDER BY c."lastMessageAt" DESC)
    FILTER (WHERE c."lastEmotion" IS NOT NULL AND c."lastEmotion" <> ''))[1] AS "lastEmotion"`;

const SELECT_KEY_AND_COUNTS = Prisma.sql`
  ch."type" AS "channelType",
  c."customerId" AS "customerId",
  count(*)::int AS "conversationCount",
  min(c."firstMessageAt") AS "firstSeenAt",
  max(c."lastMessageAt") AS "lastActiveAt"`;

/**
 * One page of customers. Two steps inside one statement so it stays cheap on large orgs:
 * `page` groups the org's conversations into customers and applies ORDER BY / LIMIT, then
 * the latest name/email/phone/emotion are looked up only for the customers on that page
 * (index on customerId), instead of sorting every conversation of the org.
 */
async function queryCustomers(
  orgId: string,
  params: Pick<CustomerListParams, 'search' | 'channel' | 'order'>,
  limit: number,
  offset: number,
): Promise<CustomerAggregateRow[]> {
  const direction = params.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return prisma.$queryRaw<CustomerAggregateRow[]>`
    WITH page AS (
      SELECT ${SELECT_KEY_AND_COUNTS}
      ${buildFilters(orgId, params)}
      ORDER BY max(c."lastMessageAt") ${direction}, ch."type" ASC, c."customerId" ASC
      LIMIT ${limit} OFFSET ${offset}
    )
    SELECT page.*, latest.*
    FROM page
    CROSS JOIN LATERAL (
      SELECT ${SELECT_LATEST_VALUES}
      FROM "conversations" c
      JOIN "channels" ch ON ch."id" = c."channelId"
      WHERE c."orgId" = ${orgId}
        AND c."customerId" = page."customerId"
        AND ch."type" = page."channelType"
    ) latest
    ORDER BY page."lastActiveAt" ${direction}, page."channelType" ASC, page."customerId" ASC`;
}

export class CustomersService {
  async list(orgId: string, params: CustomerListParams) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const [rows, countRows] = await Promise.all([
      queryCustomers(orgId, params, limit, (page - 1) * limit),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS "total" FROM (
          SELECT 1 ${buildFilters(orgId, params)}
        ) matched`,
    ]);

    const total = countRows[0]?.total ?? 0;
    return {
      data: rows.map(toSummary),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Yields every matching customer in batches, most recently active first. */
  async *iterateForExport(
    orgId: string,
    params: Pick<CustomerListParams, 'search' | 'channel'>,
  ): AsyncGenerator<CustomerSummary, void, unknown> {
    let offset = 0;
    while (offset < EXPORT_MAX_ROWS) {
      const batchSize = Math.min(EXPORT_BATCH_SIZE, EXPORT_MAX_ROWS - offset);
      const rows = await queryCustomers(orgId, params, batchSize, offset);
      for (const row of rows) yield toSummary(row);
      if (rows.length < batchSize) return;
      offset += rows.length;
    }
  }

  async getByKey(orgId: string, customerKey: string) {
    const identity = decodeCustomerKey(customerKey);
    if (!identity) throw new NotFoundError('Customer not found');

    // Every query below goes through this filter: org from the URL + the customer identity.
    const conversationWhere: Prisma.ConversationWhereInput = {
      orgId,
      customerId: identity.customerId,
      channel: { type: identity.channelType },
    };

    const [summaryRows, statusCounts] = await Promise.all([
      prisma.$queryRaw<CustomerAggregateRow[]>`
        SELECT ${SELECT_KEY_AND_COUNTS}, ${SELECT_LATEST_VALUES}
        FROM "conversations" c
        JOIN "channels" ch ON ch."id" = c."channelId"
        WHERE c."orgId" = ${orgId}
          AND c."customerId" = ${identity.customerId}
          AND ch."type" = ${identity.channelType}::"ChannelType"
        GROUP BY ch."type", c."customerId"`,
      prisma.conversation.groupBy({
        by: ['status'],
        where: conversationWhere,
        _count: { _all: true },
      }),
    ]);

    const summaryRow = summaryRows[0];
    if (!summaryRow) throw new NotFoundError('Customer not found');
    const summary = toSummary(summaryRow);

    const [ratingAgg, conversations, tagCounts, notes, leads] = await Promise.all([
      prisma.conversationRating.aggregate({
        where: { conversation: conversationWhere },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.conversation.findMany({
        where: conversationWhere,
        orderBy: { lastMessageAt: 'desc' },
        take: PROFILE_CONVERSATIONS_LIMIT,
        select: {
          id: true,
          status: true,
          summary: true,
          lastEmotion: true,
          messageCount: true,
          firstMessageAt: true,
          lastMessageAt: true,
          resolvedAt: true,
          channel: { select: { id: true, name: true, type: true } },
          ratings: { select: { rating: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.conversationTag.groupBy({
        by: ['tagId'],
        where: { conversation: conversationWhere, tag: { orgId } },
        _count: { _all: true },
      }),
      prisma.conversationNote.findMany({
        where: { conversation: conversationWhere },
        orderBy: { createdAt: 'desc' },
        take: PROFILE_NOTES_LIMIT,
        select: {
          id: true,
          conversationId: true,
          userId: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.lead.findMany({
        where: { orgId, conversation: conversationWhere },
        orderBy: { createdAt: 'desc' },
        take: PROFILE_LEADS_LIMIT,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          confidence: true,
          conversationId: true,
          createdAt: true,
        },
      }),
    ]);

    const tagIds = tagCounts.map((t) => t.tagId);
    const authorIds = [...new Set(notes.map((n) => n.userId))];
    const [tags, authors] = await Promise.all([
      tagIds.length
        ? prisma.tag.findMany({
            where: { orgId, id: { in: tagIds } },
            select: { id: true, name: true, color: true },
          })
        : [],
      authorIds.length
        ? prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [],
    ]);

    const tagCountById = new Map(tagCounts.map((t) => [t.tagId, t._count._all]));
    const authorById = new Map(
      authors.map((a) => [a.id, { id: a.id, name: `${a.firstName} ${a.lastName}`.trim() }]),
    );

    return {
      ...summary,
      totalConversations: summary.conversationCount,
      conversationsByStatus: Object.fromEntries(
        statusCounts.map((s) => [s.status, s._count._all]),
      ) as Record<string, number>,
      avgRating: roundRating(ratingAgg._avg.rating),
      ratingsCount: ratingAgg._count._all,
      conversations: conversations.map(({ ratings, ...c }) => ({
        ...c,
        rating: ratings[0]?.rating ?? null,
      })),
      tags: tags
        .map((t) => ({ ...t, conversationCount: tagCountById.get(t.id) ?? 0 }))
        .sort((a, b) => b.conversationCount - a.conversationCount || a.name.localeCompare(b.name)),
      notes: notes.map(({ userId, ...n }) => ({ ...n, author: authorById.get(userId) ?? null })),
      leads,
    };
  }
}

export const customersService = new CustomersService();
