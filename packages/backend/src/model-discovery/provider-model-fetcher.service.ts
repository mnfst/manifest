import { Injectable, Logger } from '@nestjs/common';
import { DiscoveredModel, FetcherConfig } from './model-fetcher';
import { OLLAMA_HOST } from '../common/constants/ollama';
import {
  buildCloudflareAiBaseUrl,
  normalizeMinimaxSubscriptionBaseUrl,
  parseCloudflareCredentials,
} from '../routing/provider-base-url';
import { getQwenCompatibleBaseUrl, normalizeQwenCompatibleBaseUrl } from '../routing/qwen-region';

const FETCH_TIMEOUT_MS = 5000;
const DEFAULT_CONTEXT_WINDOW = 128000;
const ANTHROPIC_DEFAULT_CONTEXT = 200000;
const GEMINI_DEFAULT_CONTEXT = 1000000;
const MINIMAX_SUBSCRIPTION_MODELS_URL = 'https://api.minimax.io/anthropic/v1/models?limit=100';
const GITHUB_API_VERSION = '2026-03-10';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function getArray(body: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(body)) return body;
  const record = asRecord(body);
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function readString(record: UnknownRecord | null, ...keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function readNumber(record: UnknownRecord | null, ...keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readStringList(record: UnknownRecord | null, ...keys: string[]): string[] {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  }
  return [];
}

function createModel(
  provider: string,
  id: string,
  displayName: string,
  overrides: Partial<DiscoveredModel> = {},
): DiscoveredModel {
  return {
    id,
    displayName,
    provider,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    inputPricePerToken: null,
    outputPricePerToken: null,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
    ...overrides,
  };
}

function readContextWindow(record: UnknownRecord | null): number {
  if (!record) return DEFAULT_CONTEXT_WINDOW;
  const limits = asRecord(record['limits']);
  const contextWindow = asRecord(record['context_window']);
  return (
    readNumber(
      record,
      'context_length',
      'context_window',
      'inputTokenLimit',
      'max_context_length',
    ) ??
    readNumber(limits, 'max_input_tokens') ??
    readNumber(contextWindow, 'tokens') ??
    DEFAULT_CONTEXT_WINDOW
  );
}

function readCommonPrice(record: UnknownRecord | null): {
  inputPricePerToken: number | null;
  outputPricePerToken: number | null;
} {
  if (!record) {
    return { inputPricePerToken: null, outputPricePerToken: null };
  }

  const pricing = asRecord(record['pricing']);
  const input = readNumber(pricing, 'prompt', 'input');
  const output = readNumber(pricing, 'completion', 'output');
  return {
    inputPricePerToken: input,
    outputPricePerToken: output,
  };
}

function bearerHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

function githubCatalogHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
  if (key) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

function cloudflareHeaders(key: string): Record<string, string> {
  const parsed = parseCloudflareCredentials(key);
  if (!parsed) return {};
  return { Authorization: `Bearer ${parsed.apiToken}` };
}

function cloudflareModelsEndpoint(key: string): string {
  const baseUrl = buildCloudflareAiBaseUrl(key);
  if (!baseUrl) return 'https://api.cloudflare.com/client/v4/accounts/invalid/ai/models/search';
  return `${baseUrl}/models/search?per_page=100`;
}

/**
 * Minimum context window for a model to be considered a chat/text model.
 * Non-chat models (speech-to-text, TTS) typically have tiny context windows
 * (e.g. Whisper = 448, Orpheus = 4000) that no chat model would have.
 */
const MIN_CHAT_CONTEXT_WINDOW = 8192;

function parseOpenAI(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'data')
    .map((entry) => {
      const record = asRecord(entry);
      const id = readString(record, 'id');
      if (!id) return null;
      if (record?.['active'] === false) return null;
      const contextWindow = readContextWindow(record);
      if (contextWindow < MIN_CHAT_CONTEXT_WINDOW) return null;
      const displayName = readString(record, 'display_name', 'name', 'friendly_name') ?? id;
      const { inputPricePerToken, outputPricePerToken } = readCommonPrice(record);
      return createModel(provider, id, displayName, {
        contextWindow,
        inputPricePerToken,
        outputPricePerToken,
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

function parseAnthropic(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'data')
    .map((entry) => {
      const record = asRecord(entry);
      const id = readString(record, 'id');
      if (!id || readString(record, 'type') !== 'model') return null;
      return createModel(provider, id, readString(record, 'display_name') ?? id, {
        contextWindow: ANTHROPIC_DEFAULT_CONTEXT,
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

function parseGemini(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'models')
    .map((entry) => {
      const record = asRecord(entry);
      const name = readString(record, 'name');
      const methods = readStringList(record, 'supportedGenerationMethods');
      if (!name || !methods.includes('generateContent')) return null;
      const id = name.replace(/^models\//, '');
      return createModel(provider, id, readString(record, 'displayName') ?? id, {
        contextWindow: readNumber(record, 'inputTokenLimit') ?? GEMINI_DEFAULT_CONTEXT,
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

function parseOpenRouter(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'data')
    .map((entry) => {
      const record = asRecord(entry);
      const id = readString(record, 'id');
      if (!id) return null;
      const architecture = asRecord(record?.['architecture']);
      const outputModalities = readStringList(architecture, 'output_modalities').map((item) =>
        item.toLowerCase(),
      );
      if (outputModalities.length > 0 && !outputModalities.every((item) => item === 'text')) {
        return null;
      }
      const { inputPricePerToken, outputPricePerToken } = readCommonPrice(record);
      return createModel(provider, id, readString(record, 'name') ?? id, {
        contextWindow: readNumber(record, 'context_length') ?? DEFAULT_CONTEXT_WINDOW,
        inputPricePerToken,
        outputPricePerToken,
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

function parseCohere(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'models')
    .map((entry) => {
      const record = asRecord(entry);
      const id = readString(record, 'name');
      if (!id) return null;
      return createModel(provider, id, readString(record, 'display_name') ?? id, {
        contextWindow: readNumber(record, 'context_length') ?? DEFAULT_CONTEXT_WINDOW,
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

function parseGitHubCatalog(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body)
    .map((entry) => {
      const record = asRecord(entry);
      const id = readString(record, 'id');
      if (!id) return null;
      const outputModalities = readStringList(record, 'supported_output_modalities').map((item) =>
        item.toLowerCase(),
      );
      if (outputModalities.length > 0 && !outputModalities.includes('text')) {
        return null;
      }
      const limits = asRecord(record?.['limits']);
      return createModel(provider, id, readString(record, 'name') ?? id, {
        contextWindow: readNumber(limits, 'max_input_tokens') ?? DEFAULT_CONTEXT_WINDOW,
        capabilityCode: readStringList(record, 'tags').some(
          (item) => item.toLowerCase() === 'code',
        ),
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

function parseHuggingFace(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'data')
    .map((entry) => {
      const record = asRecord(entry);
      const id = readString(record, 'id');
      if (!id) return null;
      const architecture = asRecord(record?.['architecture']);
      const outputModalities = readStringList(architecture, 'output_modalities').map((item) =>
        item.toLowerCase(),
      );
      if (outputModalities.length > 0 && !outputModalities.includes('text')) {
        return null;
      }

      const liveProviders = getArray(record, 'providers')
        .map((item) => asRecord(item))
        .filter((item): item is UnknownRecord => item !== null)
        .filter((item) => readString(item, 'status')?.toLowerCase() === 'live');
      if (liveProviders.length === 0) return null;

      const contextWindow = liveProviders.reduce((max, item) => {
        const contextLength = readNumber(item, 'context_length');
        return contextLength ? Math.max(max, contextLength) : max;
      }, 0);

      return createModel(provider, id, id, {
        contextWindow: contextWindow > 0 ? contextWindow : DEFAULT_CONTEXT_WINDOW,
        // Hugging Face router exposes provider-specific pricing in USD per million tokens.
        // The router selects providers server-side, so we avoid surfacing misleading
        // per-token prices for the aggregate model entry.
        inputPricePerToken: null,
        outputPricePerToken: null,
        capabilityCode: /\b(code|coder)\b/i.test(id),
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

function extractCloudflareTaskNames(record: UnknownRecord | null): string[] {
  if (!record) return [];
  const taskRecord = asRecord(record['task']);
  const tasks = [...readStringList(record, 'tasks'), ...readStringList(taskRecord, 'labels')];
  const directTask = readString(record, 'task', 'task_name', 'source_task');
  if (directTask) tasks.push(directTask);
  const taskName = readString(taskRecord, 'name');
  if (taskName) tasks.push(taskName);
  return tasks.map((task) => task.toLowerCase());
}

function isCloudflareTextTask(task: string): boolean {
  return (
    task.includes('text generation') ||
    task.includes('text-generation') ||
    task.includes('conversational') ||
    task.includes('chat')
  );
}

function parseCloudflare(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'result')
    .map((entry) => {
      const record = asRecord(entry);
      const modelName = readString(record, 'name');
      const id = modelName ?? readString(record, 'id');
      if (!id) return null;
      const tasks = extractCloudflareTaskNames(record);
      if (!tasks.some(isCloudflareTextTask)) return null;
      return createModel(provider, id, modelName ?? id, {
        contextWindow: readContextWindow(record),
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

function parseOllama(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'models')
    .map((entry) => {
      const record = asRecord(entry);
      const name = readString(record, 'name');
      if (!name) return null;
      const id = name.replace(/:latest$/, '');
      return createModel(provider, id, id, {
        inputPricePerToken: 0,
        outputPricePerToken: 0,
        qualityScore: 2,
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

function parseOpenaiSubscription(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'models')
    .map((entry) => {
      const record = asRecord(entry);
      const id = readString(record, 'slug');
      if (!id || readString(record, 'visibility') !== 'list') return null;
      return createModel(provider, id, readString(record, 'display_name') ?? id, {
        contextWindow: readNumber(record, 'context_window') ?? 200000,
        inputPricePerToken: 0,
        outputPricePerToken: 0,
        capabilityCode: true,
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

/* ── GitHub Copilot (subscription-only, OpenAI-compatible /models) ── */

function parseCopilot(body: unknown, provider: string): DiscoveredModel[] {
  return getArray(body, 'data')
    .map((entry) => {
      const record = asRecord(entry);
      const id = readString(record, 'id');
      if (!id) return null;
      // Copilot API returns bare names (e.g. "claude-opus-4.6");
      // internal convention uses "copilot/" prefix.
      return createModel(provider, `copilot/${id}`, id, {
        inputPricePerToken: 0,
        outputPricePerToken: 0,
      });
    })
    .filter((model): model is DiscoveredModel => model !== null);
}

/* ── Provider configs ── */

export const PROVIDER_CONFIGS: Record<string, FetcherConfig> = {
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
  cerebras: {
    endpoint: 'https://api.cerebras.ai/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  cloudflare: {
    endpoint: cloudflareModelsEndpoint,
    buildHeaders: cloudflareHeaders,
    parse: parseCloudflare,
  },
  cohere: {
    endpoint: 'https://api.cohere.com/v1/models?endpoint=chat&page_size=1000',
    buildHeaders: bearerHeaders,
    parse: parseCohere,
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  gemini: {
    endpoint: (key: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
    buildHeaders: () => ({}),
    parse: parseGemini,
  },
  'github-models': {
    endpoint: 'https://models.github.ai/catalog/models',
    buildHeaders: githubCatalogHeaders,
    parse: parseGitHubCatalog,
  },
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  huggingface: {
    endpoint: 'https://router.huggingface.co/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseHuggingFace,
  },
  llm7: {
    endpoint: 'https://api.llm7.io/v1/models',
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
  ollama: {
    endpoint: `${OLLAMA_HOST}/api/tags`,
    buildHeaders: () => ({}),
    parse: parseOllama,
  },
  'ollama-cloud': {
    endpoint: 'https://ollama.com/api/tags',
    buildHeaders: bearerHeaders,
    parse: parseOllama,
  },
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
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/models',
    buildHeaders: () => ({}),
    parse: parseOpenRouter,
  },
  qwen: {
    endpoint: `${getQwenCompatibleBaseUrl('beijing')}/v1/models`,
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  xai: {
    endpoint: 'https://api.x.ai/v1/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
  },
  zai: {
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/models',
    buildHeaders: bearerHeaders,
    parse: parseOpenAI,
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
    if (configKey === 'openai' && authType === 'subscription') {
      configKey = 'openai-subscription';
    } else if (configKey === 'minimax' && authType === 'subscription') {
      configKey = 'minimax-subscription';
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
      return config.parse(body, providerId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to fetch models from ${providerId}: ${message}`);
      return [];
    }
  }
}
