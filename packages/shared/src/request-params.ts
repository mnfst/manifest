import type { ProviderParamSpec } from './provider-params-spec';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | unknown[] | Record<string, unknown>;

/** Per-route UI/storage values keyed by `ProviderParamSpec.key`. */
export type RequestParamDefaults = Record<string, JsonValue>;

/**
 * Merge configured defaults into a request body using the route's param
 * specs. Storage stays as UI values; optional serializers run only here,
 * at outbound merge time. Body keys win over defaults by presence because
 * the final spread keeps the inbound body last.
 */
export function applyRequestParamDefaults<T extends Record<string, unknown>>(
  body: T,
  defaults: RequestParamDefaults | null | undefined,
  specs: readonly ProviderParamSpec[],
): T {
  if (!defaults) return body;
  const merged: Record<string, JsonValue> = {};
  for (const spec of specs) {
    if (!(spec.key in defaults)) continue;
    const fragment = spec.serialize
      ? spec.serialize(defaults[spec.key])
      : { [spec.key]: defaults[spec.key] };
    Object.assign(merged, fragment);
  }
  return { ...merged, ...body } as T;
}
