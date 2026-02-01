import { sanitizeMockValue } from './value-sanitizer.utils';

/**
 * Resolve template variables in a string using mock values.
 * Returns the resolved string and list of unresolved variable names.
 * All mock values are sanitized to prevent SSRF through URL injection.
 */
export function resolveTemplateVariables(
  template: string,
  mockValues?: Record<string, unknown>
): { resolved: string; unresolvedVars: string[] } {
  const unresolvedVars: string[] = [];

  // Match {{nodeSlug.path.to.field}} or {{nodeSlug}}
  const resolved = template.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
    const parts = varPath.trim().split('.');
    const rootKey = parts[0];

    if (!mockValues || !(rootKey in mockValues)) {
      unresolvedVars.push(varPath);
      return match; // Keep original placeholder
    }

    // Navigate the path
    let value: unknown = mockValues[rootKey];
    for (let i = 1; i < parts.length && value != null; i++) {
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, unknown>)[parts[i]];
      } else {
        value = undefined;
      }
    }

    if (value === undefined || value === null) {
      unresolvedVars.push(varPath);
      return match;
    }

    // Sanitize the value to prevent SSRF through URL injection
    return sanitizeMockValue(value);
  });

  return { resolved, unresolvedVars };
}
