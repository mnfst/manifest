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
  [/^mimo-v/i, 'xiaomi'],
  [/^glm-/, 'zai'],
  [/^qwen[23]|^qwq-/, 'qwen'],
  [/^copilot\//, 'copilot'],
  [/^commandcode\//, 'commandcode'],
  [/^opencode-go\//, 'opencode-go'],
  [/^opencode-zen\//, 'opencode-zen'],
  [/^kiro\//, 'kiro'],
  [/^llamacpp\//, 'llamacpp'],
  [/^gitlawb\//, 'gitlawb'],
  [/^[a-z][\w-]*\//, 'openrouter'],
];

export { MODEL_PREFIX_MAP };

/**
 * Gateway model-id prefixes. A gateway transparently proxies another
 * provider's API, so the id after the prefix is the underlying provider's
 * own model id (e.g. `opencode-go/deepseek-v4-pro` -> `deepseek-v4-pro`).
 */
const GATEWAY_MODEL_PREFIXES = ['opencode-go/', 'opencode-zen/', 'gitlawb/'] as const;

/**
 * If `model` is a gateway model id, return the underlying provider's model
 * id; otherwise return `null`. Used to resolve gateway models to the
 * provenance provider whose parameters and capabilities they inherit.
 */
export function underlyingGatewayModel(model: string): string | null {
  for (const prefix of GATEWAY_MODEL_PREFIXES) {
    if (model.startsWith(prefix)) return model.slice(prefix.length);
  }
  return null;
}

export function inferProviderFromModel(model: string): string | undefined {
  if (model.startsWith('custom:')) return 'custom';
  if (!model.includes('/') && /:/.test(model) && !model.endsWith(':free')) return 'ollama';
  const lower = model.toLowerCase();
  for (const [re, id] of MODEL_PREFIX_MAP) {
    if (re.test(lower)) return id;
  }
  return undefined;
}

/**
 * Resolve a `(provider, model)` pair to the underlying provider and model that
 * own its metadata, transparently unwrapping gateway transports. For a gateway
 * model id (e.g. `opencode-go/glm-5.1`) this returns the provenance provider
 * inferred from the underlying id and that bare id
 * (`{ provider: 'zai', model: 'glm-5.1' }`); non-gateway pairs are returned
 * unchanged. The provider is `undefined` when the underlying id matches no
 * known provider, so callers decide whether to fall back. Capability and
 * parameter lookups route through this so any gateway model inherits the
 * underlying model's metadata, not just OpenCode Go's.
 */
export function resolveUnderlyingModelIdentity(
  provider: string | undefined,
  model: string,
): { provider: string | undefined; model: string } {
  const underlying = underlyingGatewayModel(model);
  if (underlying === null) return { provider, model };
  return { provider: inferProviderFromModel(underlying), model: underlying };
}
