/**
 * Maps between frontend provider IDs and pricing-DB provider names.
 * E.g. the user connects "gemini" but pricing rows use "Google".
 */
const ALIASES: Record<string, string[]> = {
  gemini: ['google'],
  google: ['gemini'],
  qwen: ['alibaba'],
  alibaba: ['qwen'],
  moonshot: ['moonshot'],
  xai: ['xai'],
  ollama: ['ollama'],
};

/** Expand a set of provider names to include known aliases. */
export function expandProviderNames(names: Iterable<string>): Set<string> {
  const expanded = new Set<string>();
  for (const name of names) {
    const lower = name.toLowerCase();
    expanded.add(lower);
    for (const alias of ALIASES[lower] ?? []) {
      expanded.add(alias);
    }
  }
  return expanded;
}
