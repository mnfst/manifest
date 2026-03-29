import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PROVIDER_BY_ID_OR_ALIAS } from '../common/constants/providers';

/**
 * Mapping from our internal provider IDs to models.dev provider directory names.
 * models.dev uses its own naming convention for provider directories.
 */
const PROVIDER_ID_MAP: Readonly<Record<string, string>> = {
  anthropic: 'anthropic',
  openai: 'openai',
  gemini: 'google',
  deepseek: 'deepseek',
  mistral: 'mistral',
  xai: 'xai',
  minimax: 'minimax',
  moonshot: 'moonshotai',
  qwen: 'alibaba',
  zai: 'zai',
  copilot: 'github-copilot',
};

const SUPPORTED_PROVIDERS = new Set(Object.keys(PROVIDER_ID_MAP));

/** Resolve a provider ID or alias to our canonical internal ID (e.g., 'alibaba' → 'qwen'). */
function resolveProviderId(providerId: string): string {
  const lower = providerId.toLowerCase();
  if (SUPPORTED_PROVIDERS.has(lower)) return lower;
  const entry = PROVIDER_BY_ID_OR_ALIAS.get(lower);
  return entry?.id ?? lower;
}

export interface ModelsDevModelEntry {
  id: string;
  name: string;
  family?: string;
  reasoning?: boolean;
  toolCall?: boolean;
  structuredOutput?: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputPricePerToken: number | null;
  outputPricePerToken: number | null;
  cacheReadPricePerToken?: number | null;
  cacheWritePricePerToken?: number | null;
}

interface RawModelsDevModel {
  id: string;
  name?: string;
  family?: string;
  reasoning?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  limit?: { context?: number; output?: number };
  modalities?: { input?: string[]; output?: string[] };
}

interface RawModelsDevProvider {
  id: string;
  name?: string;
  models?: Record<string, RawModelsDevModel>;
}

type RawModelsDevResponse = Record<string, RawModelsDevProvider>;

const MODELS_DEV_API = 'https://models.dev/api.json';
const FETCH_TIMEOUT_MS = 10000;
/** Matches trailing version suffixes like -001, -002 (Google API convention). */
const VERSION_SUFFIX_RE = /-\d{3}$/;
/** Matches trailing date suffixes like -20250514, -2025-04-14. */
const DATE_SUFFIX_RE = /-\d{4}-?\d{2}-?\d{2}$/;
/** Matches short date suffixes like -0709 (MMDD format, used by xAI). */
const SHORT_DATE_SUFFIX_RE = /-\d{4}$/;
/** Common suffix aliases: try appending -latest when the base name is not found. */
const LATEST_SUFFIX = '-latest';
/** xAI reasoning/non-reasoning mode suffixes. */
const REASONING_SUFFIX_RE = /-(reasoning|non-reasoning)$/;

@Injectable()
export class ModelsDevSyncService implements OnModuleInit {
  private readonly logger = new Logger(ModelsDevSyncService.name);
  /** Map: our provider ID → Map<model ID (native), entry> */
  private cache = new Map<string, Map<string, ModelsDevModelEntry>>();
  private lastFetchedAt: Date | null = null;

  async onModuleInit(): Promise<void> {
    try {
      await this.refreshCache();
    } catch (err) {
      this.logger.error(`Startup models.dev cache refresh failed: ${err}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async refreshCache(): Promise<number> {
    this.logger.log('Refreshing models.dev cache...');
    const raw = await this.fetchModelsDevData();
    if (!raw) return 0;

    const newCache = new Map<string, Map<string, ModelsDevModelEntry>>();
    let totalModels = 0;

    for (const [ourId, modelsDevId] of Object.entries(PROVIDER_ID_MAP)) {
      const provider = raw[modelsDevId];
      if (!provider?.models) continue;

      const modelMap = new Map<string, ModelsDevModelEntry>();
      for (const [modelId, model] of Object.entries(provider.models)) {
        if (!this.isChatCompatible(model)) continue;
        const entry = this.parseModel(modelId, model);
        modelMap.set(modelId, entry);
        totalModels++;
      }

      if (modelMap.size > 0) {
        newCache.set(ourId, modelMap);
      }
    }

    this.cache = newCache;
    this.lastFetchedAt = new Date();
    this.logger.log(`models.dev cache loaded: ${newCache.size} providers, ${totalModels} models`);

    return totalModels;
  }

  /**
   * Look up a single model by our provider ID and native model ID.
   * Tries multiple fallback strategies for variant model names:
   *   1. Exact match
   *   2. Strip 3-digit version suffix (-001)
   *   3. Strip date suffix (-20250514 or -2025-04-14)
   *   4. Append -latest (mistral-medium → mistral-medium-latest)
   *   5. Strip date then append -latest
   *   6. Strip -reasoning / -non-reasoning suffix (xAI convention)
   *   7. Strip 4-digit short date suffix (-0709 MMDD format)
   */
  lookupModel(providerId: string, modelId: string): ModelsDevModelEntry | null {
    const providerModels = this.cache.get(resolveProviderId(providerId));
    if (!providerModels) return null;

    // 1. Exact match
    const exact = providerModels.get(modelId);
    if (exact) return exact;

    // 2. Strip 3-digit version suffix (e.g., gemini-2.0-flash-001 → gemini-2.0-flash)
    const noVersion = modelId.replace(VERSION_SUFFIX_RE, '');
    if (noVersion !== modelId) {
      const found = providerModels.get(noVersion);
      if (found) return found;
    }

    // 3. Strip date suffix (e.g., gpt-4.1-2025-04-14 → gpt-4.1)
    const noDate = modelId.replace(DATE_SUFFIX_RE, '');
    if (noDate !== modelId) {
      const found = providerModels.get(noDate);
      if (found) return found;
    }

    // 4. Append -latest (e.g., mistral-medium → mistral-medium-latest)
    if (!modelId.endsWith(LATEST_SUFFIX)) {
      const withLatest = providerModels.get(modelId + LATEST_SUFFIX);
      if (withLatest) return withLatest;
    }

    // 5. Strip date then append -latest (e.g., mistral-small-2603 → mistral-small-latest)
    if (noDate !== modelId && !noDate.endsWith(LATEST_SUFFIX)) {
      const found = providerModels.get(noDate + LATEST_SUFFIX);
      if (found) return found;
    }

    // 6. Strip -reasoning / -non-reasoning suffix (xAI: grok-4-1-fast-reasoning → grok-4-1-fast)
    const noReasoning = modelId.replace(REASONING_SUFFIX_RE, '');
    if (noReasoning !== modelId) {
      const found = providerModels.get(noReasoning);
      if (found) return found;
    }

    // 7. Strip 4-digit short date suffix (xAI: grok-4-0709 → grok-4)
    const noShortDate = modelId.replace(SHORT_DATE_SUFFIX_RE, '');
    if (noShortDate !== modelId) {
      const found = providerModels.get(noShortDate);
      if (found) return found;
      // 8. Strip short date then append -latest (mistral-small-2603 → mistral-small-latest)
      if (!noShortDate.endsWith(LATEST_SUFFIX)) {
        const withLatest = providerModels.get(noShortDate + LATEST_SUFFIX);
        if (withLatest) return withLatest;
      }
    }

    return null;
  }

  /**
   * Get all models for a provider (by our internal provider ID).
   * Returns an empty array if the provider is not found.
   */
  getModelsForProvider(providerId: string): ModelsDevModelEntry[] {
    const providerModels = this.cache.get(resolveProviderId(providerId));
    if (!providerModels) return [];
    return [...providerModels.values()];
  }

  /** Whether a provider ID is mapped for models.dev lookups. */
  isProviderSupported(providerId: string): boolean {
    return SUPPORTED_PROVIDERS.has(resolveProviderId(providerId));
  }

  getLastFetchedAt(): Date | null {
    return this.lastFetchedAt;
  }

  private parseModel(modelId: string, raw: RawModelsDevModel): ModelsDevModelEntry {
    const inputPerMillion = raw.cost?.input ?? null;
    const outputPerMillion = raw.cost?.output ?? null;
    const cacheReadPerMillion = raw.cost?.cache_read ?? null;
    const cacheWritePerMillion = raw.cost?.cache_write ?? null;

    return {
      id: modelId,
      name: raw.name || modelId,
      family: raw.family,
      reasoning: raw.reasoning ?? false,
      toolCall: raw.tool_call ?? false,
      structuredOutput: raw.structured_output ?? false,
      contextWindow: raw.limit?.context,
      maxOutputTokens: raw.limit?.output,
      inputPricePerToken: inputPerMillion !== null ? inputPerMillion / 1_000_000 : null,
      outputPricePerToken: outputPerMillion !== null ? outputPerMillion / 1_000_000 : null,
      cacheReadPricePerToken: cacheReadPerMillion !== null ? cacheReadPerMillion / 1_000_000 : null,
      cacheWritePricePerToken:
        cacheWritePerMillion !== null ? cacheWritePerMillion / 1_000_000 : null,
    };
  }

  /** Filter to text-in / text-out models only (same logic as PricingSyncService). */
  private isChatCompatible(model: RawModelsDevModel): boolean {
    const inputMods = model.modalities?.input?.map((m) => m.toLowerCase());
    if (inputMods && inputMods.length > 0 && !inputMods.includes('text')) {
      return false;
    }
    const outputMods = model.modalities?.output?.map((m) => m.toLowerCase());
    if (outputMods && outputMods.length > 0) {
      return outputMods.every((m) => m === 'text');
    }
    return true;
  }

  private async fetchModelsDevData(): Promise<RawModelsDevResponse | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(MODELS_DEV_API, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.error(`models.dev API returned ${res.status}`);
        return null;
      }
      return (await res.json()) as RawModelsDevResponse;
    } catch (err) {
      this.logger.error(`Failed to fetch models.dev data: ${err}`);
      return null;
    }
  }
}
