/**
 * Infer a provider ID from a model name string.
 * Mirrors the frontend logic in services/routing-utils.ts.
 */
const INTERNAL_PROVIDER_PREFIX_MAP: [RegExp, string][] = [
  [/^opencode-go\//, 'opencode-go'],
  [/^ollama-cloud\//, 'ollama-cloud'],
];

const MODEL_PREFIX_MAP: [RegExp, string][] = [
  [/^openrouter\//, 'openrouter'],
  [/^claude-/, 'anthropic'],
  [/^gpt-|^o[134]-|^o[134] |^chatgpt-/, 'openai'],
  [/^gemini-/, 'gemini'],
  [/^deepseek-/, 'deepseek'],
  [/^grok-/, 'xai'],
  [/^mistral-|^codestral|^pixtral|^open-mistral/, 'mistral'],
  [/^kimi-|^moonshot-/, 'moonshot'],
  [/^minimax-/i, 'minimax'],
  [/^glm-/, 'zai'],
  [/^qwen[23]|^qwq-/, 'qwen'],
  [/^[a-z][\w-]*\//, 'openrouter'],
];

export function inferProviderFromModel(model: string): string | undefined {
  if (model.startsWith('custom:')) return 'custom';
  const lower = model.toLowerCase();
  for (const [re, id] of INTERNAL_PROVIDER_PREFIX_MAP) {
    if (re.test(lower)) return id;
  }
  if (/:/.test(model) && !model.endsWith(':free')) return 'ollama';
  for (const [re, id] of MODEL_PREFIX_MAP) {
    if (re.test(lower)) return id;
  }
  return undefined;
}
