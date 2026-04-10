/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║              PROVIDER REGISTRY — Single Source of Truth             ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  This file defines ALL supported LLM providers for the routing     ║
 * ║  system. Every provider ID, display name, alias, and OpenRouter    ║
 * ║  prefix mapping MUST be defined here.                              ║
 * ║                                                                    ║
 * ║  To add a new provider:                                            ║
 * ║   1. Add an entry to PROVIDER_REGISTRY below                       ║
 * ║   2. Add a FetcherConfig in provider-model-fetcher.service.ts      ║
 * ║   3. Add a ProviderEndpoint in proxy/provider-endpoints.ts         ║
 * ║   4. Add a ProviderDef in frontend/src/services/providers.ts       ║
 * ║                                                                    ║
 * ║  DO NOT duplicate provider names/IDs in other files.               ║
 * ║  Import from this module instead.                                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export interface ProviderRegistryEntry {
  /** Internal provider ID used across the system (lowercase, no spaces). */
  id: string;
  /** Human-readable display name shown in the UI. */
  displayName: string;
  /** Alternative IDs that map to this provider. */
  aliases: string[];
  /**
   * OpenRouter vendor prefixes that map to this provider.
   * Used to attribute models from OpenRouter's API to their real provider.
   * E.g. "anthropic" prefix in "anthropic/claude-opus-4-6" → Anthropic.
   */
  openRouterPrefixes: string[];
  /** Whether the provider requires an API key for model fetching. */
  requiresApiKey: boolean;
  /** Whether this provider is local-only (e.g. Ollama). */
  localOnly: boolean;
}

export const PROVIDER_REGISTRY: readonly ProviderRegistryEntry[] = [
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    aliases: [],
    openRouterPrefixes: ['anthropic'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    aliases: [],
    openRouterPrefixes: ['openai'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'gemini',
    displayName: 'Google',
    aliases: ['google'],
    openRouterPrefixes: ['google'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    aliases: [],
    openRouterPrefixes: ['deepseek'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'mistral',
    displayName: 'Mistral',
    aliases: [],
    openRouterPrefixes: ['mistralai'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'moonshot',
    displayName: 'Moonshot',
    aliases: ['kimi'],
    openRouterPrefixes: ['moonshotai'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'xai',
    displayName: 'xAI',
    aliases: [],
    openRouterPrefixes: ['xai', 'x-ai'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    aliases: [],
    openRouterPrefixes: ['minimax'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'qwen',
    displayName: 'Alibaba',
    aliases: ['alibaba'],
    openRouterPrefixes: ['qwen', 'alibaba'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'zai',
    displayName: 'Z.ai',
    aliases: ['z.ai'],
    openRouterPrefixes: ['z-ai', 'zhipuai'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'copilot',
    displayName: 'GitHub Copilot',
    aliases: [],
    openRouterPrefixes: [],
    requiresApiKey: false,
    localOnly: false,
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    aliases: [],
    openRouterPrefixes: ['openrouter'],
    requiresApiKey: true,
    localOnly: false,
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    aliases: [],
    openRouterPrefixes: [],
    requiresApiKey: false,
    localOnly: true,
  },
  {
    id: 'ollama-cloud',
    displayName: 'Ollama Cloud',
    aliases: [],
    openRouterPrefixes: [],
    requiresApiKey: false,
    localOnly: false,
  },
] as const;

/* ── Derived lookup maps (computed once at import time) ── */

/** Map from provider ID → registry entry. */
export const PROVIDER_BY_ID: ReadonlyMap<string, ProviderRegistryEntry> = new Map(
  PROVIDER_REGISTRY.map((p) => [p.id, p]),
);

/** Map from any ID or alias → registry entry. */
export const PROVIDER_BY_ID_OR_ALIAS: ReadonlyMap<string, ProviderRegistryEntry> = new Map(
  PROVIDER_REGISTRY.flatMap((p) => [
    [p.id, p],
    ...p.aliases.map((a): [string, ProviderRegistryEntry] => [a, p]),
  ]),
);

/** Map from OpenRouter vendor prefix → provider display name. */
export const OPENROUTER_PREFIX_TO_PROVIDER: ReadonlyMap<string, string> = new Map(
  PROVIDER_REGISTRY.flatMap((p) =>
    p.openRouterPrefixes.map((prefix): [string, string] => [prefix, p.displayName]),
  ),
);

/** Set of all provider IDs (including aliases) for alias expansion. */
export const ALL_PROVIDER_IDS: ReadonlySet<string> = new Set(
  PROVIDER_REGISTRY.flatMap((p) => [p.id, ...p.aliases]),
);

/** Expand a set of provider names to include known aliases. */
export function expandProviderNames(names: Iterable<string>): Set<string> {
  const expanded = new Set<string>();
  for (const name of names) {
    const lower = name.toLowerCase();
    expanded.add(lower);
    if (lower.startsWith('custom:')) continue;
    const entry = PROVIDER_BY_ID_OR_ALIAS.get(lower);
    if (entry) {
      expanded.add(entry.id);
      for (const alias of entry.aliases) expanded.add(alias);
    }
  }
  return expanded;
}
