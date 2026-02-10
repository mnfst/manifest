import { sanitizeMockValue } from './value-sanitizer.utils';

/**
 * Navigates a dot-separated path on an object to retrieve a nested value.
 * Returns undefined if any segment is missing.
 */
function resolvePathValue(
  root: unknown,
  parts: string[]
): unknown {
  let value = root;
  for (let i = 1; i < parts.length && value != null; i++) {
    if (typeof value === 'object' && value !== null) {
      value = (value as Record<string, unknown>)[parts[i]];
    } else {
      return undefined;
    }
  }
  return value;
}

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

/**
 * Determines whether a regex match position is inside a JSON string
 * (between unescaped double quotes).
 */
function isInsideJsonString(text: string, matchStart: number): boolean {
  let insideString = false;
  for (let i = 0; i < matchStart; i++) {
    if (text[i] === '"' && (i === 0 || text[i - 1] !== '\\')) {
      insideString = !insideString;
    }
  }
  return insideString;
}

/**
 * Resolves template variables in a JSON body string with type preservation.
 *
 * - Bare template variables (outside quotes) resolve to their JSON-serialized type
 *   (number, boolean, object, array, string, null).
 * - String-embedded template variables (inside quotes) resolve via string interpolation.
 *
 * @param body - Raw body string with {{ }} template variables
 * @param mockValues - Key-value map of node outputs for resolution
 * @returns Object with resolved body string and array of unresolved variable names
 */
export function resolveBodyTemplateVariables(
  body: string,
  mockValues?: Record<string, unknown>
): { resolved: string; unresolvedVars: string[] } {
  const unresolvedVars: string[] = [];
  const pattern = /\{\{([^{}]+)\}\}/g;

  // Process replacements in reverse order to preserve indices
  const matches = [...body.matchAll(pattern)];
  let result = body;

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const varPath = match[1].trim();
    const parts = varPath.split('.');
    const rootKey = parts[0];
    const matchStart = match.index!;
    const matchEnd = matchStart + match[0].length;

    if (!mockValues || !(rootKey in mockValues)) {
      unresolvedVars.push(varPath);
      continue;
    }

    const value = resolvePathValue(mockValues[rootKey], parts);

    if (value === undefined) {
      unresolvedVars.push(varPath);
      continue;
    }

    const inString = isInsideJsonString(body, matchStart);
    const replacement = inString
      ? String(value ?? '')
      : JSON.stringify(value ?? null);

    result = result.slice(0, matchStart) + replacement + result.slice(matchEnd);
  }

  return { resolved: result, unresolvedVars };
}
