const ALLOWED_ALIAS_CHARS = /[^a-z0-9.\-@:]/g;

/** Model alias derived from a custom tier display name (kebab-ish, permissive charset). */
export function headerTierNameToModelAlias(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(ALLOWED_ALIAS_CHARS, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** True when a string is safe to use as a custom tier `model` alias (blocks `/` only). */
export function isSafeHeaderTierModelAlias(alias: string): boolean {
  const normalized = alias.trim();
  return normalized.length > 0 && !normalized.includes('/');
}
