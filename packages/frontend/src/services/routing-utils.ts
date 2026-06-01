import { PROVIDERS } from './providers.js';
import { inferProviderFromModel, SHARED_PROVIDERS } from 'manifest-shared';
import type { AuthType, ModelRoute, RoutingProvider } from './api.js';

export interface RouteSlots {
  override_route?: ModelRoute | null;
  auto_assigned_route?: ModelRoute | null;
  fallback_routes?: ModelRoute[] | null;
}

/**
 * Collect all key labels already used for a given model within a tier
 * (primary + fallbacks). Used to prevent duplicate (model, key) combos.
 *
 * Reads through the structured `override_route`, `auto_assigned_route`,
 * `fallback_routes` fields — `route.keyLabel` is the canonical pin location.
 *
 * @param excludeSlot - 'primary' to skip the primary slot (for the primary's
 *   own dropdown), or a fallback index to skip that fallback (for its dropdown).
 */
export function usedKeyLabelsForModelInTier(
  tier: RouteSlots | undefined,
  modelName: string,
  excludeSlot?: 'primary' | number,
  /** When a route has no explicit key pin, the proxy uses the first key
   *  by priority. Pass that label here so it gets counted as "used". */
  defaultKeyLabel?: string,
): Set<string> {
  const used = new Set<string>();
  if (!tier) return used;
  // Check primary
  if (excludeSlot !== 'primary') {
    const primary = tier.override_route ?? tier.auto_assigned_route ?? null;
    if (primary && primary.model === modelName) {
      const label = primary.keyLabel ?? defaultKeyLabel;
      if (label) used.add(label.toLowerCase());
    }
  }
  // Check fallbacks
  const routes = tier.fallback_routes ?? [];
  for (let i = 0; i < routes.length; i++) {
    if (excludeSlot === i) continue;
    const r = routes[i];
    if (!r) continue;
    if (r.model === modelName) {
      const label = r.keyLabel ?? defaultKeyLabel;
      if (label) used.add(label.toLowerCase());
    }
  }
  return used;
}

/**
 * All active credential rows for a (provider, auth_type) tuple, sorted by
 * priority. Local providers do not expose account keys, so they are excluded.
 */
export function activeRouteKeys(
  providers: RoutingProvider[],
  providerId: string,
  authType: AuthType,
): RoutingProvider[] {
  if (authType === 'local') return [];
  return providers
    .filter(
      (p) =>
        p.provider.toLowerCase() === providerId.toLowerCase() &&
        p.auth_type === authType &&
        p.is_active &&
        p.has_api_key,
    )
    .slice()
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Remaining credential rows that can still be used for a model in one tier.
 * Unpinned matching routes count as the first key by priority because that is
 * how the proxy resolves them at runtime.
 */
export function availableRouteKeysForModel(
  providers: RoutingProvider[],
  tier: RouteSlots | undefined,
  modelName: string,
  providerId: string,
  authType: AuthType,
  excludeSlot?: 'primary' | number,
): RoutingProvider[] {
  const keys = activeRouteKeys(providers, providerId, authType);
  if (keys.length === 0) return keys;
  const used = usedKeyLabelsForModelInTier(tier, modelName, excludeSlot, keys[0]?.label);
  return keys.filter((key) => !used.has(key.label.toLowerCase()));
}

export interface RouteKeySelection {
  /** Keys the user may choose from when a picker is needed. */
  keys: RoutingProvider[];
  /** A single key that can be applied without showing a picker. */
  autoLabel?: string;
  needsChoice: boolean;
  exhausted: boolean;
}

export function routeKeySelectionForModel(input: {
  providers: RoutingProvider[];
  tier: RouteSlots | undefined;
  modelName: string;
  providerId: string;
  authType: AuthType;
  slot: 'primary' | 'fallback';
}): RouteKeySelection {
  const keys = activeRouteKeys(input.providers, input.providerId, input.authType);
  if (keys.length <= 1) return { keys, needsChoice: false, exhausted: false };
  if (input.slot === 'primary') return { keys, needsChoice: true, exhausted: false };

  const availableKeys = availableRouteKeysForModel(
    input.providers,
    input.tier,
    input.modelName,
    input.providerId,
    input.authType,
  );
  if (availableKeys.length === 0) return { keys: [], needsChoice: false, exhausted: true };
  if (availableKeys.length === 1) {
    return {
      keys: availableKeys,
      autoLabel: availableKeys[0]!.label,
      needsChoice: false,
      exhausted: false,
    };
  }
  return { keys: availableKeys, needsChoice: true, exhausted: false };
}

/** Format per-million token price: $0.15 */
export function pricePerM(perToken: number | null | undefined): string {
  if (perToken == null) return '\u2014';
  const perM = Number(perToken) * 1_000_000;
  if (perM === 0) return 'Free';
  if (perM < 0.01) return '< $0.01';
  if (perM < 1) return `$${perM.toFixed(3)}`;
  return `$${perM.toFixed(2)}`;
}

/**
 * Map DB provider names to frontend provider IDs, derived from the shared
 * `SHARED_PROVIDERS` aliases so backend and frontend stay aligned.
 */
const PROVIDER_ALIASES: Record<string, string> = Object.fromEntries(
  SHARED_PROVIDERS.flatMap((p) => p.aliases.map((alias) => [alias.toLowerCase(), p.id])),
);

export function resolveProviderId(dbProvider: string): string | undefined {
  // Custom providers use their own key as-is
  if (dbProvider.startsWith('custom:')) return dbProvider;

  const key = dbProvider.toLowerCase();
  const alias = PROVIDER_ALIASES[key];
  return PROVIDERS.find((p) => p.id === key || p.id === alias || p.name.toLowerCase() === key)?.id;
}

export { inferProviderFromModel };

/** Resolve a display name for the inferred provider. */
export function inferProviderName(model: string): string | undefined {
  const id = inferProviderFromModel(model);
  if (!id) return undefined;
  return PROVIDERS.find((p) => p.id === id)?.name;
}

/**
 * Strip the internal `custom:<uuid>/` prefix from a model name.
 * Returns the raw model name (e.g. "openai/gpt-oss-120b").
 */
export function stripCustomPrefix(model: string): string {
  const match = model.match(/^custom:[^/]+\/(.+)$/);
  return match?.[1] ?? model;
}
