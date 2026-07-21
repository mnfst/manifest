import {
  compareProviderParamSpecs,
  expandConfiguredParamDefaults,
  omitProviderInapplicableParams,
  providerParamIsApplicable,
  setProviderParamValue,
  type ProviderParamSpec,
} from './provider-params-spec';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Per-route UI/storage values shaped by `ProviderParamSpec.path`. */
export type RequestParamDefaults = Record<string, JsonValue>;

/**
 * Merge configured Manifest params into a request body using the route's
 * param specs. Storage stays as UI values. The provider wire shape is the
 * same path shape unless a future provider needs a dedicated transformer.
 *
 * `knownParamPaths` is the set of param paths defined anywhere in the MPS
 * catalog. When provided, body params that are stale next to the merged
 * values are dropped — see {@link dropStaleCatalogSiblings}.
 */
export function applyRequestParamDefaults<T extends Record<string, unknown>>(
  body: T,
  defaults: RequestParamDefaults | null | undefined,
  specs: readonly ProviderParamSpec[],
  knownParamPaths?: ReadonlySet<string>,
): T {
  const orderedSpecs = [...specs].sort(compareProviderParamSpecs);
  if (!defaults) return omitProviderInapplicableParams(body, orderedSpecs);

  const expanded = expandConfiguredParamDefaults(defaults, orderedSpecs);
  let merged: Record<string, unknown> = {};
  for (const spec of orderedSpecs) {
    if (!providerParamIsApplicable(spec, expanded)) continue;
    if (!hasPath(expanded, spec.path)) continue;
    merged = setProviderParamValue(merged, spec.path, getPath(expanded, spec.path) as JsonValue);
  }

  const result = deepMerge(body, merged);
  dropStaleCatalogSiblings(result, body, merged, orderedSpecs, knownParamPaths);
  return omitProviderInapplicableParams(result, orderedSpecs) as T;
}

/**
 * Drop body params stranded by the merge. When a configured value rewrites a
 * body value under a nested root (e.g. the caller sent
 * `thinking: {type: "enabled", budget_tokens: N}` and the route's params flip
 * `type` to `adaptive`), caller-sent siblings under that root described the
 * shape the caller chose, not the merged one. A sibling is dropped when the
 * catalog knows its path as a provider param but the current model's spec
 * does not carry it — `omitProviderInapplicableParams` can only judge paths
 * the spec defines, so without this a stale `thinking.budget_tokens` rides
 * alongside the merged `type: "adaptive"` into an Anthropic 400 (#2543).
 * Unknown paths (vendor extensions) and untouched roots are preserved.
 */
function dropStaleCatalogSiblings(
  result: Record<string, unknown>,
  body: Record<string, unknown>,
  merged: Record<string, unknown>,
  specs: readonly ProviderParamSpec[],
  knownParamPaths: ReadonlySet<string> | undefined,
): void {
  if (!knownParamPaths) return;
  for (const root of Object.keys(merged)) {
    const bodyRoot = body[root];
    if (!isRecord(merged[root]) || !isRecord(bodyRoot)) continue;
    const rootRewritten = specs.some(
      (spec) =>
        spec.path.startsWith(`${root}.`) &&
        hasPath(body, spec.path) &&
        hasPath(merged, spec.path) &&
        JSON.stringify(getPath(body, spec.path)) !== JSON.stringify(getPath(merged, spec.path)),
    );
    if (!rootRewritten) continue;
    for (const path of leafPaths(bodyRoot, root)) {
      if (!knownParamPaths.has(path)) continue;
      if (specs.some((spec) => spec.path === path)) continue;
      deletePath(result, path);
    }
  }
}

function leafPaths(value: Record<string, unknown>, prefix: string): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    isRecord(child) ? leafPaths(child, `${prefix}.${key}`) : [`${prefix}.${key}`],
  );
}

function deletePath(values: Record<string, unknown>, path: string): void {
  const segments = path.split('.');
  let current: Record<string, unknown> = values;
  for (let i = 0; i < segments.length - 1; i++) {
    const next = current[segments[i]];
    if (!isRecord(next)) return;
    current = next;
  }
  delete current[segments[segments.length - 1]];
}

function deepMerge(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const out = structuredCloneRecord(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (isRecord(value) && isRecord(out[key])) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function getPath(values: Record<string, unknown>, path: string): unknown {
  let current: unknown = values;
  for (const segment of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function hasPath(values: Record<string, unknown>, path: string): boolean {
  let current: unknown = values;
  const segments = path.split('.');
  for (let i = 0; i < segments.length; i++) {
    if (!isRecord(current) || !(segments[i] in current)) return false;
    current = current[segments[i]];
  }
  return true;
}

function structuredCloneRecord<T extends Record<string, unknown>>(
  value: T,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
