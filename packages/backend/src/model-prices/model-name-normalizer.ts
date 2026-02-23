/**
 * Resolves variant model names (from telemetry) to canonical pricing names.
 *
 * Strategies (tried in order):
 *  1. Exact match against canonical names
 *  2. Known alias lookup (e.g. "deepseek-chat" → "deepseek-v3")
 *  3. Strip provider prefix (e.g. "anthropic/claude-opus-4-6" → "claude-opus-4-6")
 *  4. Strip date suffix (e.g. "gpt-4.1-2025-04-14" → "gpt-4.1")
 *  5. Strip both prefix and date suffix
 */

const KNOWN_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['claude-opus-4', 'claude-opus-4-6'],
  ['claude-sonnet-4.5', 'claude-sonnet-4-5-20250929'],
  ['claude-sonnet-4', 'claude-sonnet-4-20250514'],
  ['claude-haiku-4.5', 'claude-haiku-4-5-20251001'],
  ['deepseek-chat', 'deepseek-v3'],
  ['deepseek-chat-v3-0324', 'deepseek-v3'],
  ['deepseek-reasoner', 'deepseek-r1'],
];

const PROVIDER_PREFIXES = [
  'anthropic/',
  'openai/',
  'google/',
  'deepseek/',
  'mistralai/',
  'moonshotai/',
  'qwen/',
  'zhipuai/',
  'amazon/',
  'xai/',
  'accounts/fireworks/models/',
  'fireworks/',
  'together/',
];

const DATE_SUFFIX_RE = /-\d{4}-\d{2}-\d{2}$/;

export function stripProviderPrefix(name: string): string {
  for (const prefix of PROVIDER_PREFIXES) {
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
  }
  return name;
}

export function stripDateSuffix(name: string): string {
  return name.replace(DATE_SUFFIX_RE, '');
}

export function buildAliasMap(
  canonicalNames: ReadonlyArray<string>,
): Map<string, string> {
  const map = new Map<string, string>();

  for (const name of canonicalNames) {
    map.set(name, name);
  }

  for (const [alias, canonical] of KNOWN_ALIASES) {
    map.set(alias, canonical);
  }

  return map;
}

export function resolveModelName(
  name: string,
  aliasMap: Map<string, string>,
): string | undefined {
  const exact = aliasMap.get(name);
  if (exact) return exact;

  const stripped = stripProviderPrefix(name);
  const fromStripped = aliasMap.get(stripped);
  if (fromStripped) return fromStripped;

  const noDate = stripDateSuffix(stripped);
  if (noDate !== stripped) {
    const fromNoDate = aliasMap.get(noDate);
    if (fromNoDate) return fromNoDate;
  }

  return undefined;
}
