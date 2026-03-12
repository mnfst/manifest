/**
 * Maps between frontend provider IDs and pricing-DB provider names.
 * E.g. the user connects "gemini" but pricing rows use "Google".
 */
const ALIASES: Record<string, string[]> = {
  gemini: ['google'],
  google: ['gemini'],
  qwen: ['alibaba'],
  alibaba: ['qwen'],
  copilot: ['copilot'],
  moonshot: ['moonshot', 'kimi'],
  kimi: ['moonshot'],
  minimax: ['minimax'],
  zai: ['zai', 'z.ai'],
  'z.ai': ['zai'],
  xai: ['xai'],
  ollama: ['ollama'],
};

/**
 * Extract the provider from a model's vendor prefix.
 * E.g. "anthropic/claude-sonnet-4" → "anthropic", "gpt-4o" → undefined.
 */
export function inferProviderFromModelName(
  modelName: string | undefined | null,
): string | undefined {
  if (!modelName) return undefined;
  const slashIdx = modelName.indexOf('/');
  return slashIdx > 0 ? modelName.substring(0, slashIdx).toLowerCase() : undefined;
}

/** Expand a set of provider names to include known aliases. */
export function expandProviderNames(names: Iterable<string>): Set<string> {
  const expanded = new Set<string>();
  for (const name of names) {
    const lower = name.toLowerCase();
    expanded.add(lower);
    // Custom providers use exact keys — no alias expansion
    if (lower.startsWith('custom:')) continue;
    for (const alias of ALIASES[lower] ?? []) {
      expanded.add(alias);
    }
  }
  return expanded;
}
