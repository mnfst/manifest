/**
 * Infer a provider ID from a model name string.
 * This is the unified superset of all regex patterns from backend and frontend.
 */
const MODEL_PREFIX_MAP: [RegExp, string][] = [
  [/^openrouter\//, 'openrouter'],
  [/^claude-/, 'anthropic'],
  [/^gpt-|^o[134]-|^o[134] |^chatgpt-/, 'openai'],
  [/^gemini-|^gemma-/, 'gemini'],
  [/^deepseek-/, 'deepseek'],
  [/^grok-/, 'xai'],
  [/^mistral-|^codestral|^pixtral|^open-mistral/, 'mistral'],
  [/^kimi-|^moonshot-/, 'moonshot'],
  [/^minimax-/i, 'minimax'],
  [/^glm-/, 'zai'],
  [/^qwen[23]|^qwq-/, 'qwen'],
  [/^copilot\//, 'copilot'],
  [/^opencode-go\//, 'opencode-go'],
  [/^llamacpp\//, 'llamacpp'],
  [/^[a-z][\w-]*\//, 'openrouter'],
];

export { MODEL_PREFIX_MAP };

export function inferProviderFromModel(model: string): string | undefined {
  if (model.startsWith('custom:')) return 'custom';
  if (!model.includes('/') && /:/.test(model) && !model.endsWith(':free')) return 'ollama';
  const lower = model.toLowerCase();
  for (const [re, id] of MODEL_PREFIX_MAP) {
    if (re.test(lower)) return id;
  }
  return undefined;
}
