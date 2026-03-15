import { PROVIDERS } from './providers.js';

/** Format per-million token price: $0.15 */
export function pricePerM(perToken: number | null | undefined): string {
  if (perToken == null) return '\u2014';
  const perM = Number(perToken) * 1_000_000;
  if (perM === 0) return 'Free';
  if (perM < 0.01) return '< $0.01';
  if (perM < 1) return `$${perM.toFixed(3)}`;
  return `$${perM.toFixed(2)}`;
}

/** Map DB provider names to frontend provider IDs */
const PROVIDER_ALIASES: Record<string, string> = {
  google: 'gemini',
  alibaba: 'qwen',
  moonshot: 'moonshot',
  kimi: 'moonshot',
  meta: 'meta',
  cohere: 'cohere',
  ollama: 'ollama',
  openrouter: 'openrouter',
};

export function resolveProviderId(dbProvider: string): string | undefined {
  // Custom providers use their own key as-is
  if (dbProvider.startsWith('custom:')) return dbProvider;

  const key = dbProvider.toLowerCase();
  const alias = PROVIDER_ALIASES[key];
  return PROVIDERS.find((p) => p.id === key || p.id === alias || p.name.toLowerCase() === key)?.id;
}

/**
 * Infer a provider ID from a model name string.
 * Ollama models use the `name:tag` convention (e.g. `qwen2.5:0.5b`).
 * Cloud models have recognizable prefixes.
 */
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
  // Custom provider models use the custom:<uuid>/model format
  if (model.startsWith('custom:')) return 'custom';
  // Ollama convention: models contain a colon tag like `:0.5b`, `:latest`
  // Exception: OpenRouter `:free` suffix is not Ollama
  if (/:/.test(model) && !model.endsWith(':free')) return 'ollama';
  const lower = model.toLowerCase();
  for (const [re, id] of MODEL_PREFIX_MAP) {
    if (re.test(lower)) return id;
  }
  return undefined;
}

/** Resolve a display name for the inferred provider. */
export function inferProviderName(model: string): string | undefined {
  const id = inferProviderFromModel(model);
  if (!id) return undefined;
  return PROVIDERS.find((p) => p.id === id)?.name;
}

/**
 * Strip the internal `custom:<uuid>/` prefix from a model name.
 * Returns the raw model name (e.g. "openai/gpt-oss-120b").
 */
export function stripCustomPrefix(model: string): string {
  const match = model.match(/^custom:[^/]+\/(.+)$/);
  return match?.[1] ?? model;
}
