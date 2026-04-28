import { OLLAMA_CLOUD_HOST, OLLAMA_HOST } from '../../common/constants/ollama';
import { PROVIDER_BY_ID_OR_ALIAS } from '../../common/constants/providers';
import { normalizeProviderBaseUrl } from '../provider-base-url';
import { getQwenCompatibleBaseUrl } from '../qwen-region';

export interface ProviderEndpoint {
  baseUrl: string;
  buildHeaders: (apiKey: string, authType?: string) => Record<string, string>;
  buildPath: (model: string) => string;
  format: 'openai' | 'google' | 'anthropic' | 'chatgpt';
  /**
   * Set to `true` for endpoints whose `baseUrl` is user-supplied (custom
   * providers, subscription resource URLs). The proxy re-runs SSRF
   * validation against this URL immediately before each forward to defend
   * against DNS rebinding — the hostname might have resolved to a public
   * IP at registration time but rebinds to a private/metadata address at
   * forward time.
   */
  requiresSsrfRevalidation?: boolean;
}

const openaiHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

const openaiPath = () => '/v1/chat/completions';

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

// OpenCode Go's /v1/messages endpoint follows the native Anthropic protocol
// and authenticates via the `x-api-key` header, not `Authorization: Bearer`.
// Sending a Bearer token yields a "Missing API key" 401 from the upstream.
const opencodeGoAnthropicHeaders = (apiKey: string): Record<string, string> => ({
  'x-api-key': apiKey,
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
});

/**
 * ChatGPT subscription OAuth tokens use the Codex backend,
 * which requires specific headers to avoid 403 responses.
 * Note: These headers mimic the Codex CLI client. This is required for the
 * endpoint to accept requests, but may break if OpenAI changes validation.
 */
const CHATGPT_SUBSCRIPTION_BASE = 'https://chatgpt.com/backend-api';
const MINIMAX_SUBSCRIPTION_BASE = 'https://api.minimax.io/anthropic';
const ZAI_SUBSCRIPTION_BASE = 'https://open.bigmodel.cn/api/coding/paas/v4';
const OPENCODE_GO_BASE = 'https://opencode.ai/zen/go';
const chatgptSubscriptionHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  originator: 'codex_cli_rs',
  'user-agent': 'codex_cli_rs/0.0.0 (Unknown 0; unknown) unknown',
});

export const PROVIDER_ENDPOINTS: Record<string, ProviderEndpoint> = {
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
  // Standard OpenAI API key against api.openai.com/v1/responses — used for
  // Codex, -pro, o1-pro, and deep-research models that reject /v1/chat/completions.
  'openai-responses': {
    baseUrl: 'https://api.openai.com',
    buildHeaders: openaiHeaders,
    buildPath: () => '/v1/responses',
    format: 'chatgpt',
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
  'minimax-subscription': {
    baseUrl: MINIMAX_SUBSCRIPTION_BASE,
    buildHeaders: anthropicBearerHeaders,
    buildPath: () => '/v1/messages',
    format: 'anthropic',
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.ai',
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  qwen: {
    baseUrl: getQwenCompatibleBaseUrl('beijing'),
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
  'zai-subscription': {
    baseUrl: ZAI_SUBSCRIPTION_BASE,
    buildHeaders: openaiHeaders,
    buildPath: () => '/chat/completions',
    format: 'openai',
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    buildHeaders: () => ({ 'Content-Type': 'application/json' }),
    buildPath: (model: string) => `/v1beta/models/${model}:generateContent`,
    format: 'google',
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
    buildPath: () => '/chat/completions',
    format: 'openai',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai',
    buildHeaders: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://manifest.build',
      'X-Title': 'Manifest',
    }),
    buildPath: () => '/api/v1/chat/completions',
    format: 'openai',
  },
  ollama: {
    baseUrl: OLLAMA_HOST,
    buildHeaders: () => ({ 'Content-Type': 'application/json' }),
    buildPath: openaiPath,
    format: 'openai',
  },
  'ollama-cloud': {
    baseUrl: OLLAMA_CLOUD_HOST,
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  'opencode-go': {
    baseUrl: OPENCODE_GO_BASE,
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
  },
  'opencode-go-anthropic': {
    baseUrl: OPENCODE_GO_BASE,
    buildHeaders: opencodeGoAnthropicHeaders,
    buildPath: () => '/v1/messages',
    format: 'anthropic',
  },
};

/** Build a ProviderEndpoint for a custom provider with the given base URL. */
export function buildCustomEndpoint(
  baseUrl: string,
  apiKind: 'openai' | 'anthropic' = 'openai',
): ProviderEndpoint {
  // Strip trailing /v1 (or /v1/) since both buildPath callbacks include /v1.
  const normalized = normalizeProviderBaseUrl(baseUrl);
  if (apiKind === 'anthropic') {
    return {
      baseUrl: normalized,
      buildHeaders: anthropicHeaders,
      buildPath: () => '/v1/messages',
      format: 'anthropic',
      requiresSsrfRevalidation: true,
    };
  }
  return {
    baseUrl: normalized,
    buildHeaders: openaiHeaders,
    buildPath: openaiPath,
    format: 'openai',
    requiresSsrfRevalidation: true,
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
    // The base URL came from a user-supplied source (Qwen region selector,
    // MiniMax OAuth resource URL). Treat it as an SSRF candidate and
    // re-validate before each forward.
    requiresSsrfRevalidation: true,
  };
}

/** Resolve a pricing-DB provider name to a provider endpoint key. */
export function resolveEndpointKey(provider: string): string | null {
  const lower = provider.toLowerCase();
  if (PROVIDER_ENDPOINTS[lower]) return lower;

  // Custom providers use their own dynamic endpoint
  if (lower.startsWith('custom:')) return lower;

  // Look up via SST alias map — check id and all aliases against endpoints
  const entry = PROVIDER_BY_ID_OR_ALIAS.get(lower);
  if (entry) {
    if (PROVIDER_ENDPOINTS[entry.id]) return entry.id;
    for (const alias of entry.aliases) {
      if (PROVIDER_ENDPOINTS[alias]) return alias;
    }
  }

  return null;
}
