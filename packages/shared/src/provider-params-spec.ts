import type { AuthType } from './auth-types';
import type { JsonPrimitive, JsonValue } from './request-params';

export type ModelParamType = 'boolean' | 'enum' | 'integer' | 'number' | 'string';

export type ModelParamGroup =
  | 'generation_length'
  | 'sampling'
  | 'reasoning'
  | 'tooling'
  | 'output_format'
  | 'observability'
  | 'provider_metadata';

export interface ModelParamRange {
  min?: number;
  max?: number;
  step?: number;
}

export interface ParamApplicabilityCondition {
  not: JsonPrimitive | readonly JsonPrimitive[];
}

/**
 * MPC applicability is a deliberately small JSON rule language.
 * Keep this in sync with docs/model-param-capability-schema.md.
 */
export type ParamApplicabilityValue =
  | JsonPrimitive
  | readonly JsonPrimitive[]
  | ParamApplicabilityCondition;

export type ParamApplicabilityMatch = Record<string, ParamApplicabilityValue>;
export type ParamApplicabilityRule = ParamApplicabilityMatch | readonly ParamApplicabilityMatch[];

export interface ParamApplicability {
  /**
   * Present only when the param is available for the matching values.
   * Omitted `applicability` means always available.
   */
  only?: ParamApplicabilityRule;
  /** Present when the param is unavailable for the matching values. */
  except?: ParamApplicabilityRule;
}

export interface ProviderParamSpec {
  provider: string;
  authType: AuthType;
  model: string;
  /**
   * Dot path through the storage and request body shape.
   * Examples: `temperature`, `reasoning_effort`, `thinking.budget_tokens`.
   */
  path: string;
  type: ModelParamType;
  label: string;
  default: JsonValue;
  values?: readonly JsonValue[];
  range?: ModelParamRange;
  group: ModelParamGroup;
  applicability?: ParamApplicability;
}

export type ProviderParamSpecCatalog = readonly ProviderParamSpec[];

const GROUP_ORDER: readonly ModelParamGroup[] = [
  'generation_length',
  'sampling',
  'reasoning',
  'tooling',
  'output_format',
  'observability',
  'provider_metadata',
];

export function getProviderParamSpecs(
  catalog: ProviderParamSpecCatalog,
  providerId: string | undefined,
  authType: AuthType | undefined,
  model: string | undefined,
): readonly ProviderParamSpec[] {
  if (!providerId || !authType || !model) return [];
  const provider = providerId.toLowerCase();
  return catalog
    .filter(
      (spec) =>
        spec.provider.toLowerCase() === provider &&
        spec.authType === authType &&
        spec.model === model,
    )
    .sort(compareProviderParamSpecs);
}

export function compareProviderParamSpecs(a: ProviderParamSpec, b: ProviderParamSpec): number {
  const groupDelta = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  if (groupDelta !== 0) return groupDelta;

  const rootDelta = pathRoot(a.path).localeCompare(pathRoot(b.path));
  if (rootDelta !== 0) return rootDelta;

  const pathKindDelta = pathOrderRank(a.path) - pathOrderRank(b.path);
  if (pathKindDelta !== 0) return pathKindDelta;

  return a.path.localeCompare(b.path);
}

export function providerParamIsApplicable(
  spec: ProviderParamSpec,
  values: Record<string, unknown>,
): boolean {
  const applicability = spec.applicability;
  if (applicability) {
    if (applicability.only && !matchesRule(applicability.only, values)) return false;
    if (applicability.except && matchesRule(applicability.except, values)) return false;
  }
  return true;
}

export function isParamApplicability(value: unknown): value is ParamApplicability {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => key !== 'only' && key !== 'except')) return false;
  const applicability = value as Record<string, unknown>;
  if (applicability.only !== undefined && !isApplicabilityRule(applicability.only)) return false;
  if (applicability.except !== undefined && !isApplicabilityRule(applicability.except)) {
    return false;
  }
  return true;
}

export function pickProviderCompatibleParams(
  params: Record<string, unknown>,
  specs: readonly ProviderParamSpec[],
): Record<string, JsonValue> {
  const expanded = expandConfiguredParamDefaults(params, specs);
  const out: Record<string, JsonValue> = {};

  for (const spec of specs) {
    if (!hasPath(expanded, spec.path)) continue;
    if (!providerParamIsApplicable(spec, expanded)) continue;
    setPath(out, spec.path, getPath(expanded, spec.path) as JsonValue);
  }

  return out;
}

export function omitProviderInapplicableParams<T extends Record<string, unknown>>(
  params: T,
  specs: readonly ProviderParamSpec[],
): T {
  let out: Record<string, unknown> | null = null;
  for (const spec of specs) {
    if (!hasPath(params, spec.path)) continue;
    if (providerParamIsApplicable(spec, params)) continue;
    out ??= structuredCloneRecord(params);
    deletePath(out, spec.path);
  }
  return (out ?? params) as T;
}

/**
 * Fill missing sibling defaults when a nested param object is configured.
 * Example: saving `thinking.type=enabled` also needs the applicable
 * `thinking.budget_tokens` default so the provider receives a complete
 * thinking object.
 */
export function expandConfiguredParamDefaults(
  params: Record<string, unknown>,
  specs: readonly ProviderParamSpec[],
): Record<string, unknown> {
  const out = structuredCloneRecord(params);
  const configuredRoots = new Set(
    Object.keys(out).filter(
      (key) => isRecord(out[key]) && specs.some((s) => pathRoot(s.path) === key),
    ),
  );
  if (configuredRoots.size === 0) return out;

  for (const spec of specs) {
    if (!configuredRoots.has(pathRoot(spec.path))) continue;
    if (hasPath(out, spec.path)) continue;
    if (!providerParamIsApplicable(spec, out)) continue;
    setPath(out, spec.path, spec.default);
  }
  return out;
}

export function getProviderParamValue(
  values: Record<string, unknown> | null | undefined,
  path: string,
): unknown {
  if (!values) return undefined;
  return getPath(values, path);
}

export function setProviderParamValue<T extends Record<string, unknown>>(
  values: T,
  path: string,
  value: JsonValue,
): T {
  const next = structuredCloneRecord(values);
  setPath(next, path, value);
  return next as T;
}

export function deleteProviderParamValue<T extends Record<string, unknown>>(
  values: T,
  path: string,
): T {
  const next = structuredCloneRecord(values);
  deletePath(next, path);
  return next as T;
}

function matchesRule(rule: ParamApplicabilityRule, values: Record<string, unknown>): boolean {
  const matches = Array.isArray(rule) ? rule : [rule];
  return matches.some((match) => matchesAll(match, values));
}

function matchesAll(match: ParamApplicabilityMatch, values: Record<string, unknown>): boolean {
  for (const [path, expected] of Object.entries(match)) {
    const exists = hasPath(values, path);
    const actual = getPath(values, path);
    if (isNotCondition(expected)) {
      if (!exists) return false;
      if (matchesValue(expected.not, actual)) return false;
      continue;
    }
    if (!matchesValue(expected, actual)) return false;
  }
  return true;
}

function matchesValue(
  expected: JsonPrimitive | readonly JsonPrimitive[] | undefined,
  actual: unknown,
) {
  if (expected === undefined) return actual === undefined;
  if (Array.isArray(expected)) {
    return expected.some((item) => jsonValuesEqual(actual, item));
  }
  return jsonValuesEqual(actual, expected);
}

function isNotCondition(value: ParamApplicabilityValue): value is ParamApplicabilityCondition {
  return isRecord(value) && 'not' in value;
}

function isApplicabilityRule(value: unknown): value is ParamApplicabilityRule {
  if (Array.isArray(value)) return value.length > 0 && value.every(isApplicabilityMatch);
  return isApplicabilityMatch(value);
}

function isApplicabilityMatch(value: unknown): value is ParamApplicabilityMatch {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 && entries.every(([path, expected]) => path !== '' && isMatchValue(expected))
  );
}

function isMatchValue(value: unknown): value is ParamApplicabilityValue {
  if (isComparableValue(value)) return true;
  return isApplicabilityCondition(value);
}

function isApplicabilityCondition(value: unknown): value is ParamApplicabilityCondition {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === 'not' && isComparableValue(value.not);
}

function isComparableValue(value: unknown): value is JsonPrimitive | readonly JsonPrimitive[] {
  if (isJsonPrimitive(value)) return true;
  return Array.isArray(value) && value.length > 0 && value.every(isJsonPrimitive);
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
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

function setPath(values: Record<string, unknown>, path: string, value: JsonValue): void {
  const segments = path.split('.');
  let current = values;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const existing = current[segment];
    if (!isRecord(existing)) current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

function deletePath(values: Record<string, unknown>, path: string): void {
  const parents: Array<[Record<string, unknown>, string]> = [];
  let current: unknown = values;
  const segments = path.split('.');
  for (let i = 0; i < segments.length - 1; i++) {
    if (!isRecord(current)) return;
    parents.push([current, segments[i]]);
    current = current[segments[i]];
  }
  if (!isRecord(current)) return;
  delete current[segments[segments.length - 1]];

  for (let i = parents.length - 1; i >= 0; i--) {
    const [parent, segment] = parents[i];
    const child = parent[segment];
    if (isRecord(child) && Object.keys(child).length === 0) {
      delete parent[segment];
    }
  }
}

function pathRoot(path: string): string {
  return path.split('.')[0];
}

function pathOrderRank(path: string): number {
  if (path.endsWith('.type')) return 0;
  return 1;
}

function jsonValuesEqual(a: unknown, b: unknown): boolean {
  if (isRecord(a) || isRecord(b) || Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

function structuredCloneRecord<T extends Record<string, unknown>>(
  value: T,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
