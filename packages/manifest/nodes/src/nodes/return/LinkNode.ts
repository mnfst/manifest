import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';
import type { JSONSchema, LinkNodeParameters } from '@manifest/shared';

/**
 * Normalizes a URL by ensuring it has a protocol.
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('URL is required');
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Validates that a URL is well-formed.
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves template variables in a string.
 * Template syntax: {{nodeSlug.path}}
 */
async function resolveTemplate(
  template: string,
  getNodeValue: (nodeId: string) => Promise<unknown>
): Promise<string> {
  const templatePattern = /\{\{([^}]+)\}\}/g;
  const matches = [...template.matchAll(templatePattern)];

  if (matches.length === 0) {
    return template;
  }

  let result = template;
  for (const match of matches) {
    const fullMatch = match[0];
    const path = match[1].trim();
    const [nodeId, ...pathParts] = path.split('.');

    try {
      let value = await getNodeValue(nodeId);
      for (const part of pathParts) {
        if (value && typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      result = result.replace(fullMatch, String(value ?? ''));
    } catch {
      result = result.replace(fullMatch, '');
    }
  }

  return result;
}

/**
 * Link Node
 *
 * Opens an external URL in the user's browser using ChatGPT's openExternal API.
 * This is a terminal node - it terminates the flow successfully.
 *
 * CONSTRAINT: Can only be placed after UI/interface category nodes.
 */
export const LinkNode: NodeTypeDefinition = {
  name: 'Link',
  displayName: 'Open Link',
  icon: 'external-link',
  group: ['flow', 'output'],
  category: 'return',
  description: "Open an external URL in the user's browser. Terminates the flow.",

  inputs: ['main'],
  outputs: [], // Terminal node - no downstream connections

  defaultParameters: {
    href: '',
  } satisfies LinkNodeParameters,

  inputSchema: {
    type: 'object',
    additionalProperties: true,
    description: 'Data available for template variable resolution in URL',
  } as JSONSchema,

  outputSchema: null, // Terminal nodes have no output schema

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters, getNodeValue } = context;
    const rawHref = (parameters.href as string) || '';

    // Validate href is provided
    if (!rawHref.trim()) {
      return {
        success: false,
        error: 'URL is required for Link node',
        output: {
          type: 'link',
          href: '',
          error: 'URL is required',
        },
      };
    }

    try {
      // Resolve template variables
      const resolvedHref = await resolveTemplate(rawHref, getNodeValue);

      // Normalize URL (add https:// if missing)
      const normalizedHref = normalizeUrl(resolvedHref);

      // Validate URL format
      if (!isValidUrl(normalizedHref)) {
        return {
          success: false,
          error: `Invalid URL: ${normalizedHref}`,
          output: {
            type: 'link',
            href: normalizedHref,
            error: 'Invalid URL format',
          },
        };
      }

      // Return link action for frontend/MCP to execute
      return {
        success: true,
        output: {
          type: 'link',
          href: normalizedHref,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: `Link node failed: ${message}`,
        output: {
          type: 'link',
          href: rawHref,
          error: message,
        },
      };
    }
  },
};
