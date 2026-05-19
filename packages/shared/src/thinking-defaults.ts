import type { ProviderParamSpec } from './provider-params-spec';

/**
 * Two-state UI/storage value for DeepSeek's `thinking` field. Provider wire
 * shapes are handled by `ProviderParamSpec.serialize` when needed.
 */
export type ThinkingState = 'enabled' | 'disabled';

/**
 * Thin alias for callers that specifically want the thinking-key default
 * from already-resolved route specs.
 */
export function providerThinkingDefault(
  specs: readonly ProviderParamSpec[],
): ThinkingState | undefined {
  const value = specs.find((spec) => spec.key === 'thinking')?.control.default;
  return value === 'enabled' || value === 'disabled' ? value : undefined;
}
