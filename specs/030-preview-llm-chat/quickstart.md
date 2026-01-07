# Quickstart: Preview LLM Chat

**Date**: 2026-01-06
**Feature**: 030-preview-llm-chat

## Prerequisites

- Node.js 18+
- pnpm 9.15+
- OpenAI API key (get one at https://platform.openai.com/api-keys)

## Setup

1. **Install new dependency**:
   ```bash
   cd packages/frontend
   pnpm add @assistant-ui/react
   ```

2. **Start development servers**:
   ```bash
   # From repo root
   pnpm dev
   ```

## Testing the Feature

### 1. Configure API Key

1. Click **Settings** in the sidebar (new nav item)
2. Go to **API Keys** tab
3. Enter your OpenAI API key
4. Click **Save**
5. Verify the key shows as masked (e.g., `sk-...xxxx`)

### 2. Test Preview Chat

1. Navigate to any flow with UserIntent triggers
2. Click the **Preview** tab (should now be enabled)
3. Select a model from the dropdown (default: GPT-4o Mini)
4. Type a message that would trigger one of the flow's tools
5. Verify:
   - Your message appears immediately
   - LLM response streams in progressively
   - Tool calls are displayed (if triggered)
   - Tool results render correctly

### 3. Edge Cases to Test

| Scenario | Expected Behavior |
|----------|-------------------|
| No API key configured | Preview tab disabled, tooltip explains why |
| Invalid API key | Error message after first chat attempt |
| Network disconnect | Connection error with retry option |
| Clear chat | All messages removed, fresh conversation |
| Long tool execution | Loading indicator shown |

## File Changes Summary

### New Files

```
packages/backend/src/chat/
├── chat.module.ts       # NestJS module registration
├── chat.controller.ts   # SSE endpoints
└── chat.service.ts      # OpenAI proxy + tool execution

packages/frontend/src/
├── pages/SettingsPage.tsx
├── components/settings/
│   ├── GeneralTab.tsx
│   └── ApiKeysTab.tsx
├── components/chat/PreviewChat.tsx
└── hooks/useApiKey.ts

packages/shared/src/types/chat.ts  # Shared type definitions
```

### Modified Files

```
packages/backend/src/app.module.ts  # Import ChatModule
packages/frontend/src/App.tsx       # Add /settings route
packages/frontend/src/components/layout/Sidebar.tsx  # Add Settings nav item
packages/frontend/src/pages/FlowDetail.tsx  # Replace Preview placeholder
packages/frontend/src/lib/api.ts    # Add chat API methods
packages/frontend/src/types/tabs.ts # Add SettingsTab type
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ SettingsPage│    │ PreviewChat  │    │  useApiKey    │  │
│  │ (API Keys)  │───▶│ (assistant-ui)│◀───│ (localStorage)│  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│                            │                                 │
│                            │ SSE stream                      │
│                            ▼                                 │
├─────────────────────────────────────────────────────────────┤
│                        Backend                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │ ChatController  │───▶│  ChatService     │               │
│  │ POST /api/chat/ │    │                  │               │
│  │   stream        │    │ - ChatOpenAI     │               │
│  └─────────────────┘    │ - bindTools()    │               │
│                         │ - stream()       │               │
│                         └────────┬─────────┘               │
│                                  │                          │
│                                  ▼                          │
│                         ┌──────────────────┐               │
│                         │ McpToolService   │ (existing)    │
│                         │ - executeTool()  │               │
│                         └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   OpenAI API     │
                         └──────────────────┘
```

## Common Issues

### "Preview tab is disabled"
- Ensure you have at least one UserIntent trigger node in the flow
- Ensure the UserIntent node has `isActive: true`

### "Invalid API key"
- Verify the key starts with `sk-`
- Check your OpenAI account has API access enabled
- Ensure you have billing set up on OpenAI

### "Tool execution failed"
- Check the flow's UserIntent parameters are correctly configured
- Verify downstream nodes (Interface, Return) are connected

### Streaming not working
- Ensure browser supports EventSource API (all modern browsers do)
- Check browser DevTools Network tab for SSE connection
- Verify backend is returning `text/event-stream` content type
