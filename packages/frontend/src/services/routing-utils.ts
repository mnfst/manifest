import { PROVIDERS } from './providers.js';
import { inferProviderFromModel, SHARED_PROVIDERS } from 'manifest-shared';
import type { TierAssignment } from './api.js';

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
  tier: TierAssignment | undefined,
  modelName: string,
  excludeSlot?: 'primary' | number,
  /** When the primary has no explicit key pin, the proxy uses the first key
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
    if (r.model === modelName && r.keyLabel) {
      used.add(r.keyLabel.toLowerCase());
    }
  }
  return used;
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
