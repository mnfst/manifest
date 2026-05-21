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

  const effective = omitProviderInapplicableParams(out, orderedSpecs);
  return Object.keys(effective).length > 0 ? effective : null;
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
