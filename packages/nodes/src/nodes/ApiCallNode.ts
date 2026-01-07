import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../types.js';
import type { ApiCallNodeParameters, HeaderEntry, JSONSchema } from '@chatgpt-app-builder/shared';

/**
 * Output structure produced by the ApiCallNode.
 */
interface ApiCallOutput {
  /** Discriminator for output type */
  type: 'apiCall';
  /** true if request completed (even 4xx/5xx) */
  success: boolean;
  /** HTTP status code */
  status?: number;
  /** HTTP status text */
  statusText?: string;
  /** Response headers */
  headers?: Record<string, string>;
  /** Parsed response body (JSON or text) */
  body?: unknown;
  /** Error message when success=false */
  error?: string;
  /** Time taken for request in milliseconds */
  requestDuration: number;
}

/**
 * Resolves template variables in a string using upstream node outputs.
 * Template syntax: {{nodeId.path}} where path can be dot-notation like 'data.userId'
 *
 * @param template - String containing template variables
 * @param getNodeValue - Function to get upstream node outputs
 * @returns Resolved string with actual values
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

      // Navigate nested path
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
      // If node value not found, replace with empty string
      result = result.replace(fullMatch, '');
    }
  }

  return result;
}

/**
 * Converts HeaderEntry array to a Record for fetch API.
 */
function headersToRecord(headers: HeaderEntry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of headers) {
    if (header.key && header.key.trim()) {
      result[header.key.trim()] = header.value;
    }
  }
  return result;
}

/**
 * ApiCall Node
 *
 * Makes HTTP requests to external APIs and outputs the response.
 * Supports GET, POST, PUT, DELETE, and PATCH methods with configurable
 * headers and timeout. Can use template variables to dynamically construct
 * requests from upstream node outputs.
 *
 * Input: Accepts any data structure (used for template resolution).
 * Output: API response with status, headers, and body. Body schema is dynamic
 * and depends on the API being called - full resolution requires making a sample request.
 */
export const ApiCallNode: NodeTypeDefinition = {
  name: 'ApiCall',
  displayName: 'API Call',
  icon: 'globe',
  group: ['action', 'integration'],
  category: 'action',
  description: 'Make HTTP requests to external APIs',

  inputs: ['main'],
  outputs: ['main'],

  defaultParameters: {
    method: 'GET',
    url: '',
    headers: [],
    timeout: 30000,
    inputMappings: [],
  } satisfies ApiCallNodeParameters,

  // ApiCall accepts any input data (used for template variable resolution)
  inputSchema: {
    type: 'object',
    additionalProperties: true,
    description: 'Data available for template variable resolution in URL and headers',
  } as JSONSchema,

  // Output schema - the body structure is dynamic based on the API response
  // This provides the known structure; body schema can be resolved via sample request
  // Static fields are marked with x-field-source: 'static', body is dynamic
  getOutputSchema(): JSONSchema {
    return {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'apiCall', 'x-field-source': 'static' },
        success: { type: 'boolean', description: 'Whether the request completed', 'x-field-source': 'static' },
        status: { type: 'integer', description: 'HTTP status code', 'x-field-source': 'static' },
        statusText: { type: 'string', description: 'HTTP status text', 'x-field-source': 'static' },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Response headers',
          'x-field-source': 'static',
        },
        body: {
          description: 'Response body (JSON parsed if Content-Type is application/json)',
          'x-field-source': 'dynamic',
        },
        error: { type: 'string', description: 'Error message if request failed', 'x-field-source': 'static' },
        requestDuration: { type: 'number', description: 'Request duration in milliseconds', 'x-field-source': 'static' },
      },
      required: ['type', 'success', 'requestDuration'],
    } as JSONSchema;
  },

  /**
   * Executes the API call with the configured parameters.
   *
   * @param context - Execution context with node parameters and helper functions
   * @returns Execution result with API response or error information
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters, getNodeValue } = context;
    const method = (parameters.method as string) || 'GET';
    const rawUrl = (parameters.url as string) || '';
    const rawHeaders = (parameters.headers as HeaderEntry[]) || [];
    const timeout = (parameters.timeout as number) || 30000;

    const startTime = Date.now();

    // Validate URL is not empty
    if (!rawUrl || !rawUrl.trim()) {
      return {
        success: false,
        error: 'URL is required for API Call node',
        output: {
          type: 'apiCall',
          success: false,
          error: 'URL is required for API Call node',
          requestDuration: Date.now() - startTime,
        } satisfies ApiCallOutput,
      };
    }

    try {
      // Resolve template variables in URL
      const url = await resolveTemplate(rawUrl, getNodeValue);

      // Resolve template variables in header values
      const resolvedHeaders: HeaderEntry[] = [];
      for (const header of rawHeaders) {
        resolvedHeaders.push({
          key: header.key,
          value: await resolveTemplate(header.value, getNodeValue),
        });
      }
      const headers = headersToRecord(resolvedHeaders);

      // Setup abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Parse response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value: string, key: string) => {
          responseHeaders[key] = value;
        });

        // Parse response body
        let body: unknown;
        const contentType = response.headers.get('content-type') || '';
        const responseText = await response.text();

        if (contentType.includes('application/json') && responseText) {
          try {
            body = JSON.parse(responseText);
          } catch {
            body = responseText;
          }
        } else {
          body = responseText;
        }

        const output: ApiCallOutput = {
          type: 'apiCall',
          success: true,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body,
          requestDuration: Date.now() - startTime,
        };

        return {
          success: true,
          output,
        };
      } catch (err) {
        clearTimeout(timeoutId);

        // Handle abort error (timeout)
        if (err instanceof Error && err.name === 'AbortError') {
          const output: ApiCallOutput = {
            type: 'apiCall',
            success: false,
            error: `Request timeout after ${timeout}ms`,
            requestDuration: Date.now() - startTime,
          };
          return {
            success: false,
            error: `Request timeout after ${timeout}ms`,
            output,
          };
        }

        // Handle network errors
        const message = err instanceof Error ? err.message : 'Unknown network error';
        const output: ApiCallOutput = {
          type: 'apiCall',
          success: false,
          error: `Network error: ${message}`,
          requestDuration: Date.now() - startTime,
        };
        return {
          success: false,
          error: `Network error: ${message}`,
          output,
        };
      }
    } catch (err) {
      // Handle template resolution or other errors
      const message = err instanceof Error ? err.message : 'Unknown error';
      const output: ApiCallOutput = {
        type: 'apiCall',
        success: false,
        error: `API Call failed: ${message}`,
        requestDuration: Date.now() - startTime,
      };
      return {
        success: false,
        error: `API Call failed: ${message}`,
        output,
      };
    }
  },
};
