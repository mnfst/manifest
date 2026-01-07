# Tasks: Preview LLM Chat

**Input**: Design documents from `/specs/030-preview-llm-chat/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Testing deferred per POC constitution - no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, shared types, and routing infrastructure

- [x] T001 Install @assistant-ui/react dependency in packages/frontend/package.json
- [x] T002 [P] Create shared chat types in packages/shared/src/types/chat.ts (ChatMessage, ToolCall, ToolResult, ChatRequest, ChatStreamEvent, ModelOption)
- [x] T003 [P] Export chat types from packages/shared/src/index.ts
- [x] T004 [P] Add SettingsTab type to packages/frontend/src/types/tabs.ts
- [x] T005 Create SettingsPage component shell in packages/frontend/src/pages/SettingsPage.tsx (tabbed layout using existing Tabs component)
- [x] T006 Add /settings route to packages/frontend/src/App.tsx
- [x] T007 Add Settings navigation item with icon to packages/frontend/src/components/layout/Sidebar.tsx

**Checkpoint**: Settings page accessible via sidebar, tabbed layout visible

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend chat module structure that MUST be complete before chat functionality

**⚠️ CRITICAL**: No user story work involving chat endpoints can begin until this phase is complete

- [x] T008 Create ChatModule in packages/backend/src/chat/chat.module.ts
- [x] T009 Create ChatController shell in packages/backend/src/chat/chat.controller.ts (empty endpoints)
- [x] T010 Create ChatService shell in packages/backend/src/chat/chat.service.ts (method stubs)
- [x] T011 Register ChatModule in packages/backend/src/app.module.ts

**Checkpoint**: Backend compiles with empty chat module registered

---

## Phase 3: User Story 1 - Configure OpenAI API Key (Priority: P1) 🎯 MVP

**Goal**: Users can save and manage their OpenAI API key via Settings page

**Independent Test**: Navigate to Settings > API Keys, enter a key, save it, refresh page, verify key persists (masked)

### Implementation for User Story 1

- [x] T012 [P] [US1] Create useApiKey hook for localStorage in packages/frontend/src/hooks/useApiKey.ts (get, set, clear, getMasked)
- [x] T013 [P] [US1] Implement ApiKeysTab component in packages/frontend/src/components/settings/ApiKeysTab.tsx (input field, save button, masked display, delete button)
- [x] T014 [US1] Wire ApiKeysTab into SettingsPage in packages/frontend/src/pages/SettingsPage.tsx
- [x] T015 [US1] Implement POST /api/chat/validate-key endpoint in packages/backend/src/chat/chat.controller.ts
- [x] T016 [US1] Implement validateApiKey method in packages/backend/src/chat/chat.service.ts (format check + OpenAI API test call)
- [x] T017 [US1] Add validateApiKey API method to packages/frontend/src/lib/api.ts
- [x] T018 [US1] Add API key validation on save in ApiKeysTab with error display

**Checkpoint**: User Story 1 complete - API key can be saved, validated, and persists across page refreshes

---

## Phase 4: User Story 2 - Chat with LLM Using Flow's MCP Tools (Priority: P2)

**Goal**: Users can chat with an LLM in the Preview tab, with access to the flow's MCP tools

**Independent Test**: Open a flow with UserIntent triggers, go to Preview tab, select model, send message, receive streaming response, trigger a tool

**Dependencies**: Requires US1 (API key) to be functional

### Implementation for User Story 2

- [x] T019 [P] [US2] Implement GET /api/chat/models endpoint in packages/backend/src/chat/chat.controller.ts
- [x] T020 [P] [US2] Implement getModels method in packages/backend/src/chat/chat.service.ts (return static model list)
- [x] T021 [US2] Implement POST /api/chat/stream SSE endpoint in packages/backend/src/chat/chat.controller.ts (use @Sse decorator)
- [x] T022 [US2] Implement streamChat method in packages/backend/src/chat/chat.service.ts (ChatOpenAI with streaming)
- [x] T023 [US2] Add tool binding logic in ChatService - convert UserIntent nodes to LangChain tools using McpToolService
- [x] T024 [US2] Add tool execution handling in streamChat - call McpToolService.executeTool when LLM requests tool
- [x] T025 [P] [US2] Add chat API methods to packages/frontend/src/lib/api.ts (streamChat, getModels)
- [x] T026 [US2] Create PreviewChat component in packages/frontend/src/components/chat/PreviewChat.tsx (using basic React components)
- [x] T027 [US2] Implement model selector dropdown in PreviewChat
- [x] T028 [US2] Implement message list with user/assistant messages in PreviewChat
- [x] T029 [US2] Implement SSE streaming handler in PreviewChat (EventSource or fetch with ReadableStream)
- [x] T030 [US2] Implement message input with send button in PreviewChat
- [x] T031 [US2] Add loading/typing indicators during streaming
- [x] T032 [US2] Implement tool call display in chat (show when LLM calls a tool)
- [x] T033 [US2] Implement tool result display in chat (show tool execution results)
- [x] T034 [US2] Replace Preview tab placeholder with PreviewChat in packages/frontend/src/pages/FlowDetail.tsx
- [x] T035 [US2] Add disabled state with tooltip when no API key configured in FlowDetail Preview tab
- [x] T036 [US2] Implement clear chat functionality in PreviewChat
- [x] T037 [US2] Add error handling for API key issues, network errors, rate limiting

**Checkpoint**: User Story 2 complete - Full chat functionality with tool calling works in Preview tab

---

## Phase 5: User Story 3 - Rich UI Rendering in Chat (Priority: P3)

**Goal**: Chat renders structured outputs and markdown as rich UI components

**Independent Test**: Trigger a tool that returns structured data or markdown, verify it renders as styled UI

**Dependencies**: Requires US2 (chat functionality) to be functional

### Implementation for User Story 3

- [x] T038 [US3] Add markdown rendering support in PreviewChat using react-markdown or assistant-ui built-in
- [x] T039 [US3] Add code syntax highlighting for code blocks in markdown
- [x] T040 [US3] Implement structured content renderer in packages/frontend/src/components/chat/StructuredContentRenderer.tsx (integrated in PreviewChat)
- [x] T041 [US3] Handle structuredContent from tool results in PreviewChat (render cards, lists, etc.)
- [x] T042 [US3] Style error messages in chat with appropriate formatting

**Checkpoint**: User Story 3 complete - Markdown and structured outputs render as rich UI

---

## Phase 6: User Story 4 - Settings General Tab Placeholder (Priority: P4)

**Goal**: Settings page has General tab showing "Coming soon"

**Independent Test**: Navigate to Settings, click General tab, see "Coming soon" message

**Dependencies**: None (can be done in parallel with any story after Setup)

### Implementation for User Story 4

- [x] T043 [US4] Create GeneralTab component in packages/frontend/src/components/settings/GeneralTab.tsx (placeholder with "Coming soon" message)
- [x] T044 [US4] Wire GeneralTab into SettingsPage as first tab in packages/frontend/src/pages/SettingsPage.tsx

**Checkpoint**: User Story 4 complete - General tab visible with placeholder

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [x] T045 Validate complete flow per quickstart.md test scenarios
- [x] T046 Ensure consistent error messages across all error states
- [x] T047 Add keyboard shortcuts (Enter to send) in PreviewChat
- [x] T048 Ensure auto-scroll to latest message in chat
- [x] T049 Run linter and fix any issues (pnpm lint)
- [ ] T050 Start app for testing using .specify/scripts/bash/serve-app.sh

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on T002 (shared types) - BLOCKS backend implementation
- **User Story 1 (Phase 3)**: Depends on Setup and Foundational
- **User Story 2 (Phase 4)**: Depends on US1 (API key must be saveable)
- **User Story 3 (Phase 5)**: Depends on US2 (chat must work first)
- **User Story 4 (Phase 6)**: Depends only on Setup - can run in parallel with US1
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

```
Setup (Phase 1)
     │
     ├──────────────────────────────┐
     ▼                              ▼
Foundational (Phase 2)        US4 (Phase 6) [parallel path]
     │
     ▼
US1 (Phase 3) - API Key Config
     │
     ▼
US2 (Phase 4) - Chat with LLM
     │
     ▼
US3 (Phase 5) - Rich UI Rendering
     │
     ▼
Polish (Phase 7)
```

### Within Each User Story

- Models/types before services
- Backend before frontend (for API endpoints)
- Core implementation before UI polish
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 Setup:**
- T002, T003, T004 can all run in parallel (different files)

**Phase 3 US1:**
- T012, T013 can run in parallel (different files)

**Phase 4 US2:**
- T019, T020, T025 can run in parallel (different files)

**Cross-Phase:**
- US4 can run entirely in parallel with US1 (after Setup)

---

## Parallel Example: User Story 2

```bash
# Launch backend model endpoint tasks together:
Task: "Implement GET /api/chat/models endpoint in packages/backend/src/chat/chat.controller.ts"
Task: "Implement getModels method in packages/backend/src/chat/chat.service.ts"

# Launch frontend API methods in parallel:
Task: "Add chat API methods to packages/frontend/src/lib/api.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (API Key Configuration)
4. **STOP and VALIDATE**: Test API key save/load independently
5. Deploy/demo if ready - users can configure keys

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add User Story 1 → Test independently → **MVP: Settings with API Keys!**
3. Add User Story 2 → Test independently → **Chat functionality!**
4. Add User Story 3 → Test independently → **Rich rendering!**
5. Add User Story 4 → Test independently → **Complete settings!**
6. Polish → Final validation

### Single Developer Strategy

Execute phases sequentially in order:
1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

### Parallel Team Strategy (2 developers)

1. Both complete Phase 1 + 2 together
2. Developer A: US1 → US2 → US3
3. Developer B: US4 → Polish tasks
4. Merge and final validation

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Testing deferred per POC constitution
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Total tasks: 50
