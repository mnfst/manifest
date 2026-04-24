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
  /**
   * Tiles that deep-link users into the local-server detail view (LM
   * Studio today). They do not have a fixed proxy endpoint — once
   * connected, the backend routes through the `custom:<uuid>` path
   * using the user-entered base URL. The proxy endpoint sanity test
   * skips entries with `tileOnly: true`.
   */
  tileOnly?: boolean;
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
    id: 'lmstudio',
    displayName: 'LM Studio',
    aliases: ['lm-studio', 'lm studio'],
    openRouterPrefixes: [],
    requiresApiKey: false,
    localOnly: true,
    tileOnly: true,
    color: '#4a90e2',
    keyPrefix: '',
    minKeyLength: 0,
    keyPlaceholder: '',
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

/**
 * Canonical IDs of providers that run on the user's own machine.
 * Used by the backend (`getAuthType`) and the frontend (provider modal
 * tabs, filtering) to decide whether a provider should be tagged
 * `auth_type: 'local'` and surfaced under the Local tab.
 */
export const CANONICAL_LOCAL_IDS: ReadonlySet<string> = new Set(
  SHARED_PROVIDERS.filter((p) => p.localOnly).map((p) => p.id),
);

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

/**
 * Collapse whitespace, dots, underscores, and hyphens so variants like
 * "LM Studio", "lm-studio", "lm.studio" and "lmstudio" all normalize to
 * the same alias key. Used wherever we match a free-form provider name
 * (custom-provider row names, deep-link params, test fixtures) against
 * `SHARED_PROVIDER_BY_ID_OR_ALIAS`.
 */
export const normalizeProviderName = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[\s._\-]+/g, '');

/**
 * Setup hints for local-LLM provider tiles: default port, setup command,
 * install URL, and Docker-specific fix copy. Consumed by the frontend
 * detail view to surface actionable guidance when the server is
 * unreachable.
 */
export interface LocalServerHint {
  /** Default port the server listens on. */
  defaultPort: number;
  /** One-line terminal command that starts the server with the right flags. */
  setupCommand: string;
  /** Where to send users who don't have the server installed yet (homepage / download page). */
  installUrl: string;
  /**
   * Short human-readable note shown at the top of the detail view when
   * the user is running Manifest inside Docker and the server needs to
   * bind `0.0.0.0` (otherwise host.docker.internal can't reach it).
   */
  dockerBindNote?: string;
  /**
   * One-liner CLI command that explicitly rebinds the server to `0.0.0.0`
   * so it's reachable from a Docker container on the same host. Used in
   * the Docker caveat card when the user's default setupCommand doesn't
   * already include the right bind (LM Studio's default is loopback).
   */
  dockerBindCommand?: string;
  /**
   * Human-readable GUI path to flip the "serve on network" toggle in the
   * provider's desktop app. Shown alongside the CLI command for users
   * who prefer not to open a terminal. Only set for providers that have
   * such a toggle (LM Studio).
   */
  dockerGuiFix?: string;
  /**
   * True when the provider's server-start flags persist across restarts
   * (LM Studio remembers the last `--bind`). Surfaces a "one-time setup"
   * reassurance line so users know they don't have to re-run on every
   * launch.
   */
  persistsBindAcrossLaunches?: boolean;
}

export const LOCAL_SERVER_HINTS: Readonly<Record<string, LocalServerHint>> = {
  ollama: {
    defaultPort: 11434,
    setupCommand: 'ollama pull llama3.1:8b   # then: ollama serve',
    installUrl: 'https://ollama.com/download',
  },
  lmstudio: {
    defaultPort: 1234,
    setupCommand: 'lms server start',
    installUrl: 'https://lmstudio.ai',
    dockerBindNote:
      'LM Studio listens on 127.0.0.1 by default, which a Docker container can\u2019t reach. Either flip the GUI toggle or run the CLI below.',
    dockerBindCommand: 'lms server start --bind 0.0.0.0 --port 1234 --cors',
    dockerGuiFix:
      'LM Studio \u2192 \u2699 Developer \u2192 enable \u201cServe on Local Network\u201d',
    persistsBindAcrossLaunches: true,
  },
};
