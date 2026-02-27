/**
 * Converts a human-readable name into a URL-safe slug.
 *
 * trim → lowercase → spaces/underscores to hyphens → remove invalid chars
 * → collapse consecutive hyphens → strip leading/trailing hyphens.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
