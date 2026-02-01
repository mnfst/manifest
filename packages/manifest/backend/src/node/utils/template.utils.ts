import type { NodeInstance, ApiCallNodeParameters, HeaderEntry } from '@manifest/shared';

/**
 * Migrates template references from ID-based ({{ nodeId.path }}) to
 * slug-based ({{ nodeSlug.path }}) format.
 */
export function migrateTemplateReferences(
  template: string,
  idToSlug: Map<string, string>
): string {
  if (!template) return template;

  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, pathStr) => {
    const parts = pathStr.trim().split('.');
    const idOrSlug = parts[0];
    const slug = idToSlug.get(idOrSlug);
    if (slug) {
      parts[0] = slug;
      return `{{ ${parts.join('.')} }}`;
    }
    return match;
  });
}

/**
 * Updates slug references across all nodes when a node's slug changes.
 * Modifies nodes in-place.
 */
export function updateSlugReferences(
  nodes: NodeInstance[],
  oldSlug: string,
  newSlug: string
): void {
  const pattern = new RegExp(
    `\\{\\{\\s*${oldSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.[^}\\s]*)?\\s*\\}\\}`,
    'g'
  );

  for (const n of nodes) {
    if (!n.parameters) continue;
    const params = n.parameters as unknown as ApiCallNodeParameters;

    // Update URL templates
    if (typeof params.url === 'string' && params.url.includes(oldSlug)) {
      params.url = params.url.replace(pattern, (_match, rest) => {
        return `{{ ${newSlug}${rest || ''} }}`;
      });
    }

    // Update header value templates
    if (Array.isArray(params.headers)) {
      for (const header of params.headers as HeaderEntry[]) {
        if (typeof header.value === 'string' && header.value.includes(oldSlug)) {
          header.value = header.value.replace(pattern, (_match, rest) => {
            return `{{ ${newSlug}${rest || ''} }}`;
          });
        }
      }
    }
  }
}
