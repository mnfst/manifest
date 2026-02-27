import { PROVIDERS } from "./providers.js";

/** Format per-million token price: $0.15 */
export function pricePerM(perToken: number): string {
  const perM = Number(perToken) * 1_000_000;
  if (perM === 0) return "Free";
  if (perM < 0.01) return "$0.00";
  return `$${perM.toFixed(2)}`;
}

/** Map DB provider names to frontend provider IDs */
const PROVIDER_ALIASES: Record<string, string> = {
  google: "gemini",
  alibaba: "qwen",
  moonshot: "moonshot",
  meta: "meta",
  cohere: "cohere",
  ollama: "ollama",
  openrouter: "openrouter",
};

export function resolveProviderId(dbProvider: string): string | undefined {
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
  [/^openrouter\//, "openrouter"],
  [/^claude-/, "anthropic"],
  [/^gpt-|^o[134]-|^o[134] |^chatgpt-/, "openai"],
  [/^gemini-/, "gemini"],
  [/^deepseek-/, "deepseek"],
  [/^grok-/, "xai"],
  [/^mistral-|^codestral|^pixtral|^open-mistral/, "mistral"],
  [/^kimi-|^moonshot-/, "moonshot"],
  [/^qwen[23]|^qwq-/, "qwen"],
  [/^[a-z][\w-]*\//, "openrouter"],
];

export function inferProviderFromModel(model: string): string | undefined {
  // Ollama convention: models contain a colon tag like `:0.5b`, `:latest`
  if (/:/.test(model)) return "ollama";
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
