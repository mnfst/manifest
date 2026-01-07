# Data Model: Preview LLM Chat

**Date**: 2026-01-06
**Feature**: 030-preview-llm-chat

## Overview

This feature introduces chat-related data structures for the preview functionality. Since chat sessions are ephemeral (not persisted), most data structures are runtime-only TypeScript types in the shared package.

## New Types (packages/shared/src/types/chat.ts)

### ChatMessage

Represents a single message in the conversation.

```typescript
interface ChatMessage {
  /** Unique identifier for the message */
  id: string;

  /** Message role */
  role: 'user' | 'assistant' | 'system' | 'tool';

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
```

### ToolCall

Represents an LLM's request to execute a tool.

```typescript
interface ToolCall {
  /** Tool call ID (from OpenAI) */
  id: string;

  /** Name of the tool being called */
  name: string;

  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
}
```

### ToolResult

Represents the result of a tool execution.

```typescript
interface ToolResult {
  /** Tool call ID this result corresponds to */
  toolCallId: string;

  /** Tool name */
  name: string;

  /** Text content returned by tool */
  content: string;

  /** Structured content (for UI rendering) */
  structuredContent?: Record<string, unknown>;

  /** Whether execution succeeded */
  success: boolean;

  /** Error message if execution failed */
  error?: string;
}
```

### ChatSession (Frontend Runtime Only)

Represents an active chat session in the frontend.

```typescript
interface ChatSession {
  /** Flow ID this chat is testing */
  flowId: string;

  /** Selected model ID */
  model: string;

  /** Conversation history */
  messages: ChatMessage[];

  /** Whether a request is in progress */
  isLoading: boolean;

  /** Current error state */
  error: string | null;
}
```

### ModelOption

Available LLM models for selection.

```typescript
interface ModelOption {
  /** Model ID (e.g., 'gpt-4o') */
  id: string;

  /** Display name (e.g., 'GPT-4o') */
  name: string;

  /** Provider (always 'openai' for now) */
  provider: 'openai';

  /** Optional description */
  description?: string;
}
```

### API Key Storage (Frontend localStorage)

Structure stored in localStorage under key `openai_api_key`:

```typescript
interface StoredApiKey {
  /** The actual API key value */
  value: string;

  /** Provider identifier */
  provider: 'openai';

  /** When the key was saved */
  savedAt: string; // ISO date string
}
```

## Request/Response Types

### ChatRequest

Request body for chat endpoint.

```typescript
interface ChatRequest {
  /** Flow ID to use for MCP tools */
  flowId: string;

  /** Model to use */
  model: string;

  /** Conversation history (for context) */
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCalls?: ToolCall[];
    toolResult?: ToolResult;
  }>;
}
```

### ChatStreamEvent

SSE event types sent from backend to frontend.

```typescript
type ChatStreamEvent =
  | { type: 'start'; messageId: string }
  | { type: 'token'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_result'; toolResult: ToolResult }
  | { type: 'end'; messageId: string }
  | { type: 'error'; error: string };
```

## Relationships

```
┌─────────────────┐
│   ChatSession   │ (Frontend runtime state)
├─────────────────┤
│ flowId          │──────────────────┐
│ model           │                  │
│ messages[]      │                  │
│ isLoading       │                  │
└─────────────────┘                  │
        │                            │
        │ contains                   │ references
        ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│   ChatMessage   │          │      Flow       │ (Existing entity)
├─────────────────┤          ├─────────────────┤
│ id              │          │ id              │
│ role            │          │ nodes[]         │──┐
│ content         │          │ connections[]   │  │
│ toolCalls[]     │          └─────────────────┘  │
│ toolResult      │                               │
└─────────────────┘                               │
        │                                         │ contains
        │ may contain                             ▼
        ▼                                 ┌─────────────────┐
┌─────────────────┐                       │  NodeInstance   │
│    ToolCall     │                       │ (type=UserIntent)│
├─────────────────┤                       ├─────────────────┤
│ id              │                       │ toolName        │
│ name            │───────────────────────│ toolDescription │
│ arguments       │   maps to tool from   │ parameters[]    │
└─────────────────┘                       └─────────────────┘
```

## Storage Summary

| Data | Storage Location | Persistence |
|------|------------------|-------------|
| API Key | localStorage (`openai_api_key`) | Persistent (browser) |
| Chat Session | React state | Ephemeral (lost on refresh) |
| Chat Messages | React state | Ephemeral |
| Model Selection | React state (with localStorage for preference) | Semi-persistent |
| Flow/Nodes | SQLite database | Persistent (server) |

## Notes

- No database changes required - all chat data is ephemeral
- Existing `FlowExecution` entity tracks tool invocations for debugging (already exists)
- API key never stored on server - passed per request
- Future enhancement: Persist chat sessions to database with user accounts
