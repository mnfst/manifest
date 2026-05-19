import {
  omitProviderIncompatibleParams,
  providerParamStorageKey,
  type ProviderParamSpec,
} from './provider-params-spec';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | unknown[] | Record<string, unknown>;

/** Per-route UI/storage values keyed by `ProviderParamSpec.key` or `ProviderParamSpec.group.key`. */
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
  if (!defaults) return omitProviderIncompatibleParams(body, specs);
  const merged: Record<string, JsonValue> = {};
  const handledGroups = new Set<string>();
  for (const spec of specs) {
    const storageKey = providerParamStorageKey(spec);
    if (!(storageKey in defaults)) continue;
    if (spec.group) {
      if (handledGroups.has(storageKey)) continue;
      handledGroups.add(storageKey);
      const fragment = spec.group.serialize
        ? spec.group.serialize(defaults[storageKey])
        : { [storageKey]: defaults[storageKey] };
      Object.assign(merged, fragment);
      continue;
    }
    const fragment = spec.serialize
      ? spec.serialize(defaults[storageKey])
      : { [storageKey]: defaults[storageKey] };
    Object.assign(merged, fragment);
  }
  return omitProviderIncompatibleParams({ ...merged, ...body }, specs) as T;
}
