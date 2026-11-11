import { Router } from 'express';
import { z } from 'zod';
import { customersService, type CustomerListParams } from '../services/customers.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { csvSanitize } from '../utils/csvSanitize';
import { CUSTOMER_CHANNEL_TYPES } from '../utils/customerKey';

interface OrgParams {
  orgId: string;
  [key: string]: string;
}

const router: Router = Router({ mergeParams: true });

// orgContext rejects users who are not members of :orgId; every query below is
// additionally filtered by that orgId.
router.use(authenticate, orgContext);

const filterShape = {
  search: z.string().trim().max(200).optional(),
  channel: z
    .preprocess(
      (v) => (typeof v === 'string' && v ? v.toUpperCase() : undefined),
      z.enum(CUSTOMER_CHANNEL_TYPES).optional(),
    )
    .optional(),
};

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  ...filterShape,
});

const exportQuerySchema = z.object(filterShape);

// GET /api/v1/organizations/:orgId/customers
// Query: page, limit (<=100), search (name/email/phone), channel, order (last activity, default desc)
router.get('/', validate({ query: listQuerySchema }), async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const result = await customersService.list(orgId, req.query as CustomerListParams);
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/customers/export
// CSV of every customer matching the same search/channel filters as the list.
router.get('/export', validate({ query: exportQuerySchema }), async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const filters = req.query as Pick<CustomerListParams, 'search' | 'channel'>;
    const rows = customersService.iterateForExport(orgId, filters);

    // Fetch the first batch before sending headers so a query failure is still a JSON error.
    let current = await rows.next();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="customers-export.csv"');

    const headers = [
      'name',
      'email',
      'phone',
      'channel',
      'customerId',
      'conversations',
      'firstSeen',
      'lastActive',
      'sentiment',
    ];
    // UTF-8 BOM so spreadsheet apps read Arabic names correctly.
    res.write('﻿' + headers.join(',') + '\n');

    while (!current.done) {
      const c = current.value;
      const cells = [
        c.name,
        c.email,
        c.phone,
        c.channel,
        c.customerId,
        c.conversationCount,
        c.firstSeenAt,
        c.lastActiveAt,
        c.lastEmotion,
      ];
      // csvSanitize neutralises formula injection (= + - @) and quotes special characters.
      res.write(cells.map(csvSanitize).join(',') + '\n');
      current = await rows.next();
    }
    res.end();
  } catch (err) {
    if (res.headersSent) {
      // Mid-stream failure: the status line is gone, abort so the client sees a broken download.
      res.destroy(err instanceof Error ? err : undefined);
      return;
    }
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/customers/:customerKey
// Profile + aggregates + conversations, tags, notes and leads of one customer.
router.get('/:customerKey', async (req, res, next) => {
  try {
    const { orgId, customerKey } = req.params as OrgParams & { customerKey: string };
    const customer = await customersService.getByKey(orgId, customerKey);
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

export default router;
