import type { App } from './app.js';
import type { MockData } from './mock-data.js';

/**
 * MCP tool response following ChatGPT Apps SDK format
 * @see https://developers.openai.com/apps-sdk/quickstart
 */
export interface McpToolResponse {
  /**
   * Text content to display in ChatGPT conversation
   */
  content?: Array<{ type: 'text'; text: string }>;

  /**
   * Structured data to pass to the UI component
   * Optional for return value flows and call flow flows that don't display UI
   */
  structuredContent?: MockData | Record<string, unknown>;

  /**
   * Metadata for ChatGPT Apps SDK
   * Optional for return value flows that don't display UI
   */
  _meta?: {
    /**
     * URL to the UI component that ChatGPT renders in an iframe
     * Format: ui://widget/{mcpSlug}.html
     */
    'openai/outputTemplate'?: string;
    /**
     * Whether to show border around widget
     */
    'openai/widgetPrefersBorder'?: boolean;
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
   * UI component URL for ChatGPT Apps SDK
   * Format: /servers/{mcpSlug}/ui/{layoutTemplate}.html
   */
  uiUrl: string;

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
