import { buildAnthropicShortModelIdVariants } from '../common/utils/anthropic-model-id';
import { OPENROUTER_PREFIX_TO_PROVIDER } from '../common/constants/providers';

/**
 * Resolves variant model names (from ingested messages) to canonical pricing names.
 *
 * Strategies (tried in order):
 *  1. Exact match against canonical names
 *  2. Known alias lookup (e.g. "deepseek-v3" → "deepseek-chat")
 *  3. Strip provider prefix (e.g. "anthropic/claude-opus-4-6" → "claude-opus-4-6")
 *  4. Strip date suffix (e.g. "gpt-4.1-2025-04-14" → "gpt-4.1")
 *  5. Strip both prefix and date suffix
 *  6. Strip Google variant suffix (e.g. "gemini-2.5-pro-preview-03-25" → "gemini-2.5-pro")
 *  7. Dot-to-dash normalization (e.g. "claude-opus-4.6" → "claude-opus-4-6")
 *  8. Dot-to-dash + strip date suffix
 */

const KNOWN_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['claude-opus-4', 'claude-opus-4-6'],
  ['claude-sonnet-4.5', 'claude-sonnet-4-5-20250929'],
  ['claude-sonnet-4-5', 'claude-sonnet-4-5-20250929'],
  ['claude-opus-4-5', 'claude-opus-4-5-20251101'],
  ['claude-opus-4-1', 'claude-opus-4-1-20250805'],
  ['claude-sonnet-4-0', 'claude-sonnet-4-20250514'],
  ['claude-opus-4-0', 'claude-opus-4-20250514'],
  ['claude-sonnet-4', 'claude-sonnet-4-20250514'],
  ['claude-haiku-4.5', 'claude-haiku-4-5-20251001'],
  ['claude-haiku-4-5', 'claude-haiku-4-5-20251001'],
  ['deepseek-v3', 'deepseek-chat'],
  ['deepseek-chat-v3-0324', 'deepseek-chat'],
  ['deepseek-r1', 'deepseek-reasoner'],
  // MiniMax mixed-case aliases
  ['MiniMax-M2.7', 'minimax-m2.7'],
  ['MiniMax-M2.7-highspeed', 'minimax-m2.7-highspeed'],
  ['MiniMax-M2.5', 'minimax-m2.5'],
  ['MiniMax-M2.5-highspeed', 'minimax-m2.5-highspeed'],
  ['MiniMax-M2.1', 'minimax-m2.1'],
  ['MiniMax-M2.1-highspeed', 'minimax-m2.1-highspeed'],
  ['MiniMax-M2', 'minimax-m2'],
  ['MiniMax-M1', 'minimax-m1'],
  // Mistral version aliases
  ['mistral-large', 'mistral-large-latest'],
  ['codestral', 'codestral-latest'],
];

// Extra prefixes from non-routing providers that ingested messages may contain.
// Multi-segment prefixes must come first so they match before shorter ones.
const EXTRA_INGEST_PREFIXES = ['accounts/fireworks/models/', 'amazon/', 'fireworks/', 'together/'];

/** Derived from the provider registry + extra ingest prefixes. */
const PROVIDER_PREFIXES: readonly string[] = [
  ...EXTRA_INGEST_PREFIXES,
  ...[...OPENROUTER_PREFIX_TO_PROVIDER.keys()].map((p) => `${p}/`),
];

const DATE_SUFFIX_RE = /-\d{4}-?\d{2}-?\d{2}$/;
const VERSION_SUFFIX_RE = /-\d{3}$/;

/** Matches Google-style variant suffixes: -preview-MM-DD, -preview-YYYY-MM-DD, -exp-MMDD, -latest */
export const GOOGLE_VARIANT_RE = /-(?:preview(?:-\d{2,4}){1,3}|exp-\d{4}|latest)$/;

export function stripGoogleVariant(name: string): string {
  return name.replace(GOOGLE_VARIANT_RE, '');
}

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

export function buildAliasMap(canonicalNames: ReadonlyArray<string>): Map<string, string> {
  const map = new Map<string, string>();

  for (const name of canonicalNames) {
    map.set(name, name);
    for (const variant of buildAnthropicShortModelIdVariants(name)) {
      if (!map.has(variant)) {
        map.set(variant, name);
      }
    }

    // Also index by bare name (e.g. "claude-sonnet-4" → "anthropic/claude-sonnet-4")
    const bare = stripProviderPrefix(name);
    if (bare !== name && !map.has(bare)) {
      map.set(bare, name);
    }
    // Index by bare name without version suffix (e.g. "gemini-2.0-flash-001" → "gemini-2.0-flash")
    const bareNoVersion = bare.replace(VERSION_SUFFIX_RE, '');
    if (bareNoVersion !== bare && !map.has(bareNoVersion)) {
      map.set(bareNoVersion, name);
    }
    // Index by bare name without Google variant suffix
    // (e.g. "gemini-2.5-pro-preview-03-25" → "gemini-2.5-pro")
    const bareNoVariant = stripGoogleVariant(bare);
    if (bareNoVariant !== bare && !map.has(bareNoVariant)) {
      map.set(bareNoVariant, name);
    }
    for (const variant of buildAnthropicShortModelIdVariants(bare)) {
      if (!map.has(variant)) {
        map.set(variant, name);
      }
    }
  }

  for (const [alias, canonical] of KNOWN_ALIASES) {
    // Skip if the alias already resolves to a canonical pricing name (e.g. from bare-name indexing)
    if (map.has(alias)) continue;
    // If the canonical target exists in the map, use its resolved value
    const resolved = map.get(canonical) ?? canonical;
    map.set(alias, resolved);
  }

  return map;
}

export function normalizeDots(name: string): string {
  return name.replace(/\./g, '-');
}

export function resolveModelName(name: string, aliasMap: Map<string, string>): string | undefined {
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

  const noVariant = stripGoogleVariant(stripped);
  if (noVariant !== stripped) {
    const fromNoVariant = aliasMap.get(noVariant);
    if (fromNoVariant) return fromNoVariant;
  }

  const dotNorm = normalizeDots(stripped);
  if (dotNorm !== stripped) {
    const fromDotNorm = aliasMap.get(dotNorm);
    if (fromDotNorm) return fromDotNorm;

    const dotNormNoDate = stripDateSuffix(dotNorm);
    if (dotNormNoDate !== dotNorm) {
      const fromDotNormNoDate = aliasMap.get(dotNormNoDate);
      if (fromDotNormNoDate) return fromDotNormNoDate;
    }
  }

  return undefined;
}
