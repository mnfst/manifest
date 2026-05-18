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

export interface ProviderParamSpec {
  /** Storage key. Wire shape is `serialize(value)` when present, otherwise `{ [key]: value }`. */
  key: string;
  /** How the dialog renders it + what the provider does without an override. */
  control: ParamControl;
  /** Optional transform for provider wire shapes that are not flat request-body fields. */
  serialize?: (v: JsonValue) => Record<string, JsonValue>;
}

export interface ProviderParamSpecGroup {
  base: readonly ProviderParamSpec[];
  byModel?: Readonly<Record<string, readonly ProviderParamSpec[]>>;
}

/**
 * Single source of truth: which provider/auth route consumes which params,
 * with UI shape, storage key, natural default, and optional wire serializer.
 * Key format is `provider:authType`; model overrides replace `base`
 * wholesale when present.
 */
export const PROVIDER_PARAM_SPECS: Record<`${string}:${AuthType}`, ProviderParamSpecGroup> = {
  'anthropic:api_key': {
    base: [
      {
        key: 'max_tokens',
        control: {
          kind: 'number',
          label: 'Max tokens',
          min: 1,
          default: 4096,
        },
      },
      {
        key: 'temperature',
        control: {
          kind: 'slider',
          label: 'Temperature',
          min: 0,
          max: 1,
          step: 0.1,
          default: 1,
        },
      },
      {
        key: 'top_p',
        control: {
          kind: 'slider',
          label: 'Top P',
          min: 0,
          max: 1,
          step: 0.01,
          default: 1,
        },
      },
      {
        key: 'top_k',
        control: {
          kind: 'number',
          label: 'Top K',
          min: 0,
          default: 0,
        },
      },
    ],
  },
  'deepseek:api_key': {
    base: [
      {
        key: 'thinking',
        control: {
          kind: 'toggle',
          label: 'Thinking mode',
          values: ['enabled', 'disabled'],
          default: 'enabled',
        },
      },
    ],
  },
};

/** All param specs for a provider/auth/model route, or empty when the route has none. */
export function getProviderParamSpecs(
  providerId: string | undefined,
  authType: AuthType | undefined,
  model?: string | undefined,
): readonly ProviderParamSpec[] {
  if (!providerId || !authType) return [];
  const groupKey = `${providerId.toLowerCase()}:${authType}` as `${string}:${AuthType}`;
  const group = Object.prototype.hasOwnProperty.call(PROVIDER_PARAM_SPECS, groupKey)
    ? PROVIDER_PARAM_SPECS[groupKey]
    : undefined;
  if (!group) return [];
  if (model && group.byModel && Object.prototype.hasOwnProperty.call(group.byModel, model)) {
    return group.byModel[model] ?? [];
  }
  return group.base;
}

/**
 * Trim a params payload to only the storage keys the route's spec consumes.
 * Centralized here so the server controller and any future client-side
 * preview share the same compatibility logic.
 *
 * Returns the trimmed payload (may be empty) without mutating the input.
 */
export function pickProviderCompatibleParams(
  providerId: string | undefined,
  authType: AuthType | undefined,
  model: string | undefined,
  params: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const supported = new Set(getProviderParamSpecs(providerId, authType, model).map((s) => s.key));
  const out: Record<string, JsonValue> = {};
  for (const key of supported) {
    if (key in params) out[key] = params[key];
  }
  return out;
}
