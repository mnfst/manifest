import { OLLAMA_HOST } from '../../common/constants/ollama';

export interface ProviderEndpoint {
  baseUrl: string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildPath: (model: string) => string;
  format: 'openai';
}

const openaiHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

const openaiPath = () => '/v1/chat/completions';

export const PROVIDER_ENDPOINTS: Record<string, ProviderEndpoint> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
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
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    buildHeaders: openaiHeaders,
    buildPath: () => '/v1beta/openai/chat/completions',
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
  };
  return aliases[lower] ?? null;
}
