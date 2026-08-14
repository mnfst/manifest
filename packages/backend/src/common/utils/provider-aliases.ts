/**
 * Provider alias utilities for the routing system.
 *
 * expandProviderNames is re-exported from the provider registry SST
 * so existing importers don't need to change their import paths.
 */
export { expandProviderNames } from '../constants/providers';

/**
 * Extract the provider from a model's vendor prefix.
 * E.g. "anthropic/claude-sonnet-4" -> "anthropic", "gpt-4o" -> undefined.
 */
export function inferProviderFromModelName(
  modelName: string | undefined | null,
): string | undefined {
  if (!modelName) return undefined;
  const slashIdx = modelName.indexOf('/');
  return slashIdx > 0 ? modelName.substring(0, slashIdx).toLowerCase() : undefined;
}
