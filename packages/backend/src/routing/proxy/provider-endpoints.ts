import { OLLAMA_HOST } from '../../common/constants/ollama';
import { PROVIDER_BY_ID_OR_ALIAS } from '../../common/constants/providers';
import {
  buildCloudflareAiBaseUrl,
  normalizeProviderBaseUrl,
  parseCloudflareCredentials,
} from '../provider-base-url';
import { getQwenCompatibleBaseUrl } from '../qwen-region';

export interface ProviderEndpoint {
  baseUrl: string | ((apiKey: string, authType?: string) => string);
  buildHeaders: (apiKey: string, authType?: string) => Record<string, string>;
  buildPath: (model: string, apiKey?: string, authType?: string) => string;
  format: 'openai' | 'google' | 'anthropic' | 'chatgpt';
  preserveModelId?: boolean;
}

const openaiHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

const openaiPath = () => '/v1/chat/completions';
const chatCompletionsPath = () => '/chat/completions';

const cloudflareHeaders = (apiKey: string) => {
  const parsed = parseCloudflareCredentials(apiKey);
  return {
    Authorization: `Bearer ${parsed?.apiToken ?? apiKey}`,
    'Content-Type': 'application/json',
  };
};

const cloudflareBaseUrl = (apiKey: string) => {
  const baseUrl = buildCloudflareAiBaseUrl(apiKey);
  if (!baseUrl) {
    throw new Error('Cloudflare credentials must use ACCOUNT_ID:API_TOKEN');
  }
  return baseUrl;
};

const anthropicHeaders = (apiKey: string, authType?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (authType === 'subscription') {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['anthropic-beta'] = 'oauth-2025-04-20';
  } else {
    headers['x-api-key'] = apiKey;
  }
  return headers;
};

const anthropicBearerHeaders = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
});

const githubCatalogHeaders = (apiKey: string): Record<string, string> => ({
  ...openaiHeaders(apiKey),
  Accept: 'application/vnd.github+json',
});

const CHATGPT_SUBSCRIPTION_BASE = 'https://chatgpt.com/backend-api';
const MINIMAX_SUBSCRIPTION_BASE = 'https://api.minimax.io/anthropic';
const chatgptSubscriptionHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  originator: 'codex_cli_rs',
  'user-agent': 'codex_cli_rs/0.0.0 (Unknown 0; unknown) unknown',
});

export const PROVIDER_ENDPOINTS: Record<string, ProviderEndpoint> = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    buildHeaders: anthropicHeaders,
    buildPath: () => '/v1/messages',
    format: 'anthropic',
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  cloudflare: {
    baseUrl: cloudflareBaseUrl,
    buildHeaders: cloudflareHeaders,
    buildPath: openaiPath,
    format: 'openai',
    preserveModelId: true,
  },
  cohere: {
    baseUrl: 'https://api.cohere.com/compatibility',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  copilot: {
    baseUrl: 'https://api.githubcopilot.com',
    buildHeaders: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Editor-Version': 'vscode/1.100.0',
      'Editor-Plugin-Version': 'copilot/1.300.0',
      'Copilot-Integration-Id': 'vscode-chat',
    }),
    buildPath: chatCompletionsPath,
    format: 'openai',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  'github-models': {
    baseUrl: 'https://models.github.ai/inference',
    buildHeaders: githubCatalogHeaders,
    buildPath: chatCompletionsPath,
    format: 'openai',
    preserveModelId: true,
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    buildHeaders: () => ({ 'Content-Type': 'application/json' }),
    buildPath: (model: string) => `/v1beta/models/${model}:generateContent`,
    format: 'google',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  huggingface: {
    baseUrl: 'https://router.huggingface.co/v1',
    buildHeaders: openaiHeaders,
    buildPath: chatCompletionsPath,
    format: 'openai',
    preserveModelId: true,
  },
  llm7: {
    baseUrl: 'https://api.llm7.io',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
    preserveModelId: true,
  },
  minimax: {
    baseUrl: 'https://api.minimax.io',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  'minimax-subscription': {
    baseUrl: MINIMAX_SUBSCRIPTION_BASE,
    buildHeaders: anthropicBearerHeaders,
    buildPath: () => '/v1/messages',
    format: 'anthropic',
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.ai',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  ollama: {
    baseUrl: OLLAMA_HOST,
    buildHeaders: () => ({ 'Content-Type': 'application/json' }),
    buildPath: openaiPath,
    format: 'openai',
  },
  'ollama-cloud': {
    baseUrl: 'https://ollama.com',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  'openai-subscription': {
    baseUrl: CHATGPT_SUBSCRIPTION_BASE,
    buildHeaders: chatgptSubscriptionHeaders,
    buildPath: () => '/codex/responses',
    format: 'chatgpt',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai',
    buildHeaders: openaiHeaders,
    buildPath: () => '/api/v1/chat/completions',
    format: 'openai',
    preserveModelId: true,
  },
  qwen: {
    baseUrl: getQwenCompatibleBaseUrl('beijing'),
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  xai: {
    baseUrl: 'https://api.x.ai',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  zai: {
    baseUrl: 'https://api.z.ai',
    buildHeaders: openaiHeaders,
    buildPath: () => '/api/paas/v4/chat/completions',
    format: 'openai',
  },
};

export function buildCustomEndpoint(baseUrl: string): ProviderEndpoint {
  return {
    baseUrl: normalizeProviderBaseUrl(baseUrl),
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
    preserveModelId: true,
  };
}

export function buildEndpointOverride(baseUrl: string, templateKey: string): ProviderEndpoint {
  const template = PROVIDER_ENDPOINTS[templateKey];
  if (!template) {
    throw new Error(`No provider endpoint template configured for: ${templateKey}`);
  }
  return {
    ...template,
    baseUrl: normalizeProviderBaseUrl(baseUrl),
  };
}

export function resolveEndpointKey(provider: string): string | null {
  const lower = provider.toLowerCase();
  if (PROVIDER_ENDPOINTS[lower]) return lower;

  if (lower.startsWith('custom:')) return lower;

  const entry = PROVIDER_BY_ID_OR_ALIAS.get(lower);
  if (entry) {
    if (PROVIDER_ENDPOINTS[entry.id]) return entry.id;
    for (const alias of entry.aliases) {
      if (PROVIDER_ENDPOINTS[alias]) return alias;
    }
  }

  return null;
}
