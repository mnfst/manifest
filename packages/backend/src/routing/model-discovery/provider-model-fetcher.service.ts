import { Injectable, Logger } from '@nestjs/common';
import { DiscoveredModel, FetcherConfig } from './model-fetcher';
import { OLLAMA_HOST } from '../../common/constants/ollama';
import { normalizeMinimaxSubscriptionBaseUrl } from '../provider-base-url';

const FETCH_TIMEOUT_MS = 5000;
const DEFAULT_CONTEXT_WINDOW = 128000;
const ANTHROPIC_DEFAULT_CONTEXT = 200000;
const GEMINI_DEFAULT_CONTEXT = 1000000;
const MINIMAX_SUBSCRIPTION_MODELS_URL = 'https://api.minimax.io/anthropic/v1/models?limit=100';

/* ── Shared OpenAI-compatible parser ── */

interface OpenAIModelEntry {
  id: string;
  object?: string;
  owned_by?: string;
}

function parseOpenAI(body: unknown, provider: string): DiscoveredModel[] {
  const data = (body as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter((m: unknown) => {
      const entry = m as OpenAIModelEntry;
      return typeof entry.id === 'string' && entry.id.length > 0;
    })
    .map((m: unknown) => {
      const entry = m as OpenAIModelEntry;
      return {
        id: entry.id,
        displayName: entry.id,
        provider,
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        inputPricePerToken: null,
        outputPricePerToken: null,
        capabilityReasoning: false,
        capabilityCode: false,
        qualityScore: 3,
      };
    });
}

function bearerHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

/* ── Provider-specific parsers ── */

interface AnthropicModelEntry {
  id: string;
  display_name?: string;
  type?: string;
}

function parseAnthropic(body: unknown, provider: string): DiscoveredModel[] {
  const data = (body as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter((m: unknown) => {
      const entry = m as AnthropicModelEntry;
      return typeof entry.id === 'string' && entry.type === 'model';
    })
    .map((m: unknown) => {
      const entry = m as AnthropicModelEntry;
      return {
        id: entry.id,
        displayName: entry.display_name || entry.id,
        provider,
        contextWindow: ANTHROPIC_DEFAULT_CONTEXT,
        inputPricePerToken: null,
        outputPricePerToken: null,
        capabilityReasoning: false,
        capabilityCode: false,
        qualityScore: 3,
      };
    });
}

interface GeminiModelEntry {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
}

function parseGemini(body: unknown, provider: string): DiscoveredModel[] {
  const models = (body as { models?: unknown[] })?.models;
  if (!Array.isArray(models)) return [];
  return models
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
        inputPricePerToken: prompt !== null && Number.isFinite(prompt) ? prompt : null,
        outputPricePerToken: completion !== null && Number.isFinite(completion) ? completion : null,
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

function parseOllama(body: unknown, provider: string): DiscoveredModel[] {
  const models = (body as { models?: unknown[] })?.models;
  if (!Array.isArray(models)) return [];
  return models
    .filter((m: unknown) => typeof (m as OllamaModelEntry).name === 'string')
    .map((m: unknown) => {
      const entry = m as OllamaModelEntry;
      const id = entry.name.replace(/:latest$/, '');
      return {
        id,
        displayName: id,
        provider,
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        inputPricePerToken: 0,
        outputPricePerToken: 0,
        capabilityReasoning: false,
        capabilityCode: false,
        qualityScore: 2,
      };
    });
}

/* ── OpenAI subscription (Codex CLI models API) ── */

interface OpenAISubscriptionModelEntry {
  slug: string;
  display_name?: string;
  context_window?: number;
  visibility?: string;
  supported_in_api?: boolean;
}

function parseOpenaiSubscription(body: unknown, provider: string): DiscoveredModel[] {
  const data = (body as { models?: unknown[] })?.models;
  if (!Array.isArray(data)) return [];
  return data
    .filter((m: unknown) => {
      const entry = m as OpenAISubscriptionModelEntry;
      return typeof entry.slug === 'string' && entry.visibility === 'list';
    })
    .map((m: unknown) => {
      const entry = m as OpenAISubscriptionModelEntry;
      return {
        id: entry.slug,
        displayName: entry.display_name || entry.slug,
        provider,
        contextWindow: entry.context_window ?? 200000,
        inputPricePerToken: 0,
        outputPricePerToken: 0,
        capabilityReasoning: false,
        capabilityCode: true,
        qualityScore: 3,
      };
    });
}

/* ── Provider configs ── */

export const PROVIDER_CONFIGS: Record<string, FetcherConfig> = {
  openai: {
    endpoint: 'https://api.openai.com/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
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
    parse: parseOpenAI,
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
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  opencode: {
    endpoint: 'https://opencode.ai/zen/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  'opencode-go': {
    endpoint: 'https://opencode.ai/zen/v1/models',
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
  'ollama-cloud': {
    endpoint: 'https://ollama.com/api/tags',
    buildHeaders: bearerHeaders,
    parse: parseOllama,
  },
  ollama: {
    endpoint: `${OLLAMA_HOST}/api/tags`,
    buildHeaders: () => ({}),
    parse: parseOllama,
  },
};

@Injectable()
export class ProviderModelFetcherService {
  private readonly logger = new Logger(ProviderModelFetcherService.name);

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
      return config.parse(body, providerId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to fetch models from ${providerId}: ${message}`);
      return [];
    }
  }
}
