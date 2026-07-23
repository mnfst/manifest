import {
  compareProviderParamSpecs,
  expandConfiguredParamDefaults,
  getProviderParamValue,
  omitProviderInapplicableParams,
  providerParamIsApplicable,
  setProviderParamValue,
  type ProviderParamSpec,
} from './provider-params-spec';
import type { JsonValue, RequestParamDefaults } from './request-params';

/**
 * Snapshot which model parameters were effectively in play for a provider
 * attempt. Values are UI/storage values, not provider-specific serialized
 * wire fragments.
 */
export interface RequestParamsSnapshotInput {
  /** The inbound request body before model-param defaults are merged. */
  body: Record<string, unknown>;
  /** Saved params for the resolved route scope, if any. */
  modelParams: RequestParamDefaults | null | undefined;
  /** MPS catalog specs for the resolved provider/auth/model. */
  specs: readonly ProviderParamSpec[];
}

export function snapshotRequestParams(
  input: RequestParamsSnapshotInput,
): RequestParamDefaults | null {
  const { body, modelParams, specs } = input;
  const orderedSpecs = [...specs].sort(compareProviderParamSpecs);
  const expandedParams = modelParams
    ? expandConfiguredParamDefaults(modelParams, orderedSpecs)
    : null;
  let out: RequestParamDefaults = {};

  for (const spec of orderedSpecs) {
    if (expandedParams && hasPath(expandedParams, spec.path)) {
      out = setProviderParamValue(
        out,
        spec.path,
        getProviderParamValue(expandedParams, spec.path) as JsonValue,
      );
      continue;
    }
    if (hasPath(body, spec.path)) {
      out = setProviderParamValue(out, spec.path, getPath(body, spec.path) as JsonValue);
      continue;
    }
    if (spec.default !== undefined && providerParamIsApplicable(spec, out)) {
      out = setProviderParamValue(out, spec.path, spec.default);
    }
  }

  const effective = addSpeclessKnobs(
    omitProviderInapplicableParams(out, orderedSpecs),
    body,
    orderedSpecs,
  );
  return Object.keys(effective).length > 0 ? effective : null;
}

/**
 * Top-level body keys that are never model knobs: routing identity, message
 * content, tool definitions, and transport flags.
 */
const NON_KNOB_KEYS = new Set([
  'model',
  'messages',
  'input',
  'tools',
  'system',
  'instructions',
  'prompt',
  'metadata',
  'user',
  'stream',
  'stream_options',
]);

/** Longest string still plausibly a knob value rather than prompt content. */
const MAX_KNOB_STRING = 64;

/**
 * Keep spec-less scalar knobs the caller sent. The spec walk above only records
 * params the MPS catalog knows for the resolved route, but a param without a
 * spec still reaches the provider verbatim — and when the provider rejects it,
 * a snapshot that silently omitted it hides the very knob that caused the
 * failure (a caller-sent `temperature` on a model whose catalog entry dropped
 * the knob left a snapshot showing only `thinking`/`max_tokens` while the wire
 * error said temperature). Scalars only: an unknown object or long string may
 * carry content, which the snapshot must never store.
 */
function addSpeclessKnobs(
  effective: RequestParamDefaults,
  body: Record<string, unknown>,
  specs: readonly ProviderParamSpec[],
): RequestParamDefaults {
  const specRoots = new Set(specs.map((spec) => spec.path.split('.')[0]));
  let out = effective;
  for (const [key, value] of Object.entries(body)) {
    if (specRoots.has(key) || NON_KNOB_KEYS.has(key)) continue;
    if (!isKnobScalar(value)) continue;
    out = setProviderParamValue(out, key, value as JsonValue);
  }
  return out;
}

function isKnobScalar(value: unknown): boolean {
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  return typeof value === 'string' && value.length <= MAX_KNOB_STRING;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
