import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface TokenUsageRecord {
  orgId: string;
  agentId?: string;
  conversationId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  pipelineType: string;
}

interface ModelPricing {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M output tokens */
  output: number;
}

const PRICING_CATEGORY = 'token_pricing';
const PRICING_CACHE_MS = 60_000;
const INPUT_SUFFIX = '.input_per_1m';
const OUTPUT_SUFFIX = '.output_per_1m';

/**
 * Persists per-request AI token usage (admin "Token Usage" analytics read from this table).
 *
 * Cost is derived from SystemConfig rows in the `token_pricing` category, keyed
 * `<model>.input_per_1m` / `<model>.output_per_1m` (USD per 1M tokens). When a model has no
 * pricing configured the row is stored with costUsd = 0 rather than a guessed price.
 */
class TokenUsageService {
  private pricingCache: { loadedAt: number; byModel: Map<string, ModelPricing> } | null = null;

  async record(data: TokenUsageRecord): Promise<void> {
    const inputTokens = Math.max(0, Math.trunc(data.inputTokens) || 0);
    const outputTokens = Math.max(0, Math.trunc(data.outputTokens) || 0);
    if (inputTokens === 0 && outputTokens === 0) return;

    const pricing = await this.getPricing(data.model);
    const costUsd = pricing
      ? (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
      : 0;

    await prisma.tokenUsage.create({
      data: {
        orgId: data.orgId,
        agentId: data.agentId ?? null,
        conversationId: data.conversationId,
        model: data.model,
        provider: data.provider,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
        pipelineType: data.pipelineType,
      },
    });
  }

  private async getPricing(model: string): Promise<ModelPricing | null> {
    const now = Date.now();
    if (!this.pricingCache || now - this.pricingCache.loadedAt > PRICING_CACHE_MS) {
      const byModel = new Map<string, ModelPricing>();
      try {
        const rows = await prisma.systemConfig.findMany({
          where: { category: PRICING_CATEGORY },
          select: { key: true, value: true },
        });
        for (const row of rows) {
          const price = Number(row.value);
          if (!Number.isFinite(price) || price < 0) continue;
          const isInput = row.key.endsWith(INPUT_SUFFIX);
          const isOutput = row.key.endsWith(OUTPUT_SUFFIX);
          if (!isInput && !isOutput) continue;
          const name = row.key.slice(0, -(isInput ? INPUT_SUFFIX : OUTPUT_SUFFIX).length);
          const entry = byModel.get(name) ?? { input: 0, output: 0 };
          if (isInput) entry.input = price;
          else entry.output = price;
          byModel.set(name, entry);
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to load token pricing config');
      }
      this.pricingCache = { loadedAt: now, byModel };
    }
    return this.pricingCache.byModel.get(model) ?? null;
  }
}

export const tokenUsageService = new TokenUsageService();
