/**
 * Converts a display name to a valid snake_case tool name.
 * - Converts to lowercase
 * - Removes special characters (keeps alphanumeric only)
 * - Replaces spaces with underscores
 * - Collapses multiple underscores
 * - Trims leading/trailing underscores
 */
export function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Validates that a tool name is valid.
 * Must be non-empty and start with a letter, contain only lowercase letters, numbers, and underscores.
 */
export function isValidToolName(toolName: string): boolean {
  return toolName.length > 0 && /^[a-z][a-z0-9_]*$/.test(toolName);
}
