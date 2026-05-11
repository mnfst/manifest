import { providerParamDefault } from './provider-params-spec';

/**
 * Two-state value for DeepSeek's `thinking.type` field. The wire shape is
 * curated in `RequestParamDefaults` (a discriminated `thinking: { type }`)
 * because OpenAI/Anthropic chat-completions don't share this knob — adding
 * a provider that consumes `thinking.type` is one entry in
 * `PROVIDER_PARAM_SPECS`, not a new wire schema.
 */
export type ThinkingState = 'enabled' | 'disabled';

/**
 * Thin alias preserved for callers that specifically want the thinking-key
 * default (dialog hint, snapshot fallback). Derives from
 * `PROVIDER_PARAM_SPECS` so adding a new provider that consumes `thinking`
 * is one entry in `provider-params-spec.ts`, not a parallel registry edit.
 */
export function providerThinkingDefault(providerId: string | undefined): ThinkingState | undefined {
  return providerParamDefault(providerId, 'thinking') as ThinkingState | undefined;
}
