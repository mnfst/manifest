/**
 * Converts a display name to a valid snake_case tool name.
 * - Inserts underscores before uppercase letters (CamelCase support)
 * - Replaces spaces and hyphens with underscores
 * - Removes other special characters
 * - Collapses multiple underscores
 * - Trims leading/trailing underscores
 */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^_/, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

/**
 * Validates that a tool name is valid.
 * Must be non-empty and start with a letter, contain only lowercase letters, numbers, and underscores.
 */
export function isValidToolName(toolName: string): boolean {
  return toolName.length > 0 && /^[a-z][a-z0-9_]*$/.test(toolName);
}
