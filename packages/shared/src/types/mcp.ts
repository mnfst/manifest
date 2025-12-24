import type { App } from './app';
import type { MockData } from './mock-data';

/**
 * MCP tool response following ChatGPT Apps SDK format
 * @see https://developers.openai.com/apps-sdk/quickstart
 */
export interface McpToolResponse {
  /**
   * Text content to display in ChatGPT conversation
   */
  content: Array<{ type: 'text'; text: string }>;

  /**
   * Structured data to pass to the UI component
   */
  structuredContent: MockData;

  /**
   * Metadata for ChatGPT Apps SDK
   */
  _meta: {
    /**
     * URL to the UI component that ChatGPT renders in an iframe
     * Format: ui://widget/{mcpSlug}.html
     */
    'openai/outputTemplate': string;
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
