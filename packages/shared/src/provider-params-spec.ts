import type { RequestParamDefaults, RequestParamKey } from './request-params';

/**
 * UI control shape for one configurable param. Drives the dialog render,
 * the server compatibility check, and the snapshot's natural-default
 * lookup from a single declaration.
 *
 * Today the only shape is `toggle` (two-state, e.g. DeepSeek's `thinking`).
 * When a graded knob lands (e.g. OpenAI's `reasoning_effort` with `low` /
 * `medium` / `high`), add a `select` variant here with a `values` array
 * and a `default`.
 */
export type ParamControl = {
  kind: 'toggle';
  values: readonly [string, string];
  default: string;
};

export interface ProviderParamSpec {
  /** Key in the outbound request body (must be in `RequestParamDefaults`). */
  key: RequestParamKey;
  /** How the dialog renders it + what the provider does without an override. */
  control: ParamControl;
}

/**
 * Single source of truth: which provider consumes which request-body
 * params, with the UI shape + natural default. Adding a new provider/key
 * here is the only registry edit needed — the snapshot, the server
 * compatibility gate, and (over time) the dialog all read through here.
 *
 * Adding `reasoning_effort` for OpenAI when that ships would look like:
 *
 *   openai: [
 *     {
 *       key: 'reasoning_effort',
 *       control: { kind: 'select', values: ['low', 'medium', 'high'], default: 'medium' },
 *     },
 *   ],
 *
 * That single entry replaces what used to be three separate edits
 * (compatibility map, snapshot defaults map, controller gate branch).
 */
export const PROVIDER_PARAM_SPECS: Record<string, readonly ProviderParamSpec[]> = {
  deepseek: [
    {
      key: 'thinking',
      control: { kind: 'toggle', values: ['enabled', 'disabled'], default: 'enabled' },
    },
  ],
};

/** All param specs for a provider, or empty when the provider has none. */
export function getProviderParamSpecs(
  providerId: string | undefined,
): readonly ProviderParamSpec[] {
  if (!providerId) return [];
  return PROVIDER_PARAM_SPECS[providerId.toLowerCase()] ?? [];
}

/** True when the provider's spec declares this param key. */
export function providerSupportsParam(
  providerId: string | undefined,
  key: RequestParamKey,
): boolean {
  return getProviderParamSpecs(providerId).some((s) => s.key === key);
}

/**
 * The provider's natural API default for this param (i.e. what happens if
 * the outbound body omits the field). Used by the snapshot to record what
 * a request "had" when neither the client nor the user configured anything.
 */
export function providerParamDefault(
  providerId: string | undefined,
  key: RequestParamKey,
): string | undefined {
  const spec = getProviderParamSpecs(providerId).find((s) => s.key === key);
  return spec?.control.default;
}

/**
 * Trim a `RequestParamDefaults` payload to only the keys the provider's
 * spec consumes. Centralized here so the server controller and any future
 * client-side preview share the same compatibility logic instead of each
 * restating which (provider, key) pairs are valid.
 *
 * Returns the trimmed payload (may be empty) without mutating the input.
 */
export function pickProviderCompatibleParams(
  providerId: string | undefined,
  params: RequestParamDefaults,
): RequestParamDefaults {
  const supported = new Set(getProviderParamSpecs(providerId).map((s) => s.key));
  const out: RequestParamDefaults = {};
  for (const key of supported) {
    const value = (params as Record<string, unknown>)[key];
    if (value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
