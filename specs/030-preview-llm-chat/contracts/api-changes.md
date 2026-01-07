# API Contracts: Preview LLM Chat

**Date**: 2026-01-06
**Feature**: 030-preview-llm-chat

## New Endpoints

### POST /api/chat/stream

Stream a chat response from OpenAI with MCP tool access.

**Authentication**: API key passed in header (no user auth for POC)

**Request Headers**:
```
Content-Type: application/json
X-OpenAI-Key: sk-... (required)
Accept: text/event-stream
```

**Request Body**:
```json
{
  "flowId": "uuid-of-flow",
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant with access to the following tools..."
    },
    {
      "role": "user",
      "content": "Hello, can you help me?"
    },
    {
      "role": "assistant",
      "content": "Of course! How can I help you today?"
    },
    {
      "role": "user",
      "content": "What tools do you have available?"
    }
  ]
}
```

**Response**: Server-Sent Events (SSE) stream

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"start","messageId":"msg_123"}

data: {"type":"token","content":"I"}

data: {"type":"token","content":" have"}

data: {"type":"token","content":" access"}

data: {"type":"tool_call","toolCall":{"id":"call_abc","name":"search_products","arguments":{"query":"laptop"}}}

data: {"type":"tool_result","toolResult":{"toolCallId":"call_abc","name":"search_products","content":"Found 5 products...","success":true}}

data: {"type":"token","content":"Based on the search results..."}

data: {"type":"end","messageId":"msg_123"}
```

**Error Events**:
```
data: {"type":"error","error":"Invalid API key"}

data: {"type":"error","error":"Rate limit exceeded. Please try again later."}

data: {"type":"error","error":"Tool execution failed: Connection timeout"}
```

**Error Response (non-streaming)**:
```json
HTTP 400 Bad Request
{
  "statusCode": 400,
  "message": "flowId is required",
  "error": "Bad Request"
}

HTTP 401 Unauthorized
{
  "statusCode": 401,
  "message": "X-OpenAI-Key header is required",
  "error": "Unauthorized"
}

HTTP 404 Not Found
{
  "statusCode": 404,
  "message": "Flow not found",
  "error": "Not Found"
}
```

---

### GET /api/chat/models

Get available model options.

**Request Headers**:
```
Accept: application/json
```

**Response**:
```json
HTTP 200 OK
{
  "models": [
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "provider": "openai",
      "description": "Most capable model, best for complex tasks"
    },
    {
      "id": "gpt-4o-mini",
      "name": "GPT-4o Mini",
      "provider": "openai",
      "description": "Fast and cost-effective (recommended)"
    },
    {
      "id": "gpt-4-turbo",
      "name": "GPT-4 Turbo",
      "provider": "openai",
      "description": "Previous generation, good balance"
    },
    {
      "id": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "provider": "openai",
      "description": "Fastest and cheapest option"
    }
  ]
}
```

---

### POST /api/chat/validate-key

Validate an OpenAI API key without making a full chat request.

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "apiKey": "sk-..."
}
```

**Response**:
```json
HTTP 200 OK
{
  "valid": true
}

HTTP 200 OK
{
  "valid": false,
  "error": "Invalid API key format"
}

HTTP 200 OK
{
  "valid": false,
  "error": "API key is invalid or expired"
}
```

---

## Existing Endpoints (No Changes)

The following endpoints are used by the chat feature but require no modifications:

### GET /api/flows/:flowId

Used to load flow data and extract MCP tools from UserIntent nodes.

### GET /api/flows/:flowId/executions

Tool executions are automatically tracked via existing FlowExecution system.

---

## SSE Event Schema

### ChatStreamEvent Union Type

```typescript
type ChatStreamEvent =
  | StartEvent
  | TokenEvent
  | ToolCallEvent
  | ToolResultEvent
  | EndEvent
  | ErrorEvent;

interface StartEvent {
  type: 'start';
  messageId: string;  // UUID for this assistant message
}

interface TokenEvent {
  type: 'token';
  content: string;  // Token fragment to append
}

interface ToolCallEvent {
  type: 'tool_call';
  toolCall: {
    id: string;       // OpenAI tool call ID
    name: string;     // Tool name from UserIntent
    arguments: Record<string, unknown>;  // Parsed arguments
  };
}

interface ToolResultEvent {
  type: 'tool_result';
  toolResult: {
    toolCallId: string;
    name: string;
    content: string;
    structuredContent?: Record<string, unknown>;
    success: boolean;
    error?: string;
  };
}

interface EndEvent {
  type: 'end';
  messageId: string;
}

interface ErrorEvent {
  type: 'error';
  error: string;
}
```

---

## Request/Response Types Summary

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| /api/chat/stream | POST | X-OpenAI-Key header | ChatRequest | SSE Stream |
| /api/chat/models | GET | None | - | ModelListResponse |
| /api/chat/validate-key | POST | None | ValidateKeyRequest | ValidateKeyResponse |

---

## Implementation Notes

1. **SSE in NestJS**: Use `@Sse()` decorator with `Observable<MessageEvent>` return type
2. **Streaming**: Use LangChain's `.stream()` method on ChatOpenAI
3. **Tool Execution**: Reuse existing `McpToolService.executeTool()`
4. **Error Handling**: Convert OpenAI errors to user-friendly messages
5. **Rate Limiting**: Pass through OpenAI's rate limit errors; no server-side limiting for POC
