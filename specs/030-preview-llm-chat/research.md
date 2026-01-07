# Research: Preview LLM Chat

**Date**: 2026-01-06
**Feature**: 030-preview-llm-chat

## Research Tasks

### 1. Chat UI Library Selection

**Decision**: Use @assistant-ui/react for chat interface components

**Rationale**:
- User explicitly requested assistant-ui for "elements and animations"
- Production-ready UX with built-in streaming, auto-scrolling, markdown rendering
- Composable Radix-style architecture allows customization
- Works with custom backends (our NestJS proxy)
- Supports tool call visualization

**Alternatives Considered**:
- Custom implementation: More work, no built-in streaming UX
- react-chat-elements: Less feature-rich, no AI-specific features
- chatscope/chat-ui-kit: No streaming support, dated styling

**Installation**: `pnpm add @assistant-ui/react`

### 2. Backend OpenAI Integration Pattern

**Decision**: Extend existing @langchain/openai integration with streaming support

**Rationale**:
- Backend already uses @langchain/openai (v0.3.17)
- ChatOpenAI supports streaming via `.stream()` method
- Existing `createLLM()` factory can be extended to accept per-request API keys
- Tool calling supported via LangChain's tool binding

**Implementation Approach**:
1. Create new chat endpoint that accepts API key in request header
2. Use ChatOpenAI with `streaming: true`
3. Bind MCP tools from flow as LangChain tools
4. Return Server-Sent Events (SSE) stream to frontend

**Alternatives Considered**:
- Direct OpenAI SDK: Would duplicate existing LangChain setup
- Vercel AI SDK: Additional dependency, LangChain already sufficient

### 3. Streaming Protocol

**Decision**: Use Server-Sent Events (SSE) for streaming responses

**Rationale**:
- Native browser support via EventSource API
- One-way server-to-client streaming (perfect for LLM responses)
- Simple implementation in NestJS with `@Sse()` decorator
- No WebSocket complexity needed for this use case

**Implementation**:
- Backend: Return `Observable` from controller with `@Sse()` decorator
- Frontend: Use `EventSource` or fetch with `ReadableStream`
- assistant-ui handles progressive rendering automatically

**Alternatives Considered**:
- WebSockets: Overkill for one-way streaming
- Long polling: Poor UX, more network overhead

### 4. API Key Storage Strategy

**Decision**: localStorage on frontend, passed per request to backend

**Rationale**:
- POC phase: No server-side user accounts or secure storage
- localStorage persists across sessions
- Key sent in request header (X-OpenAI-Key) to backend
- Backend never stores the key, just proxies to OpenAI

**Security Notes (POC limitations)**:
- Key visible in browser DevTools localStorage
- Key visible in network requests (but same as direct OpenAI calls)
- Acceptable for POC; production would use server-side encrypted storage

**Alternatives Considered**:
- sessionStorage: Lost on tab close, poor UX
- Backend storage: Requires auth system, out of POC scope
- Environment variable only: Not user-configurable

### 5. MCP Tool Integration with LLM

**Decision**: Convert flow's UserIntent triggers to LangChain tools at chat runtime

**Rationale**:
- Existing `McpToolService.listTools()` returns tool definitions
- Existing `McpToolService.executeTool()` handles tool execution
- LangChain supports tool binding with `llm.bindTools()`
- Tool results can be rendered in chat UI

**Implementation Flow**:
1. Frontend requests chat with flowId
2. Backend loads flow, extracts UserIntent triggers as tools
3. Creates LangChain tools that call `McpToolService.executeTool()`
4. LLM decides when to call tools based on user messages
5. Tool results streamed back to chat

**Tool Schema Mapping**:
```typescript
// From UserIntent.parameters (FlowParameter[])
// To LangChain tool schema
{
  name: trigger.toolName,
  description: trigger.toolDescription,
  schema: z.object({
    // Convert FlowParameter[] to Zod schema
  })
}
```

### 6. Model Selection Options

**Decision**: Support 4 popular OpenAI models via dropdown

**Models**:
| Model ID | Display Name | Notes |
|----------|--------------|-------|
| gpt-4o | GPT-4o | Latest flagship |
| gpt-4o-mini | GPT-4o Mini | Fast & cheap (default) |
| gpt-4-turbo | GPT-4 Turbo | Previous generation |
| gpt-3.5-turbo | GPT-3.5 Turbo | Legacy, lowest cost |

**Rationale**:
- Covers range of cost/capability tradeoffs
- All support function calling (required for tools)
- Default to gpt-4o-mini for cost efficiency

**Alternatives Considered**:
- Include o1 models: Don't support function calling yet
- Include fine-tuned models: Requires model ID input, complex UX

### 7. Existing Component Reuse

**Decision**: Reuse existing `Tabs` component for Settings page

**Existing Patterns to Follow**:
- `Tabs` component at `packages/frontend/src/components/common/Tabs.tsx`
- Page layout pattern from `FlowDetail.tsx`
- Sidebar navigation pattern from `Sidebar.tsx`
- Error handling pattern from existing pages

**New Type Definitions**:
```typescript
// packages/frontend/src/types/tabs.ts
export type SettingsTab = 'general' | 'api-keys';
```

## Summary

| Research Area | Decision | Complexity |
|--------------|----------|------------|
| Chat UI | @assistant-ui/react | Medium (new library) |
| Backend OpenAI | Extend existing LangChain | Low (existing patterns) |
| Streaming | SSE with @Sse() decorator | Low |
| API Key Storage | localStorage + header | Low |
| MCP Tool Integration | LangChain tool binding | Medium |
| Model Selection | 4 OpenAI models | Low |
| Component Reuse | Existing Tabs, layouts | Low |

**Overall Complexity**: Medium - New library integration and SSE streaming are the main technical challenges. Everything else follows existing patterns.
