import type { AuthType } from './auth-types';
import { getProviderParamSpecs } from './provider-params-spec';

/**
 * Two-state UI/storage value for DeepSeek's `thinking` field. Provider wire
 * shapes are handled by `ProviderParamSpec.serialize` when needed.
 */
export type ThinkingState = 'enabled' | 'disabled';

/**
 * Thin alias preserved for callers that specifically want the thinking-key
 * default. Derives from `PROVIDER_PARAM_SPECS` so auth/model-specific
 * behavior stays in the registry.
 */
export function providerThinkingDefault(
  providerId: string | undefined,
  authType: AuthType | undefined,
  model?: string | undefined,
): ThinkingState | undefined {
  const value = getProviderParamSpecs(providerId, authType, model).find(
    (spec) => spec.key === 'thinking',
  )?.control.default;
  return value === 'enabled' || value === 'disabled' ? value : undefined;
}
