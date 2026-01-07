# Implementation Plan: Preview LLM Chat

**Branch**: `030-preview-llm-chat` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/030-preview-llm-chat/spec.md`

## Summary

Transform the Preview tab from a placeholder into a functional chat interface that communicates with OpenAI LLMs, with access to the flow's MCP tools. Add a Settings page to the sidebar for API key configuration. Backend proxies OpenAI calls, frontend stores API key in localStorage and sends per request.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**:
- Backend: NestJS 10.4.15, @langchain/openai 0.3.17, TypeORM 0.3.20
- Frontend: React 18.3.1, @xyflow/react 12.10.0, Vite 6.0.5, TailwindCSS 3.4.17
- New: @assistant-ui/react (chat UI components)
**Storage**: SQLite (better-sqlite3), localStorage (API keys on frontend)
**Testing**: Deferred for POC (per constitution)
**Target Platform**: Web (desktop browsers)
**Project Type**: Web application (monorepo with packages/backend, packages/frontend, packages/shared)
**Performance Goals**: Deferred for POC
**Constraints**: POC phase - no authentication, simplified workflow
**Scale/Scope**: Single user, ephemeral chat sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ PASS | Service-based architecture maintained |
| II. Testing Standards | ✅ DEFERRED | POC phase - testing not required |
| III. UX Consistency | ✅ PASS | Reusing existing Tabs component, following existing patterns |
| IV. Performance | ✅ DEFERRED | POC phase - no performance targets |
| V. Documentation | ✅ PASS | Plan documents architecture decisions |

**Gate Status**: PASS - All principles satisfied or appropriately deferred for POC.

## Project Structure

### Documentation (this feature)

```text
specs/030-preview-llm-chat/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-changes.md   # New endpoints
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── chat/                    # NEW: Chat module
│       │   ├── chat.controller.ts   # Chat API endpoints
│       │   ├── chat.service.ts      # OpenAI proxy service
│       │   └── chat.module.ts       # NestJS module
│       └── app.module.ts            # Register chat module
├── frontend/
│   └── src/
│       ├── pages/
│       │   └── SettingsPage.tsx     # NEW: Settings page
│       ├── components/
│       │   ├── settings/            # NEW: Settings components
│       │   │   ├── GeneralTab.tsx
│       │   │   └── ApiKeysTab.tsx
│       │   └── chat/                # EXISTING: Enhance for LLM chat
│       │       └── PreviewChat.tsx  # NEW: Main preview chat component
│       ├── hooks/
│       │   └── useApiKey.ts         # NEW: localStorage hook for API key
│       ├── lib/
│       │   └── api.ts               # ADD: Chat API methods
│       └── App.tsx                  # ADD: /settings route
└── shared/
    └── src/
        └── types/
            └── chat.ts              # NEW: Chat message types
```

**Structure Decision**: Web application structure (backend + frontend packages). New chat module in backend, new settings page and chat components in frontend. Shared types for chat messages.

## Complexity Tracking

No complexity violations. Architecture follows existing patterns:
- New NestJS module mirrors existing app/flow/node modules
- Frontend page structure mirrors existing FlowDetail pattern
- Shared types follow existing conventions
