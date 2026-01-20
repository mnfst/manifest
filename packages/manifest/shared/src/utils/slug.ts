/**
 * Slug utilities for generating and validating human-readable node identifiers.
 */

/**
 * Reserved slugs that cannot be used for nodes.
 */
export const RESERVED_SLUGS = [
  'flow',
  'trigger',
  'output',
  'input',
  'node',
  'connection',
] as const;

/**
 * Converts a string to a valid slug format.
 * - Converts to lowercase
 * - Replaces spaces and special characters with underscores
 * - Removes consecutive underscores
 * - Ensures it starts with a letter
 *
 * @param input - The string to convert
 * @returns A valid slug string
 */
export function toSlug(input: string): string {
  if (!input || input.trim() === '') {
    return 'node';
  }

  let slug = input
    .toLowerCase()
    .trim()
    // Replace spaces and common separators with underscores
    .replace(/[\s\-.]+/g, '_')
    // Remove any character that's not alphanumeric or underscore
    .replace(/[^a-z0-9_]/g, '')
    // Replace multiple underscores with single underscore
    .replace(/_+/g, '_');

  // Remove leading/trailing underscores using string methods (avoids ReDoS)
  while (slug.startsWith('_')) slug = slug.slice(1);
  while (slug.endsWith('_')) slug = slug.slice(0, -1);

  // Ensure it starts with a letter
  if (!slug || !/^[a-z]/.test(slug)) {
    slug = 'node_' + slug;
  }

  // Truncate to max 50 characters
  if (slug.length > 50) {
    slug = slug.substring(0, 50).replace(/_+$/, '');
  }

  return slug;
}

/**
 * Validates if a string is a valid slug.
 * Valid slugs:
 * - Start with a lowercase letter
 * - Contain only lowercase letters, numbers, and underscores
 * - Are 1-50 characters long
 * - Are not reserved
 *
 * @param slug - The slug to validate
 * @returns True if the slug is valid
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0 || slug.length > 50) {
    return false;
  }

  // Must match pattern: starts with letter, followed by letters/numbers/underscores
  const slugPattern = /^[a-z][a-z0-9_]*$/;
  if (!slugPattern.test(slug)) {
    return false;
  }

  // Must not be reserved
  if (RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number])) {
    return false;
  }

  return true;
}

/**
 * Generates a unique slug within a set of existing slugs.
 * If the base slug already exists, appends _2, _3, etc.
 *
 * @param baseName - The name to generate a slug from
 * @param existingSlugs - Set or array of existing slugs in the flow
 * @returns A unique slug
 */
export function generateUniqueSlug(
  baseName: string,
  existingSlugs: Set<string> | string[]
): string {
  const slugSet =
    existingSlugs instanceof Set ? existingSlugs : new Set(existingSlugs);

  let baseSlug = toSlug(baseName);

  // Handle reserved slugs
  if (RESERVED_SLUGS.includes(baseSlug as (typeof RESERVED_SLUGS)[number])) {
    baseSlug = baseSlug + '_node';
  }

  // If base slug doesn't exist, return it
  if (!slugSet.has(baseSlug)) {
    return baseSlug;
  }

  // Find the next available suffix
  let suffix = 2;
  while (slugSet.has(`${baseSlug}_${suffix}`)) {
    suffix++;
  }

  return `${baseSlug}_${suffix}`;
}

/**
 * Extracts the base slug (without numeric suffix) from a slug.
 * E.g., "api_call_3" -> "api_call"
 *
 * @param slug - The slug to extract base from
 * @returns The base slug without numeric suffix
 */
export function getBaseSlug(slug: string): string {
  // Match pattern: base_N where N is a number
  const match = slug.match(/^(.+)_(\d+)$/);
  if (match) {
    return match[1];
  }
  return slug;
}
