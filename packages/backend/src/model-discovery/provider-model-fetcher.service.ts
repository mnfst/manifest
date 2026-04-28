import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { DiscoveredModel, FetcherConfig } from './model-fetcher';
import { OLLAMA_CLOUD_HOST, OLLAMA_HOST } from '../common/constants/ollama';
import { normalizeMinimaxSubscriptionBaseUrl } from '../routing/provider-base-url';
import { getQwenCompatibleBaseUrl, normalizeQwenCompatibleBaseUrl } from '../routing/qwen-region';
import { OpencodeGoCatalogService } from './opencode-go-catalog.service';

const FETCH_TIMEOUT_MS = 5000;
const DEFAULT_CONTEXT_WINDOW = 128000;
const ANTHROPIC_DEFAULT_CONTEXT = 200000;
const GEMINI_DEFAULT_CONTEXT = 1000000;
const MINIMAX_SUBSCRIPTION_MODELS_URL = 'https://api.minimax.io/anthropic/v1/models?limit=100';

/* ── Generic parser factory ── */

interface ModelParserConfig<T> {
  arrayKey: string;
  filter: (entry: T) => boolean;
  getId: (entry: T) => string;
  getDisplayName: (entry: T, id: string) => string;
  contextWindow?: number | ((entry: T) => number);
  inputPricePerToken?: number | null;
  outputPricePerToken?: number | null;
  capabilityCode?: boolean;
  qualityScore?: number;
}

function createModelParser<T>(
  config: ModelParserConfig<T>,
): (body: unknown, provider: string) => DiscoveredModel[] {
  return (body: unknown, provider: string): DiscoveredModel[] => {
    const arr = (body as Record<string, unknown>)?.[config.arrayKey];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((m: unknown) => config.filter(m as T))
      .map((m: unknown) => {
        const entry = m as T;
        const id = config.getId(entry);
        const ctxVal = config.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
        return {
          id,
          displayName: config.getDisplayName(entry, id),
          provider,
          contextWindow: typeof ctxVal === 'function' ? ctxVal(entry) : ctxVal,
          inputPricePerToken: config.inputPricePerToken ?? null,
          outputPricePerToken: config.outputPricePerToken ?? null,
          capabilityReasoning: false,
          capabilityCode: config.capabilityCode ?? false,
          qualityScore: config.qualityScore ?? 3,
        };
      });
  };
}

/* ── Shared OpenAI-compatible parser ── */

interface OpenAIModelEntry {
  id: string;
  object?: string;
  owned_by?: string;
}

const parseOpenAI = createModelParser<OpenAIModelEntry>({
  arrayKey: 'data',
  filter: (entry) => typeof entry.id === 'string' && entry.id.length > 0,
  getId: (entry) => entry.id,
  getDisplayName: (_entry, id) => id,
});

/* ── OpenAI-specific structural filters (not non-chat) ── */

/** Date-suffixed snapshots returned by OpenAI (e.g. gpt-4o-mini-2024-07-18). */
const OPENAI_DATE_SUFFIX_RE = /-\d{4}-\d{2}-\d{2}$/;

function parseOpenAIDeduped(body: unknown, provider: string): DiscoveredModel[] {
  const parsed = parseOpenAI(body, provider);
  // Deduplicate: if both an alias (gpt-4o-mini) and a dated snapshot
  // (gpt-4o-mini-2024-07-18) exist, keep only the alias.
  const ids = new Set(parsed.map((m) => m.id));
  return parsed.filter((m) => {
    if (!OPENAI_DATE_SUFFIX_RE.test(m.id)) return true;
    const alias = m.id.replace(OPENAI_DATE_SUFFIX_RE, '');
    return !ids.has(alias);
  });
}

/* ── Universal non-chat model filter ── */

/**
 * Non-chat patterns common across ALL providers. Models matching these
 * are not compatible with /v1/chat/completions and must be filtered out.
 * Covers: embeddings, TTS, speech recognition, image generation, audio.
 */
export const UNIVERSAL_NON_CHAT_RE =
  /(?:embed|tts|whisper|dall-e|imagen|cogview|wanx|sambert|paraformer|text-embedding|speech-to|voice-|audio-turbo)/i;

/**
 * Provider-specific non-chat patterns that supplement the universal filter.
 * Keyed by the config key used in PROVIDER_CONFIGS.
 */
export const PROVIDER_NON_CHAT: Record<string, RegExp> = {
  openai:
    /(?:moderation|davinci|babbage|^text-|realtime|-transcribe|^sora|^gpt-3\.5-turbo-instruct|audio|^chatgpt-image|^gpt-image-|search-api)/i,
  'openai-subscription':
    /(?:moderation|davinci|babbage|^text-|realtime|-transcribe|^sora|audio|^chatgpt-image|^gpt-image-)/i,
  gemini:
    /(?:^aqs-|nano-banana|^deep-research|computer-use|^lyria|^gemini-2\.0-flash-lite$|flash-lite-preview|robotics)/i,
  mistral:
    /(?:^mistral-ocr|moderation|voxtral-.*-(?:transcribe|realtime)|^labs-|^mistral-vibe-cli)/i,
  xai: /(?:imagine|multi-agent)/i,
  copilot: /accounts\/[^/]+\/routers\//i,
};

/**
 * Exact model IDs to block per provider. Use ONLY when no regex pattern
 * or metadata field can catch the model. Document WHY each entry exists.
 */
export const PROVIDER_BLOCKLIST: Record<string, ReadonlySet<string>> = {
  mistral: new Set([
    'voxtral-mini-2602', // Invalid model returned by API; not a real chat endpoint
  ]),
};

/** Filter models that are not compatible with chat completions. */
export function filterNonChatModels(
  models: DiscoveredModel[],
  configKey: string,
): DiscoveredModel[] {
  const providerFilter = PROVIDER_NON_CHAT[configKey];
  const blocklist = PROVIDER_BLOCKLIST[configKey];
  return models.filter((m) => {
    if (UNIVERSAL_NON_CHAT_RE.test(m.id)) return false;
    if (providerFilter && providerFilter.test(m.id)) return false;
    if (blocklist && blocklist.has(m.id)) return false;
    return true;
  });
}

function bearerHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

/* ── Provider-specific parsers ── */

interface MistralModelEntry {
  id: string;
  object?: string;
  owned_by?: string;
  capabilities?: {
    completion_chat?: boolean;
  };
  deprecation?: string | null;
}

const parseMistral = createModelParser<MistralModelEntry>({
  arrayKey: 'data',
  filter: (entry) => {
    if (typeof entry.id !== 'string' || entry.id.length === 0) return false;
    if (entry.deprecation != null) return false;
    if (entry.capabilities && entry.capabilities.completion_chat === false) return false;
    return true;
  },
  getId: (entry) => entry.id,
  getDisplayName: (_entry, id) => id,
});

interface AnthropicModelEntry {
  id: string;
  display_name?: string;
  type?: string;
}

const parseAnthropic = createModelParser<AnthropicModelEntry>({
  arrayKey: 'data',
  filter: (entry) => typeof entry.id === 'string' && entry.type === 'model',
  getId: (entry) => entry.id,
  getDisplayName: (entry, id) => entry.display_name || id,
  contextWindow: ANTHROPIC_DEFAULT_CONTEXT,
});

interface GeminiModelEntry {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
}

const GEMINI_VERSION_SUFFIX_RE = /-\d{3}$/;

function parseGemini(body: unknown, provider: string): DiscoveredModel[] {
  const models = (body as { models?: unknown[] })?.models;
  if (!Array.isArray(models)) return [];
  const parsed = models
    .filter((m: unknown) => {
      const entry = m as GeminiModelEntry;
      if (typeof entry.name !== 'string') return false;
      const methods = entry.supportedGenerationMethods;
      return Array.isArray(methods) && methods.includes('generateContent');
    })
    .map((m: unknown) => {
      const entry = m as GeminiModelEntry;
      // name is like "models/gemini-2.5-pro" — strip prefix
      const id = entry.name.replace(/^models\//, '');
      return {
        id,
        displayName: entry.displayName || id,
        provider,
        contextWindow: entry.inputTokenLimit ?? GEMINI_DEFAULT_CONTEXT,
        inputPricePerToken: null,
        outputPricePerToken: null,
        capabilityReasoning: false,
        capabilityCode: false,
        qualityScore: 3,
      };
    });

  // Deduplicate: if both an alias (gemini-2.0-flash) and a versioned
  // variant (gemini-2.0-flash-001) exist, keep only the alias.
  const ids = new Set(parsed.map((m) => m.id));
  return parsed.filter((m) => {
    if (!GEMINI_VERSION_SUFFIX_RE.test(m.id)) return true;
    const alias = m.id.replace(GEMINI_VERSION_SUFFIX_RE, '');
    return !ids.has(alias);
  });
}

interface OpenRouterModelEntry {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: { output_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
}

function parseOpenRouter(body: unknown, provider: string): DiscoveredModel[] {
  const data = (body as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter((m: unknown) => {
      const entry = m as OpenRouterModelEntry;
      if (typeof entry.id !== 'string') return false;
      const output = entry.architecture?.output_modalities?.map((o) => o.toLowerCase());
      if (output && output.length > 0 && !output.every((o) => o === 'text')) {
        return false;
      }
      return true;
    })
    .map((m: unknown) => {
      const entry = m as OpenRouterModelEntry;
      const prompt = entry.pricing?.prompt ? Number(entry.pricing.prompt) : null;
      const completion = entry.pricing?.completion ? Number(entry.pricing.completion) : null;
      return {
        id: entry.id,
        displayName: entry.name || entry.id,
        provider,
        contextWindow: entry.context_length ?? 128000,
        inputPricePerToken:
          prompt !== null && Number.isFinite(prompt) && prompt >= 0 ? prompt : null,
        outputPricePerToken:
          completion !== null && Number.isFinite(completion) && completion >= 0 ? completion : null,
        capabilityReasoning: false,
        capabilityCode: false,
        qualityScore: 3,
      };
    });
}

interface OllamaModelEntry {
  name: string;
  details?: { family?: string; parameter_size?: string };
}

const parseOllama = createModelParser<OllamaModelEntry>({
  arrayKey: 'models',
  filter: (entry) => typeof entry.name === 'string',
  getId: (entry) => entry.name.replace(/:latest$/, ''),
  getDisplayName: (_entry, id) => id,
  inputPricePerToken: 0,
  outputPricePerToken: 0,
  qualityScore: 2,
});

/* ── OpenAI subscription (Codex CLI models API) ── */

interface OpenAISubscriptionModelEntry {
  slug: string;
  display_name?: string;
  context_window?: number;
  visibility?: string;
  supported_in_api?: boolean;
}

const parseOpenaiSubscription = createModelParser<OpenAISubscriptionModelEntry>({
  arrayKey: 'models',
  filter: (entry) => typeof entry.slug === 'string' && entry.visibility === 'list',
  getId: (entry) => entry.slug,
  getDisplayName: (entry, id) => entry.display_name || id,
  contextWindow: (entry) => entry.context_window ?? 200000,
  inputPricePerToken: 0,
  outputPricePerToken: 0,
  capabilityCode: true,
});

/* ── GitHub Copilot (subscription-only, OpenAI-compatible /models) ── */

const parseCopilot = createModelParser<OpenAIModelEntry>({
  arrayKey: 'data',
  filter: (entry) => typeof entry.id === 'string' && entry.id.length > 0,
  getId: (entry) => `copilot/${entry.id}`,
  getDisplayName: (entry) => entry.id,
  inputPricePerToken: 0,
  outputPricePerToken: 0,
});

/* ── Provider configs ── */

export const PROVIDER_CONFIGS: Record<string, FetcherConfig> = {
  openai: {
    endpoint: 'https://api.openai.com/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAIDeduped,
  },
  'openai-subscription': {
    endpoint: 'https://chatgpt.com/backend-api/codex/models?client_version=0.99.0',
    buildHeaders: (key: string) => ({
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      originator: 'codex_cli_rs',
      'user-agent': 'codex_cli_rs/0.0.0 (Unknown 0; unknown) unknown',
    }),
    parse: parseOpenaiSubscription,
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  mistral: {
    endpoint: 'https://api.mistral.ai/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseMistral,
  },
  moonshot: {
    endpoint: 'https://api.moonshot.ai/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  xai: {
    endpoint: 'https://api.x.ai/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  minimax: {
    endpoint: 'https://api.minimaxi.chat/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  'minimax-subscription': {
    endpoint: MINIMAX_SUBSCRIPTION_MODELS_URL,
    buildHeaders: (key: string) => ({
      Authorization: `Bearer ${key}`,
      'anthropic-version': '2023-06-01',
    }),
    parse: parseAnthropic,
  },
  qwen: {
    endpoint: `${getQwenCompatibleBaseUrl('beijing')}/v1/models`,
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  zai: {
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  'zai-subscription': {
    endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/models?limit=100',
    buildHeaders: (key: string, authType?: string) => {
      const headers: Record<string, string> = {
        'anthropic-version': '2023-06-01',
      };
      if (authType === 'subscription') {
        headers['Authorization'] = `Bearer ${key}`;
        headers['anthropic-beta'] = 'oauth-2025-04-20';
      } else {
        headers['x-api-key'] = key;
      }
      return headers;
    },
    parse: parseAnthropic,
  },
  gemini: {
    endpoint: (key: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
    buildHeaders: () => ({}),
    parse: parseGemini,
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/models',
    buildHeaders: () => ({}),
    parse: parseOpenRouter,
  },
  ollama: {
    endpoint: `${OLLAMA_HOST}/api/tags`,
    buildHeaders: () => ({}),
    parse: parseOllama,
  },
  'ollama-cloud': {
    endpoint: `${OLLAMA_CLOUD_HOST}/api/tags`,
    buildHeaders: bearerHeaders,
    parse: parseOllama,
  },
  copilot: {
    endpoint: 'https://api.githubcopilot.com/models',
    buildHeaders: (key: string) => ({
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Editor-Version': 'vscode/1.100.0',
      'Editor-Plugin-Version': 'copilot/1.300.0',
      'Copilot-Integration-Id': 'vscode-chat',
    }),
    parse: parseCopilot,
  },
};

const OPENCODE_GO_CONTEXT_WINDOW = 200000;

@Injectable()
export class ProviderModelFetcherService {
  private readonly logger = new Logger(ProviderModelFetcherService.name);

  constructor(
    @Optional()
    @Inject(OpencodeGoCatalogService)
    private readonly opencodeGoCatalog: OpencodeGoCatalogService | null = null,
  ) {}

  async fetch(
    providerId: string,
    apiKey: string,
    authType?: string,
    endpointOverride?: string,
  ): Promise<DiscoveredModel[]> {
    let configKey = providerId.toLowerCase();
    // OpenAI subscription tokens use a different models endpoint
    if (configKey === 'openai' && authType === 'subscription') {
      configKey = 'openai-subscription';
    } else if (configKey === 'minimax' && authType === 'subscription') {
      configKey = 'minimax-subscription';
    } else if (configKey === 'zai' && authType === 'subscription') {
      configKey = 'zai-subscription';
    } else if (configKey === 'opencode-go') {
      return this.fetchOpencodeGoCatalog();
    }
    const config = PROVIDER_CONFIGS[configKey];
    if (!config) {
      this.logger.warn(`No fetcher config for provider: ${providerId}`);
      return [];
    }

    let url = typeof config.endpoint === 'function' ? config.endpoint(apiKey) : config.endpoint;
    if (endpointOverride && configKey === 'minimax-subscription') {
      const minimaxBaseUrl = normalizeMinimaxSubscriptionBaseUrl(endpointOverride);
      if (minimaxBaseUrl) {
        url = `${minimaxBaseUrl}/v1/models?limit=100`;
      } else {
        this.logger.warn('Ignoring invalid MiniMax subscription endpoint override');
      }
    } else if (endpointOverride && configKey === 'qwen') {
      const qwenBaseUrl = normalizeQwenCompatibleBaseUrl(endpointOverride);
      if (qwenBaseUrl) {
        url = `${qwenBaseUrl}/v1/models`;
      } else {
        this.logger.warn('Ignoring invalid Qwen endpoint override');
      }
    }

    const headers = config.buildHeaders(apiKey, authType);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(
          `Provider ${providerId} returned ${res.status} from ${url.replace(apiKey, '***')}`,
        );
        return [];
      }

      const body = await res.json();
      return filterNonChatModels(config.parse(body, providerId), configKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to fetch models from ${providerId}: ${message}`);
      return [];
    }
  }

  private async fetchOpencodeGoCatalog(): Promise<DiscoveredModel[]> {
    if (!this.opencodeGoCatalog) return [];
    const entries = await this.opencodeGoCatalog.list();
    return entries.map((entry) => ({
      id: `opencode-go/${entry.id}`,
      displayName: entry.displayName,
      provider: 'opencode-go',
      contextWindow: OPENCODE_GO_CONTEXT_WINDOW,
      inputPricePerToken: 0,
      outputPricePerToken: 0,
      capabilityReasoning: true,
      capabilityCode: true,
      qualityScore: 3,
    }));
  }
}
