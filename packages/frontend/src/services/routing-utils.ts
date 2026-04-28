import { PROVIDERS } from './providers.js';
import { inferProviderFromModel, SHARED_PROVIDERS } from 'manifest-shared';

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
