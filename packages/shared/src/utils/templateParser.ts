/**
 * Template parser utilities for extracting variable references from template strings.
 * Template format: {{ nodeSlug.fieldPath }}
 */

/**
 * Represents a parsed template variable reference.
 */
export interface TemplateReference {
  /** The full reference string (e.g., "trigger.city") */
  fullPath: string;
  /** The node slug (e.g., "trigger") */
  nodeSlug: string;
  /** The field path within the node's output (e.g., "city" or "data.items") */
  fieldPath: string;
}

/**
 * Regular expression to match template variables.
 * Matches: {{ nodeSlug.fieldPath }} or {{nodeSlug.fieldPath}}
 * Allows for optional whitespace around the content.
 */
const TEMPLATE_REGEX = /\{\{\s*([a-z][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)+)\s*\}\}/gi;

/**
 * Parses a string and extracts all template variable references.
 *
 * @param input - The string to parse for template references
 * @returns Array of parsed template references
 *
 * @example
 * parseTemplateReferences("Hello {{ trigger.city }}, temp is {{ api_call.data.temperature }}")
 * // Returns:
 * // [
 * //   { fullPath: "trigger.city", nodeSlug: "trigger", fieldPath: "city" },
 * //   { fullPath: "api_call.data.temperature", nodeSlug: "api_call", fieldPath: "data.temperature" }
 * // ]
 */
export function parseTemplateReferences(input: string): TemplateReference[] {
  if (!input || typeof input !== 'string') {
    return [];
  }

  const references: TemplateReference[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  // Reset regex lastIndex for safety
  TEMPLATE_REGEX.lastIndex = 0;

  while ((match = TEMPLATE_REGEX.exec(input)) !== null) {
    const fullPath = match[1].toLowerCase();

    // Skip duplicates
    if (seen.has(fullPath)) {
      continue;
    }
    seen.add(fullPath);

    // Split into nodeSlug and fieldPath
    const dotIndex = fullPath.indexOf('.');
    if (dotIndex === -1) {
      // No dot found - invalid reference (should have at least nodeSlug.field)
      continue;
    }

    const nodeSlug = fullPath.substring(0, dotIndex);
    const fieldPath = fullPath.substring(dotIndex + 1);

    if (!nodeSlug || !fieldPath) {
      continue;
    }

    references.push({
      fullPath,
      nodeSlug,
      fieldPath,
    });
  }

  return references;
}

/**
 * Groups template references by their source node slug.
 *
 * @param references - Array of template references
 * @returns Map of nodeSlug to array of field paths
 *
 * @example
 * groupReferencesByNode([
 *   { fullPath: "trigger.city", nodeSlug: "trigger", fieldPath: "city" },
 *   { fullPath: "trigger.country", nodeSlug: "trigger", fieldPath: "country" },
 *   { fullPath: "api_call.data", nodeSlug: "api_call", fieldPath: "data" },
 * ])
 * // Returns: Map { "trigger" => ["city", "country"], "api_call" => ["data"] }
 */
export function groupReferencesByNode(
  references: TemplateReference[]
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const ref of references) {
    const existing = grouped.get(ref.nodeSlug) || [];
    if (!existing.includes(ref.fieldPath)) {
      existing.push(ref.fieldPath);
    }
    grouped.set(ref.nodeSlug, existing);
  }

  return grouped;
}

/**
 * Extracts all unique node slugs referenced in template variables.
 *
 * @param input - The string to parse
 * @returns Array of unique node slugs
 */
export function getReferencedNodeSlugs(input: string): string[] {
  const references = parseTemplateReferences(input);
  const slugs = new Set(references.map(r => r.nodeSlug));
  return Array.from(slugs);
}

/**
 * Extracts all template references from an object recursively.
 * Searches through all string values in the object.
 *
 * @param obj - The object to search
 * @returns Array of all template references found
 */
export function extractAllReferences(obj: unknown): TemplateReference[] {
  const allReferences: TemplateReference[] = [];
  const seen = new Set<string>();

  function traverse(value: unknown): void {
    if (typeof value === 'string') {
      const refs = parseTemplateReferences(value);
      for (const ref of refs) {
        if (!seen.has(ref.fullPath)) {
          seen.add(ref.fullPath);
          allReferences.push(ref);
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        traverse(item);
      }
    } else if (value !== null && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        traverse((value as Record<string, unknown>)[key]);
      }
    }
  }

  traverse(obj);
  return allReferences;
}

/**
 * Validates that all referenced nodes exist in the provided slug map.
 *
 * @param references - Array of template references to validate
 * @param validSlugs - Set of valid node slugs
 * @returns Array of invalid node slugs that were referenced
 */
export function validateNodeReferences(
  references: TemplateReference[],
  validSlugs: Set<string>
): string[] {
  const invalidSlugs: string[] = [];
  const checked = new Set<string>();

  for (const ref of references) {
    if (checked.has(ref.nodeSlug)) continue;
    checked.add(ref.nodeSlug);

    if (!validSlugs.has(ref.nodeSlug)) {
      invalidSlugs.push(ref.nodeSlug);
    }
  }

  return invalidSlugs;
}
