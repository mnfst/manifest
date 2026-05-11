/**
 * Provider-by-provider default for the OpenAI-compat `thinking.type` field.
 *
 * The popup needs to know what the upstream provider does *without* an
 * override so it can (a) show the user the real baseline and (b) collapse
 * a chosen value back to `null` when the user lands on the same state as
 * the effective default. The snapshot writer uses the same registry to
 * record provider-natural defaults on per-message telemetry.
 *
 * Add a provider here only when its API actually consumes `thinking.type`
 * in chat-completions. Anthropic / Gemini have their own thinking shapes
 * and don't belong on this surface.
 */
export type ThinkingState = 'enabled' | 'disabled';

export const PROVIDER_THINKING_DEFAULTS: Record<string, ThinkingState> = {
  deepseek: 'enabled',
};

export function providerThinkingDefault(providerId: string | undefined): ThinkingState | undefined {
  if (!providerId) return undefined;
  return PROVIDER_THINKING_DEFAULTS[providerId.toLowerCase()];
}
