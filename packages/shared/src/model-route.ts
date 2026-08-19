import type { AuthType } from './auth-types';

export interface ModelRoute {
  provider: string;
  authType: AuthType;
  model: string;
  keyLabel?: string | null;
  /** Skip this route while the backing subscription connection's quota is exhausted. */
  skipWhenQuotaExhausted?: boolean;
}

export function routeEquals(
  a: ModelRoute | null | undefined,
  b: ModelRoute | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.provider.toLowerCase() === b.provider.toLowerCase() &&
    a.authType === b.authType &&
    a.model === b.model &&
    normalizeKeyLabel(a.keyLabel) === normalizeKeyLabel(b.keyLabel)
  );
}

function normalizeKeyLabel(label: string | null | undefined): string | null {
  if (label === null || label === undefined) return null;
  const trimmed = label.trim();
  return trimmed === '' ? null : trimmed.toLowerCase();
}

export function isModelRoute(value: unknown): value is ModelRoute {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.provider !== 'string' ||
    typeof v.authType !== 'string' ||
    typeof v.model !== 'string'
  )
    return false;
  if (
    'keyLabel' in v &&
    v.keyLabel !== undefined &&
    v.keyLabel !== null &&
    typeof v.keyLabel !== 'string'
  )
    return false;
  if (
    'skipWhenQuotaExhausted' in v &&
    v.skipWhenQuotaExhausted !== undefined &&
    typeof v.skipWhenQuotaExhausted !== 'boolean'
  )
    return false;
  return true;
}

export function isModelRouteArray(value: unknown): value is ModelRoute[] {
  return Array.isArray(value) && value.every(isModelRoute);
}

export interface LegacyOverrideTriple {
  model: string | null;
  provider: string | null;
  authType: AuthType | null;
  skipWhenQuotaExhausted?: boolean | null;
}

/**
 * Build a ModelRoute from the legacy (model, provider, authType) triple.
 * Returns null if model is missing — provider/authType alone don't form a route.
 * This is lossless: every route that comes back round-trips identically through
 * routeToLegacy().
 */
export function legacyToRoute(triple: LegacyOverrideTriple): ModelRoute | null {
  if (!triple.model) return null;
  if (!triple.provider || !triple.authType) return null;
  const route: ModelRoute = {
    provider: triple.provider,
    authType: triple.authType,
    model: triple.model,
  };
  if (triple.skipWhenQuotaExhausted != null) {
    route.skipWhenQuotaExhausted = triple.skipWhenQuotaExhausted;
  }
  return route;
}

/**
 * Decompose a ModelRoute back into the legacy triple. Round-trips losslessly
 * with legacyToRoute().
 */
export function routeToLegacy(route: ModelRoute | null): LegacyOverrideTriple {
  if (!route) return { model: null, provider: null, authType: null };
  const triple: LegacyOverrideTriple = {
    model: route.model,
    provider: route.provider,
    authType: route.authType,
  };
  if (route.skipWhenQuotaExhausted != null) {
    triple.skipWhenQuotaExhausted = route.skipWhenQuotaExhausted;
  }
  return triple;
}
