export const DEFAULT_HOSTED_AUTOFIX_URL = 'https://autofix.manifest.build';

/**
 * Resolve only real HTTP healers. Dev/test keeps using the in-process mock when
 * the URL is unset; cloud production keeps its inert default.
 */
export function resolveHttpHealingUrl(
  rawUrl: string | undefined,
  nodeEnv: string | undefined,
  selfHosted: boolean,
): string | undefined {
  const value = rawUrl?.trim();
  if (value?.toLowerCase() === 'off') return undefined;
  if (value) return value;
  if (nodeEnv === 'production' && selfHosted) return DEFAULT_HOSTED_AUTOFIX_URL;
  return undefined;
}
