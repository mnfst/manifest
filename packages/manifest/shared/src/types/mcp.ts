import type { App } from './app.js';

/**
 * MCP tool response following MCP Apps protocol format
 * @see https://modelcontextprotocol.io/docs/extensions/apps
 */
export interface McpToolResponse {
  /**
   * Text content to display in the AI conversation
   */
  content: Array<{ type: 'text'; text: string }>;

  /**
   * Whether the tool call resulted in an error
   */
  isError?: boolean;

  /**
   * Metadata for MCP Apps protocol
   * Optional for return value flows that don't display UI
   */
  _meta?: {
    /**
     * UI resource reference for rendering an app widget
     */
    ui?: { resourceUri?: string };
    /**
     * Additional metadata fields
     */
    [key: string]: unknown;
  };
}

/**
 * Result of publishing an app to MCP server
 */
export interface PublishResult {
  /**
   * MCP server endpoint URL
   * Format: /servers/{mcpSlug}/mcp
   */
  endpointUrl: string;

  /**
   * The published app with updated status
   */
  app: App;
}

/**
 * Error response from API
 */
export interface ApiError {
  message: string;
  code?: string;
}

/**
 * MCP tool input schema
 */
export interface McpToolInput {
  /**
   * User query or request
   */
  message: string;

  /**
   * Additional context (optional)
   */
  context?: Record<string, unknown>;
}
