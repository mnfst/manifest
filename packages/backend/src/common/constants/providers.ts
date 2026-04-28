/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║              PROVIDER REGISTRY — Single Source of Truth             ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  The canonical provider list lives in `manifest-shared/providers`.  ║
 * ║  This module re-exports it under the historical backend-facing      ║
 * ║  names + the derived lookup maps used across the backend.           ║
 * ║                                                                    ║
 * ║  To add a new provider:                                             ║
 * ║   1. Add an entry to `SHARED_PROVIDERS` in the shared package       ║
 * ║   2. Add a FetcherConfig in provider-model-fetcher.service.ts       ║
 * ║   3. Add a ProviderEndpoint in proxy/provider-endpoints.ts          ║
 * ║   4. (Frontend auto-picks up shared fields; add UI-only bits in     ║
 * ║       packages/frontend/src/services/providers.ts if needed)        ║
 * ║                                                                    ║
 * ║  DO NOT duplicate provider names/IDs in other files.                ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import {
  SHARED_PROVIDERS,
  SHARED_PROVIDER_BY_ID,
  SHARED_PROVIDER_BY_ID_OR_ALIAS,
  type SharedProviderEntry,
} from 'manifest-shared';

export type ProviderRegistryEntry = SharedProviderEntry;

export const PROVIDER_REGISTRY: readonly ProviderRegistryEntry[] = SHARED_PROVIDERS;

export const PROVIDER_BY_ID: ReadonlyMap<string, ProviderRegistryEntry> = SHARED_PROVIDER_BY_ID;

export const PROVIDER_BY_ID_OR_ALIAS: ReadonlyMap<string, ProviderRegistryEntry> =
  SHARED_PROVIDER_BY_ID_OR_ALIAS;

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
