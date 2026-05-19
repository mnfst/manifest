import type { AuthType } from './auth-types';
import type { JsonValue } from './request-params';

/**
 * UI control shape for one configurable param. Drives the dialog render,
 * the server compatibility check, and the snapshot's natural-default
 * lookup from a single declaration.
 *
 * Each variant maps directly to one dialog renderer. The registry is the
 * only place a new provider param should need to declare its UI shape.
 */
export type ParamControl =
  | { kind: 'toggle'; label: string; values: readonly [string, string]; default: string }
  | { kind: 'select'; label: string; values: readonly string[]; default: string }
  | { kind: 'slider'; label: string; min: number; max: number; step?: number; default: number }
  | { kind: 'number'; label: string; min?: number; max?: number; default: number };

export type ProviderParamDependencyEffect = 'disable' | 'omit';

export interface ProviderParamDependency {
  effect: ProviderParamDependencyEffect;
  when: {
    /** Dot path through the draft/storage shape, e.g. `thinking.type`. */
    key: string;
    equals?: JsonValue;
    values?: readonly JsonValue[];
  };
}

export interface ProviderParamSpec {
  /** Param key within its storage object. Ungrouped specs also use this as their storage key. */
  key: string;
  /** How the dialog renders it + what the provider does without an override. */
  control: ParamControl;
  /** Optional transform for provider wire shapes that are not flat request-body fields. */
  serialize?: (v: JsonValue) => Record<string, JsonValue>;
  /** Optional grouped storage. Grouped specs persist under `group.key`, not `key`. */
  group?: {
    key: string;
    label: string;
    serialize?: (v: JsonValue) => Record<string, JsonValue>;
  };
  /** Optional dependency used by the dialog to hide conditional controls. */
  visibleWhen?: {
    key: string;
    equals: JsonValue;
  };
  /** Provider compatibility rules derived from other param values. */
  dependencies?: readonly ProviderParamDependency[];
}

export interface ProviderParamSpecGroup {
  base: readonly ProviderParamSpec[];
  byModel?: Readonly<Record<string, readonly ProviderParamSpec[]>>;
}

export type ProviderParamSpecRegistry = Readonly<
  Record<`${string}:${AuthType}`, ProviderParamSpecGroup>
>;

/** All param specs for a provider/auth/model route, or empty when the route has none. */
export function getProviderParamSpecs(
  registry: ProviderParamSpecRegistry,
  providerId: string | undefined,
  authType: AuthType | undefined,
  model?: string | undefined,
): readonly ProviderParamSpec[] {
  if (!providerId || !authType) return [];
  const groupKey = `${providerId.toLowerCase()}:${authType}` as `${string}:${AuthType}`;
  const group = Object.prototype.hasOwnProperty.call(registry, groupKey)
    ? registry[groupKey]
    : undefined;
  if (!group) return [];
  if (model && group.byModel && Object.prototype.hasOwnProperty.call(group.byModel, model)) {
    return group.byModel[model] ?? [];
  }
  return group.base;
}

/** Top-level storage key consumed by a spec. */
export function providerParamStorageKey(spec: ProviderParamSpec): string {
  return spec.group?.key ?? spec.key;
}

export function providerParamHasEffect(
  spec: ProviderParamSpec,
  values: Record<string, unknown>,
  effect: ProviderParamDependencyEffect,
): boolean {
  return (
    spec.dependencies?.some(
      (dependency) =>
        dependency.effect === effect && providerParamDependencyMatches(dependency, values),
    ) ?? false
  );
}

export function omitProviderIncompatibleParams<T extends Record<string, unknown>>(
  params: T,
  specs: readonly ProviderParamSpec[],
): T {
  let out: Record<string, unknown> | null = null;

  for (const spec of specs) {
    const source = out ?? params;
    if (!providerParamHasEffect(spec, source, 'omit')) continue;
    out ??= { ...params };
    omitProviderParam(out, spec);
  }

  return (out ?? params) as T;
}

function providerParamDependencyMatches(
  dependency: ProviderParamDependency,
  values: Record<string, unknown>,
): boolean {
  const actual = providerParamPathValue(values, dependency.when.key);
  if (dependency.when.values) {
    return dependency.when.values.some((expected) => jsonValuesEqual(actual, expected));
  }
  if ('equals' in dependency.when) return jsonValuesEqual(actual, dependency.when.equals);
  return false;
}

function providerParamPathValue(values: Record<string, unknown>, path: string): unknown {
  let current: unknown = values;
  for (const segment of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function omitProviderParam(params: Record<string, unknown>, spec: ProviderParamSpec): void {
  if (!spec.group) {
    delete params[spec.key];
    return;
  }

  const existing = params[spec.group.key];
  if (!isRecord(existing)) return;
  const next = { ...existing };
  delete next[spec.key];
  if (Object.keys(next).length === 0) {
    delete params[spec.group.key];
  } else {
    params[spec.group.key] = next;
  }
}

function jsonValuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'object' || typeof b === 'object')
    return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Trim a params payload to only the storage keys the route's spec consumes.
 * Centralized here so the server controller and any future client-side
 * preview share the same compatibility logic.
 *
 * Returns the trimmed payload (may be empty) without mutating the input.
 */
export function pickProviderCompatibleParams(
  params: Record<string, JsonValue>,
  specs: readonly ProviderParamSpec[],
): Record<string, JsonValue> {
  const supported = new Set(specs.map(providerParamStorageKey));
  const out: Record<string, JsonValue> = {};
  for (const key of supported) {
    if (key in params) out[key] = params[key];
  }
  return out;
}
