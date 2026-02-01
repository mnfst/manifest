import type { NodeInstance } from '@manifest/shared';

/**
 * Resolves template variables in a string using upstream node outputs.
 * Template syntax: {{ nodeSlug.path }} where path can be dot-notation like 'data.userId'
 * Supports both slug-based and ID-based lookups.
 *
 * @param template - String containing template variables
 * @param nodeOutputs - Map of nodeId to output data
 * @param allNodes - All nodes in the flow (for slug-to-id resolution)
 * @returns Resolved string with actual values
 */
export function resolveTemplateVariables(
  template: string,
  nodeOutputs: Map<string, unknown>,
  allNodes: NodeInstance[]
): string {
  if (!template) return template;

  // Build slug-to-id map
  const slugToId = new Map<string, string>();
  for (const node of allNodes) {
    if (node.slug) {
      slugToId.set(node.slug, node.id);
    }
  }

  const templatePattern = /\{\{\s*([^}]+)\s*\}\}/g;

  return template.replace(templatePattern, (_fullMatch, pathStr) => {
    const path = pathStr.trim();
    const parts = path.split('.');
    const slugOrId = parts[0];
    const pathParts = parts.slice(1);

    // Try slug first, then ID
    const nodeId = slugToId.get(slugOrId) || slugOrId;
    let value = nodeOutputs.get(nodeId);

    // Navigate nested path
    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }

    // Return the resolved value, or empty string if not found
    if (value === undefined || value === null) {
      return '';
    }
    // If it's an object or array, stringify it
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}
