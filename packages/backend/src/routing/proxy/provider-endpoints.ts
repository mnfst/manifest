import { OLLAMA_HOST } from '../../common/constants/ollama';

export interface ProviderEndpoint {
  baseUrl: string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildPath: (model: string) => string;
  format: 'openai' | 'google' | 'anthropic';
}

const openaiHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

const openaiPath = () => '/v1/chat/completions';

const anthropicHeaders = (apiKey: string) => ({
  'x-api-key': apiKey,
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
});

export const PROVIDER_ENDPOINTS: Record<string, ProviderEndpoint> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    buildHeaders: anthropicHeaders,
    buildPath: () => '/v1/messages',
    format: 'anthropic',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai',
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
  minimax: {
    baseUrl: 'https://api.minimax.io',
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
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    buildHeaders: () => ({ 'Content-Type': 'application/json' }),
    buildPath: (model: string) =>
      `/v1beta/models/${model}:generateContent`,
    format: 'google',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai',
    buildHeaders: openaiHeaders,
    buildPath: () => '/api/v1/chat/completions',
    format: 'openai',
  },
  ollama: {
    baseUrl: OLLAMA_HOST,
    buildHeaders: () => ({ 'Content-Type': 'application/json' }),
    buildPath: openaiPath,
    format: 'openai',
  },
};

/** Resolve a pricing-DB provider name to a provider endpoint key. */
export function resolveEndpointKey(provider: string): string | null {
  const lower = provider.toLowerCase();
  if (PROVIDER_ENDPOINTS[lower]) return lower;

  const aliases: Record<string, string> = {
    gemini: 'google',
    'z.ai': 'zai',
  };
  return aliases[lower] ?? null;
}
