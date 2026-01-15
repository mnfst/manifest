/**
 * Chat types for Preview LLM Chat feature
 */

/**
 * Represents an LLM's request to execute a tool
 */
export interface ToolCall {
  /** Tool call ID (from OpenAI) */
  id: string;
  /** Name of the tool being called */
  name: string;
  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
}

/**
 * Represents the result of a tool execution
 */
export interface ToolResult {
  /** Tool call ID this result corresponds to */
  toolCallId: string;
  /** Tool name */
  name: string;
  /** Text content returned by tool */
  content: string;
  /** Structured content (for UI rendering) */
  structuredContent?: Record<string, unknown>;
  /** MCP metadata including widget template URI */
  _meta?: Record<string, unknown>;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Message role in conversation
 */
export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Represents a single message in the conversation
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Message role */
  role: ChatMessageRole;
  /** Text content of the message */
  content: string;
  /** Timestamp when message was created */
  timestamp: Date;
  /** Tool call information (if role is 'assistant' and LLM called a tool) */
  toolCalls?: ToolCall[];
  /** Tool result (if role is 'tool') */
  toolResult?: ToolResult;
  /** Streaming state */
  isStreaming?: boolean;
  /** Error information if message failed */
  error?: string;
}

/**
 * Available LLM models for selection
 */
export interface ModelOption {
  /** Model ID (e.g., 'gpt-4o') */
  id: string;
  /** Display name (e.g., 'GPT-4o') */
  name: string;
  /** Provider (always 'openai' for now) */
  provider: 'openai';
  /** Optional description */
  description?: string;
}

/**
 * Request body for preview chat endpoint (POST /api/chat/stream)
 */
export interface PreviewChatRequest {
  /** Flow ID to use for MCP tools */
  flowId: string;
  /** Model to use */
  model: string;
  /** Conversation history (for context) */
  messages: Array<{
    role: ChatMessageRole;
    content: string;
    toolCalls?: ToolCall[];
    toolResult?: ToolResult;
  }>;
}

/**
 * SSE event types sent from backend to frontend
 */
export type ChatStreamEvent =
  | { type: 'start'; messageId: string }
  | { type: 'token'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_result'; toolResult: ToolResult }
  | { type: 'end'; messageId: string }
  | { type: 'error'; error: string };

/**
 * Response from GET /api/chat/models
 */
export interface ModelListResponse {
  models: ModelOption[];
}

/**
 * Request body for POST /api/chat/validate-key
 */
export interface ValidateKeyRequest {
  apiKey: string;
}

/**
 * Response from POST /api/chat/validate-key
 */
export interface ValidateKeyResponse {
  valid: boolean;
  error?: string;
}

/**
 * Structure stored in localStorage for API key
 */
export interface StoredApiKey {
  /** The actual API key value */
  value: string;
  /** Provider identifier */
  provider: 'openai';
  /** When the key was saved */
  savedAt: string;
}
