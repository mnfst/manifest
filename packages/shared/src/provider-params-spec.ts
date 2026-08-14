import type { AuthType } from './auth-types';
import { resolveUnderlyingModelIdentity, underlyingGatewayModel } from './provider-inference';
import { normalizeProviderName, SHARED_PROVIDER_BY_ID_OR_ALIAS } from './providers';
import type { JsonPrimitive, JsonValue } from './request-params';

export const MODEL_MODALITIES = ['text', 'image', 'audio', 'video'] as const;

export type ModelModality = (typeof MODEL_MODALITIES)[number];

export const MODEL_CAPABILITIES = [...MODEL_MODALITIES, 'stream', 'tools'] as const;

export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];

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
 * MPS applicability is a deliberately small JSON rule language.
 * Keep this in sync with docs/model-parameters-schema.md.
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

export interface ModelParamDefinition {
  /**
   * Dot path through the storage and request body shape.
   * Examples: `temperature`, `reasoning_effort`, `thinking.budget_tokens`.
   */
  path: string;
  type: ModelParamType;
  label: string;
  description: string;
  default?: JsonValue;
  values?: readonly JsonValue[];
  range?: ModelParamRange;
  group: ModelParamGroup;
  applicability?: ParamApplicability;
}

export interface ProviderModelParamSpec {
  provider: string;
  authType: AuthType;
  model: string;
  capabilities?: readonly ModelCapability[];
  params: readonly ModelParamDefinition[];
}

export interface ProviderParamSpec extends ModelParamDefinition {
  provider: string;
  authType: AuthType;
  model: string;
}

export type ProviderParamSpecCatalog = readonly ProviderModelParamSpec[];

const GROUP_ORDER: readonly ModelParamGroup[] = [
  'generation_length',
  'sampling',
  'reasoning',
  'tooling',
  'output_format',
  'observability',
  'provider_metadata',
];

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export function normalizeProviderParamProviderId(providerId: string): string {
  const lower = providerId.toLowerCase();
  const exact = SHARED_PROVIDER_BY_ID_OR_ALIAS.get(lower);
  if (exact) return exact.id;
  const normalized = SHARED_PROVIDER_BY_ID_OR_ALIAS.get(normalizeProviderName(lower));
  if (normalized) return normalized.id;
  return lower;
}

/**
 * Resolve the catalog lookup identity for a model.
 *
 * Gateways (e.g. OpenCode Go) are transparent transports: a model like
 * `opencode-go/deepseek-v4-pro` exposes the underlying provider's native
 * parameters, so it resolves to `(deepseek, api_key, deepseek-v4-pro)`. The
 * gateway's own subscription billing is irrelevant to which knobs the
 * model's API accepts, so authType collapses to `api_key`. Non-gateway ids
 * are returned unchanged.
 */
function paramLookupIdentity(
  providerId: string | undefined,
  authType: AuthType | undefined,
  model: string | undefined,
): { providerId: string | undefined; authType: AuthType | undefined; model: string | undefined } {
  if (!model || underlyingGatewayModel(model) === null) return { providerId, authType, model };
  const resolved = resolveUnderlyingModelIdentity(providerId, model);
  return { providerId: resolved.provider, authType: 'api_key', model: resolved.model };
}

export function getProviderParamSpecs(
  catalog: ProviderParamSpecCatalog,
  providerId: string | undefined,
  authType: AuthType | undefined,
  model: string | undefined,
): readonly ProviderParamSpec[] {
  const id = paramLookupIdentity(providerId, authType, model);
  if (!id.providerId || !id.authType || !id.model) return [];
  const provider = normalizeProviderParamProviderId(id.providerId);
  const entry = catalog.find(
    (spec) =>
      normalizeProviderParamProviderId(spec.provider) === provider &&
      spec.authType === id.authType &&
      spec.model === id.model,
  );
  if (!entry) return [];
  return entry.params
    .map((param) => {
      const provider = normalizeProviderParamProviderId(entry.provider);
      return {
        provider,
        authType: entry.authType,
        model: entry.model,
        ...param,
      };
    })
    .sort(compareProviderParamSpecs);
}

export function getProviderModelCapabilities(
  catalog: ProviderParamSpecCatalog,
  providerId: string | undefined,
  authType: AuthType | undefined,
  model: string | undefined,
): readonly ModelCapability[] | null {
  const id = paramLookupIdentity(providerId, authType, model);
  if (!id.providerId || !id.authType || !id.model) return null;
  const provider = normalizeProviderParamProviderId(id.providerId);
  const entry = catalog.find(
    (spec) =>
      normalizeProviderParamProviderId(spec.provider) === provider &&
      spec.authType === id.authType &&
      spec.model === id.model,
  );
  return entry?.capabilities ?? null;
}

export function compareProviderParamSpecs(
  a: ModelParamDefinition,
  b: ModelParamDefinition,
): number {
  const groupDelta = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  if (groupDelta !== 0) return groupDelta;

  const rootDelta = pathRoot(a.path).localeCompare(pathRoot(b.path));
  if (rootDelta !== 0) return rootDelta;

  const pathKindDelta = pathOrderRank(a.path) - pathOrderRank(b.path);
  if (pathKindDelta !== 0) return pathKindDelta;

  return a.path.localeCompare(b.path);
}

export function providerParamIsApplicable(
  spec: ModelParamDefinition,
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

export function isProviderParamPath(path: string): boolean {
  const segments = path.split('.');
  return (
    segments.length > 0 &&
    segments.every((segment) => segment !== '' && !UNSAFE_PATH_SEGMENTS.has(segment))
  );
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

export function providerParamValueIsValid(spec: ModelParamDefinition, value: unknown): boolean {
  if (spec.type === 'boolean') return typeof value === 'boolean';
  if (spec.type === 'string') return typeof value === 'string';
  if (spec.type === 'enum') {
    return (spec.values ?? []).some((candidate) => jsonValuesEqual(value, candidate));
  }
  if (spec.type === 'integer') return numberValueIsValid(spec, value, Number.isInteger);
  if (spec.type === 'number') return numberValueIsValid(spec, value);
  return false;
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
    if (spec.default === undefined) continue;
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
    entries.length > 0 &&
    entries.every(([path, expected]) => isProviderParamPath(path) && isMatchValue(expected))
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
  for (const segment of splitProviderParamPath(path)) {
    if (!isRecord(current)) return undefined;
    if (!hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

function hasPath(values: Record<string, unknown>, path: string): boolean {
  let current: unknown = values;
  const segments = splitProviderParamPath(path);
  for (let i = 0; i < segments.length; i++) {
    if (!isRecord(current) || !hasOwn(current, segments[i])) return false;
    current = current[segments[i]];
  }
  return true;
}

function setPath(values: Record<string, unknown>, path: string, value: JsonValue): void {
  const segments = splitProviderParamPath(path);
  let current = values;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const existing = hasOwn(current, segment) ? current[segment] : undefined;
    if (!isRecord(existing)) defineOwn(current, segment, {});
    current = current[segment] as Record<string, unknown>;
  }
  defineOwn(current, segments[segments.length - 1], value);
}

function deletePath(values: Record<string, unknown>, path: string): void {
  const parents: Array<[Record<string, unknown>, string]> = [];
  let current: unknown = values;
  const segments = splitProviderParamPath(path);
  for (let i = 0; i < segments.length - 1; i++) {
    if (!isRecord(current) || !hasOwn(current, segments[i])) return;
    parents.push([current, segments[i]]);
    current = current[segments[i]];
  }
  if (!isRecord(current)) return;
  deleteOwn(current, segments[segments.length - 1]);

  for (let i = parents.length - 1; i >= 0; i--) {
    const [parent, segment] = parents[i];
    const child = parent[segment];
    if (isRecord(child) && Object.keys(child).length === 0) {
      deleteOwn(parent, segment);
    }
  }
}

function pathRoot(path: string): string {
  return splitProviderParamPath(path)[0];
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

function numberValueIsValid(
  spec: ModelParamDefinition,
  value: unknown,
  predicate: (value: number) => boolean = Number.isFinite,
): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value) || !predicate(value)) return false;
  if (spec.range?.min !== undefined && value < spec.range.min) return false;
  if (spec.range?.max !== undefined && value > spec.range.max) return false;
  return true;
}

function structuredCloneRecord<T extends Record<string, unknown>>(
  value: T,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function splitProviderParamPath(path: string): string[] {
  if (!isProviderParamPath(path)) throw new Error(`Invalid provider param path: ${path}`);
  return path.split('.');
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function defineOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  /* istanbul ignore next -- splitProviderParamPath rejects these; this local guard satisfies CodeQL. */
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    throw new Error(`Invalid provider param path segment: ${key}`);
  }
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function deleteOwn(target: Record<string, unknown>, key: string): void {
  /* istanbul ignore next -- splitProviderParamPath rejects these; this local guard satisfies CodeQL. */
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
  if (hasOwn(target, key)) Reflect.deleteProperty(target, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
