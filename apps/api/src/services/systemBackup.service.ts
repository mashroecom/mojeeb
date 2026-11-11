import { createHash } from 'crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { cache } from '../config/cache';
import { logger } from '../config/logger';
import { configService } from './config.service';
import { planConfigService } from './planConfig.service';
import { clearMaintenanceCache } from '../middleware/maintenance';
import { BadRequestError } from '../utils/errors';

/**
 * System configuration backup: export / import of admin-managed configuration.
 *
 * Scope is configuration only (system configs, plans, feature flags, site settings, email
 * templates, landing page, FAQ, testimonials, legal content) - never user or customer data.
 *
 * Secrets: SystemConfig rows flagged `isSecret` are stored in plaintext in the database, so
 * their values are NEVER written to an export (value: null) and never touched by an import.
 */

export const BACKUP_FORMAT = 'mojeeb.system-config';
export const BACKUP_VERSION = 1;

const MAX_ROWS_PER_SECTION = 5000;
const MAX_STRING_LENGTH = 500_000;
const SINGLETON_ID = 'singleton';
const INT4_MIN = -2147483648;
const INT4_MAX = 2147483647;

// ─── Section definitions ──────────────────────────────────────────

type SectionKind = 'list' | 'singleton';

interface SectionDef {
  model: Prisma.ModelName;
  /** Prisma client delegate name */
  delegate:
    | 'planConfig'
    | 'featureFlag'
    | 'siteSettings'
    | 'emailTemplate'
    | 'landingPageContent'
    | 'fAQ'
    | 'legalContent'
    | 'testimonial';
  kind: SectionKind;
  /** Unique field used to match rows on import (list sections only) */
  matchBy?: string;
  /** Fields that are instance-specific or server-managed and never exported/imported */
  omit: string[];
}

const SERVER_MANAGED = ['createdAt', 'updatedAt'];

// SystemConfig is handled separately because of the secret-masking rules.
const SECTIONS = {
  planConfigs: {
    model: 'PlanConfig',
    delegate: 'planConfig',
    kind: 'list',
    matchBy: 'plan',
    omit: ['id', ...SERVER_MANAGED],
  },
  featureFlags: {
    model: 'FeatureFlag',
    delegate: 'featureFlag',
    kind: 'list',
    matchBy: 'key',
    omit: ['id', ...SERVER_MANAGED],
  },
  siteSettings: {
    model: 'SiteSettings',
    delegate: 'siteSettings',
    kind: 'singleton',
    omit: ['id', ...SERVER_MANAGED],
  },
  emailTemplates: {
    model: 'EmailTemplate',
    delegate: 'emailTemplate',
    kind: 'list',
    matchBy: 'key',
    // updatedBy is a user id of the source instance
    omit: ['id', 'updatedBy', ...SERVER_MANAGED],
  },
  landingPageContent: {
    model: 'LandingPageContent',
    delegate: 'landingPageContent',
    kind: 'singleton',
    omit: ['id', ...SERVER_MANAGED],
  },
  faqs: {
    model: 'FAQ',
    delegate: 'fAQ',
    kind: 'list',
    matchBy: 'id',
    omit: SERVER_MANAGED,
  },
  testimonials: {
    model: 'Testimonial',
    delegate: 'testimonial',
    kind: 'list',
    matchBy: 'id',
    omit: SERVER_MANAGED,
  },
  legalContents: {
    model: 'LegalContent',
    delegate: 'legalContent',
    kind: 'list',
    matchBy: 'id',
    omit: SERVER_MANAGED,
  },
} as const satisfies Record<string, SectionDef>;

type SectionName = keyof typeof SECTIONS;
const SECTION_NAMES = Object.keys(SECTIONS) as SectionName[];

// ─── Schema generation from the Prisma datamodel ──────────────────

type ModelField = (typeof Prisma.dmmf.datamodel.models)[number]['fields'][number];

function modelFields(def: SectionDef): ModelField[] {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === def.model);
  if (!model) throw new Error(`System backup: unknown Prisma model ${def.model}`);
  const omitted = new Set(def.omit);
  return model.fields.filter(
    (field) => !omitted.has(field.name) && (field.kind === 'scalar' || field.kind === 'enum'),
  );
}

const idLike = z
  .string()
  .min(1)
  .max(191)
  .regex(/^[A-Za-z0-9_.:-]+$/, 'Invalid identifier');

/** Free text column. PostgreSQL text cannot store NUL, so reject it up front. */
function text(maxLength: number) {
  return z
    .string()
    .max(maxLength)
    .refine((value) => !value.includes('\u0000'), 'Must not contain NUL characters');
}

function scalarSchema(field: ModelField): z.ZodTypeAny | null {
  if (field.kind === 'enum') {
    const values = Prisma.dmmf.datamodel.enums
      .find((e) => e.name === field.type)
      ?.values.map((v) => v.name);
    return values && values.length > 0 ? z.enum(values as [string, ...string[]]) : null;
  }
  switch (field.type) {
    case 'String':
      return field.isId || field.isUnique ? idLike : text(MAX_STRING_LENGTH);
    case 'Int':
      return z.number().int().min(INT4_MIN).max(INT4_MAX);
    case 'Float':
      return z.number().finite();
    case 'Boolean':
      return z.boolean();
    case 'Json':
      // Any JSON value; JSON null is only valid for optional columns (handled below)
      return z.unknown().refine((value) => value !== undefined && value !== null, 'Required');
    default:
      // DateTime / Decimal / BigInt / Bytes columns are not part of any exported section
      return null;
  }
}

interface SectionSchema {
  def: SectionDef;
  fields: ModelField[];
  row: z.ZodTypeAny;
}

function buildSectionSchema(def: SectionDef): SectionSchema {
  const shape: Record<string, z.ZodTypeAny> = {};
  const fields: ModelField[] = [];

  for (const field of modelFields(def)) {
    let schema = scalarSchema(field);
    if (!schema) {
      logger.warn(
        { model: def.model, field: field.name, type: field.type },
        'System backup: unsupported column type, skipping field',
      );
      continue;
    }
    if (field.isList) schema = z.array(schema).max(1000);
    if (!field.isRequired) schema = schema.nullable();
    // Columns with a database default may be absent (e.g. backups taken before a column existed)
    if (!field.isRequired || field.hasDefaultValue) schema = schema.optional();
    shape[field.name] = schema;
    fields.push(field);
  }

  return { def, fields, row: z.object(shape).strict() };
}

const sectionSchemas = Object.fromEntries(
  SECTION_NAMES.map((name) => [name, buildSectionSchema(SECTIONS[name])]),
) as Record<SectionName, SectionSchema>;

const systemConfigRowSchema = z
  .object({
    key: idLike,
    category: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_]+$/, 'Invalid category'),
    label: text(500),
    description: text(2000),
    isSecret: z.boolean(),
    // Secrets are exported without their value
    value: text(MAX_STRING_LENGTH).nullable(),
    hasValue: z.boolean().optional(),
  })
  .strict()
  .refine((row) => row.isSecret || row.value !== null, {
    message: 'Non-secret config entries must include a value',
    path: ['value'],
  })
  .refine((row) => !row.isSecret || row.value === null, {
    message: 'Secret config entries must not carry a value',
    path: ['value'],
  });

function uniqueBy(field: string) {
  return (rows: unknown[], ctx: z.RefinementCtx) => {
    const seen = new Set<unknown>();
    rows.forEach((row, index) => {
      const value = (row as Record<string, unknown>)[field];
      if (seen.has(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate ${field}: ${String(value)}`,
          path: [index, field],
        });
      }
      seen.add(value);
    });
  };
}

function sectionPayloadSchema(name: SectionName): z.ZodTypeAny {
  const { def, row } = sectionSchemas[name];
  if (def.kind === 'singleton') return row.nullable().optional();
  return z
    .array(row)
    .max(MAX_ROWS_PER_SECTION)
    .superRefine(uniqueBy(def.matchBy ?? 'id'))
    .optional();
}

const dataSchema = z
  .object({
    systemConfigs: z
      .array(systemConfigRowSchema)
      .max(MAX_ROWS_PER_SECTION)
      .superRefine(uniqueBy('key'))
      .optional(),
    ...(Object.fromEntries(
      SECTION_NAMES.map((name) => [name, sectionPayloadSchema(name)]),
    ) as Record<SectionName, z.ZodTypeAny>),
  })
  .strict();

export const backupPayloadSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_VERSION),
    exportedAt: z.string().datetime(),
    checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/, 'Invalid checksum'),
    data: dataSchema,
  })
  .strict();

type Row = Record<string, unknown>;

export interface SystemConfigBackupRow {
  key: string;
  category: string;
  label: string;
  description: string;
  isSecret: boolean;
  value: string | null;
  hasValue?: boolean;
}

export interface BackupData {
  systemConfigs?: SystemConfigBackupRow[];
  planConfigs?: Row[];
  featureFlags?: Row[];
  siteSettings?: Row | null;
  emailTemplates?: Row[];
  landingPageContent?: Row | null;
  faqs?: Row[];
  testimonials?: Row[];
  legalContents?: Row[];
}

export interface BackupPayload {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  checksum: string;
  data: BackupData;
}

export interface SectionResult {
  created: number;
  updated: number;
  skipped: number;
}

export type ImportResult = Record<'systemConfigs' | SectionName, SectionResult> & {
  /** Secret config keys present in the file; their stored values were left untouched */
  skippedSecretKeys: string[];
};

// ─── Checksum ─────────────────────────────────────────────────────

/** Deterministic JSON: object keys sorted, undefined dropped */
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Integrity check (detects truncated / hand-edited / corrupted files).
 * It is not a signature: backups stay portable between environments.
 */
export function computeChecksum(data: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalize(data)).digest('hex')}`;
}

// ─── Generic delegate access ──────────────────────────────────────

interface SectionDelegate {
  findMany(args?: { orderBy?: Record<string, 'asc' | 'desc'> }): Promise<Row[]>;
  findUnique(args: { where: Row }): Promise<Row | null>;
  upsert(args: { where: Row; create: Row; update: Row }): Promise<Row>;
}

type DbClient = Prisma.TransactionClient | typeof prisma;

function delegateFor(client: DbClient, def: SectionDef): SectionDelegate {
  return (client as unknown as Record<string, SectionDelegate>)[def.delegate]!;
}

function toExportRow(row: Row, fields: ModelField[]): Row {
  return Object.fromEntries(fields.map((field) => [field.name, row[field.name] ?? null]));
}

function toWriteData(row: Row, fields: ModelField[]): Row {
  const data: Row = {};
  for (const field of fields) {
    const value = row[field.name];
    if (value === undefined) continue;
    // Prisma needs an explicit DbNull to clear an optional Json column
    data[field.name] = field.type === 'Json' && value === null ? Prisma.DbNull : value;
  }
  return data;
}

// ─── Service ──────────────────────────────────────────────────────

class SystemBackupService {
  async exportConfig(): Promise<BackupPayload> {
    const systemConfigs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });

    const data: BackupData = {
      systemConfigs: systemConfigs.map((cfg) => ({
        key: cfg.key,
        category: cfg.category,
        label: cfg.label,
        description: cfg.description,
        isSecret: cfg.isSecret,
        value: cfg.isSecret ? null : cfg.value,
        ...(cfg.isSecret ? { hasValue: cfg.value.length > 0 } : {}),
      })),
    };

    for (const name of SECTION_NAMES) {
      const { def, fields } = sectionSchemas[name];
      const delegate = delegateFor(prisma, def);
      if (def.kind === 'singleton') {
        const row = await delegate.findUnique({ where: { id: SINGLETON_ID } });
        (data as Record<string, unknown>)[name] = row ? toExportRow(row, fields) : null;
      } else {
        const rows = await delegate.findMany({ orderBy: { [def.matchBy ?? 'id']: 'asc' } });
        (data as Record<string, unknown>)[name] = rows.map((row) => toExportRow(row, fields));
      }
    }

    // Round-trip through JSON so the checksum covers exactly what the client receives
    const serializable = JSON.parse(JSON.stringify(data)) as BackupData;

    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      checksum: computeChecksum(serializable),
      data: serializable,
    };
  }

  /**
   * Apply a validated backup. Rows are merged (upserted) by their natural key inside a single
   * transaction together with the audit log entry; nothing is deleted.
   */
  async importConfig(
    payload: BackupPayload,
    actor: { userId: string; ipAddress?: string; userAgent?: string },
  ): Promise<ImportResult> {
    const expected = computeChecksum(payload.data);
    if (expected !== payload.checksum) {
      throw new BadRequestError(
        'Backup checksum does not match its contents. The file is corrupted or was modified.',
        'CHECKSUM_MISMATCH',
      );
    }

    const emptyResult = (): SectionResult => ({ created: 0, updated: 0, skipped: 0 });
    const result = {
      systemConfigs: emptyResult(),
      ...Object.fromEntries(SECTION_NAMES.map((name) => [name, emptyResult()])),
      skippedSecretKeys: [] as string[],
    } as ImportResult;

    await prisma.$transaction(
      async (tx) => {
        // System configs: secrets are never written from a backup
        if (payload.data.systemConfigs) {
          const existing = new Map(
            (await tx.systemConfig.findMany({ select: { key: true, isSecret: true } })).map(
              (cfg) => [cfg.key, cfg],
            ),
          );
          for (const row of payload.data.systemConfigs) {
            const current = existing.get(row.key);
            if (row.isSecret || current?.isSecret || row.value === null) {
              result.systemConfigs.skipped += 1;
              result.skippedSecretKeys.push(row.key);
              continue;
            }
            if (current) {
              await tx.systemConfig.update({
                where: { key: row.key },
                data: { value: row.value },
              });
              result.systemConfigs.updated += 1;
            } else {
              await tx.systemConfig.create({
                data: {
                  key: row.key,
                  value: row.value,
                  category: row.category,
                  label: row.label,
                  description: row.description,
                  isSecret: false,
                },
              });
              result.systemConfigs.created += 1;
            }
          }
        }

        for (const name of SECTION_NAMES) {
          const section = (payload.data as Record<string, unknown>)[name];
          if (section === undefined || section === null) continue;

          const { def, fields } = sectionSchemas[name];
          const delegate = delegateFor(tx, def);
          const extra: Row = def.model === 'EmailTemplate' ? { updatedBy: actor.userId } : {};

          const rows = def.kind === 'singleton' ? [section as Row] : (section as Row[]);
          for (const row of rows) {
            const where: Row =
              def.kind === 'singleton'
                ? { id: SINGLETON_ID }
                : { [def.matchBy ?? 'id']: row[def.matchBy ?? 'id'] };
            const data = { ...toWriteData(row, fields), ...extra };
            const exists = (await delegate.findUnique({ where })) !== null;
            await delegate.upsert({ where, create: { ...where, ...data }, update: data });
            if (exists) result[name].updated += 1;
            else result[name].created += 1;
          }
        }

        // Written in the same transaction so an import can never be applied without its trail
        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            action: 'SYSTEM_CONFIG_IMPORTED',
            targetType: 'SystemBackup',
            targetId: payload.checksum,
            metadata: {
              backupExportedAt: payload.exportedAt,
              backupVersion: payload.version,
              checksum: payload.checksum,
              sections: Object.fromEntries(
                (['systemConfigs', ...SECTION_NAMES] as const).map((name) => [name, result[name]]),
              ),
              skippedSecretKeys: result.skippedSecretKeys,
            } as unknown as Prisma.InputJsonValue,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
        });
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    await this.invalidateCaches();
    return result;
  }

  /** Drop every cache that may hold configuration replaced by an import */
  private async invalidateCaches(): Promise<void> {
    try {
      clearMaintenanceCache();
      await Promise.all([
        configService.clearCache(),
        planConfigService.invalidateCache(),
        cache.delPattern('ff:*'),
        cache.delPattern('email-tpl:*'),
      ]);
    } catch (err) {
      logger.warn({ err }, 'System backup: cache invalidation failed after import');
    }
  }
}

export const systemBackupService = new SystemBackupService();
