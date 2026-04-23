/**
 * Canonical provider registry shared between backend and frontend.
 *
 * Every provider the system supports is declared here ONCE. Both the backend
 * (`PROVIDER_REGISTRY`) and the frontend (`PROVIDERS`) consume this list.
 * Backend-only fields (OpenRouter vendor prefixes, key requirement flags) live
 * alongside frontend-only visual bits (color, key prefix) so the two packages
 * can never drift on any shared fact.
 */

export interface SharedProviderEntry {
  /** Internal provider ID (lowercase, no spaces). */
  id: string;
  /** Human-readable display name shown in the UI. */
  displayName: string;
  /** Alternative IDs that map to this provider. */
  aliases: readonly string[];
  /**
   * OpenRouter vendor prefixes that map to this provider.
   * Used to attribute models from OpenRouter's API to their real provider.
   * E.g. "anthropic" prefix in "anthropic/claude-opus-4-6" → Anthropic.
   */
  openRouterPrefixes: readonly string[];
  /** Whether the provider requires an API key for model fetching. */
  requiresApiKey: boolean;
  /** Whether this provider is local-only (e.g. Ollama). */
  localOnly: boolean;
  /** Brand color used in the UI. */
  color: string;
  /** Expected API-key prefix (used for validation / placeholder). */
  keyPrefix: string;
  /** Minimum plausible API-key length. */
  minKeyLength: number;
  /** Placeholder shown in the UI's API-key input. */
  keyPlaceholder: string;
}

export const SHARED_PROVIDERS: readonly SharedProviderEntry[] = [
  {
    id: 'qwen',
    displayName: 'Alibaba',
    aliases: ['alibaba'],
    openRouterPrefixes: ['qwen', 'alibaba'],
    requiresApiKey: true,
    localOnly: false,
    color: '#FF6003',
    keyPrefix: 'sk-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    aliases: [],
    openRouterPrefixes: ['anthropic'],
    requiresApiKey: true,
    localOnly: false,
    color: '#d97757',
    keyPrefix: 'sk-ant-',
    minKeyLength: 50,
    keyPlaceholder: 'sk-ant-...',
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    aliases: [],
    openRouterPrefixes: ['deepseek'],
    requiresApiKey: true,
    localOnly: false,
    color: '#4d6bfe',
    keyPrefix: 'sk-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'copilot',
    displayName: 'GitHub Copilot',
    aliases: [],
    openRouterPrefixes: [],
    requiresApiKey: false,
    localOnly: false,
    color: '#000000',
    keyPrefix: '',
    minKeyLength: 0,
    keyPlaceholder: '',
  },
  {
    id: 'gemini',
    displayName: 'Google',
    aliases: ['google'],
    openRouterPrefixes: ['google'],
    requiresApiKey: true,
    localOnly: false,
    color: '#4285f4',
    keyPrefix: '',
    minKeyLength: 30,
    keyPlaceholder: 'API key',
  },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    aliases: [],
    openRouterPrefixes: ['minimax'],
    requiresApiKey: true,
    localOnly: false,
    color: '#E73562',
    keyPrefix: 'sk-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'mistral',
    displayName: 'Mistral',
    aliases: [],
    openRouterPrefixes: ['mistralai'],
    requiresApiKey: true,
    localOnly: false,
    color: '#f97316',
    keyPrefix: '',
    minKeyLength: 32,
    keyPlaceholder: 'API key',
  },
  {
    id: 'moonshot',
    displayName: 'Moonshot',
    aliases: ['kimi'],
    openRouterPrefixes: ['moonshotai'],
    requiresApiKey: true,
    localOnly: false,
    color: '#1a1a2e',
    keyPrefix: 'sk-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    aliases: [],
    openRouterPrefixes: [],
    requiresApiKey: false,
    localOnly: true,
    color: '#1a1a1a',
    keyPrefix: '',
    minKeyLength: 0,
    keyPlaceholder: '',
  },
  {
    id: 'ollama-cloud',
    displayName: 'Ollama Cloud',
    aliases: [],
    openRouterPrefixes: [],
    requiresApiKey: false,
    localOnly: false,
    color: '#1a1a1a',
    keyPrefix: '',
    minKeyLength: 0,
    keyPlaceholder: '',
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    aliases: [],
    openRouterPrefixes: ['openai'],
    requiresApiKey: true,
    localOnly: false,
    color: '#10a37f',
    keyPrefix: 'sk-',
    minKeyLength: 50,
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'opencode-go',
    displayName: 'OpenCode Go',
    aliases: ['opencodego'],
    openRouterPrefixes: [],
    requiresApiKey: true,
    localOnly: false,
    color: '#7C3AED',
    keyPrefix: '',
    minKeyLength: 20,
    keyPlaceholder: '',
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    aliases: [],
    openRouterPrefixes: ['openrouter'],
    requiresApiKey: true,
    localOnly: false,
    color: '#6366f1',
    keyPrefix: 'sk-or-',
    minKeyLength: 60,
    keyPlaceholder: 'sk-or-...',
  },
  {
    id: 'xai',
    displayName: 'xAI',
    aliases: [],
    openRouterPrefixes: ['xai', 'x-ai'],
    requiresApiKey: true,
    localOnly: false,
    color: '#555555',
    keyPrefix: 'xai-',
    minKeyLength: 50,
    keyPlaceholder: 'xai-...',
  },
  {
    id: 'zai',
    displayName: 'Z.ai',
    aliases: ['z.ai'],
    openRouterPrefixes: ['z-ai', 'zhipuai'],
    requiresApiKey: true,
    localOnly: false,
    color: '#2d2d2d',
    keyPrefix: '',
    minKeyLength: 30,
    keyPlaceholder: 'API key',
  },
] as const;

/** Map from provider ID → shared entry. */
export const SHARED_PROVIDER_BY_ID: ReadonlyMap<string, SharedProviderEntry> = new Map(
  SHARED_PROVIDERS.map((p) => [p.id, p]),
);

/** Map from any ID or alias → shared entry. */
export const SHARED_PROVIDER_BY_ID_OR_ALIAS: ReadonlyMap<string, SharedProviderEntry> = new Map(
  SHARED_PROVIDERS.flatMap((p) => [
    [p.id, p],
    ...p.aliases.map((a): [string, SharedProviderEntry] => [a, p]),
  ]),
);
