# Tasks: MCP App and Flow Data Architecture

**Input**: Design documents from `/specs/002-mcp-server-flow/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: POC scope - no automated tests required per constitution

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared type definitions and dependency installation

- [x] T001 [P] Install slugify dependency in packages/backend/package.json
- [x] T002 [P] Create Flow types in packages/shared/src/types/flow.ts (Flow, CreateFlowRequest, UpdateFlowRequest, GenerateFlowResponse)
- [x] T003 [P] Create View types in packages/shared/src/types/view.ts (View, CreateViewRequest, UpdateViewRequest, ReorderViewsRequest)
- [x] T004 Update App types to remove layout/mockData fields in packages/shared/src/types/app.ts (App, CreateAppRequest, UpdateAppRequest)
- [x] T005 Export new types from packages/shared/src/types/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core entities and database schema that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Modify AppEntity to remove layout/mockData/systemPrompt/toolName/toolDescription fields in packages/backend/src/entities/app.entity.ts
- [x] T007 [P] Create FlowEntity with TypeORM decorators in packages/backend/src/flow/flow.entity.ts (id, appId, name, description, toolName, toolDescription, timestamps, ManyToOne to App)
- [x] T008 [P] Create ViewEntity with TypeORM decorators in packages/backend/src/view/view.entity.ts (id, flowId, name, layoutTemplate, mockData, order, timestamps, ManyToOne to Flow)
- [x] T009 Add OneToMany flows relation to AppEntity in packages/backend/src/entities/app.entity.ts
- [x] T010 Register FlowEntity and ViewEntity in TypeORM configuration in packages/backend/src/app/app.module.ts
- [x] T011 [P] Create FlowModule skeleton in packages/backend/src/flow/flow.module.ts
- [x] T012 [P] Create ViewModule skeleton in packages/backend/src/view/view.module.ts
- [x] T013 Import FlowModule and ViewModule into root AppModule in packages/backend/src/app/app.module.ts
- [x] T014 Update frontend routes in packages/frontend/src/App.tsx to add /app/:appId, /app/:appId/flow/:flowId, /app/:appId/flow/:flowId/view/:viewId routes

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Create App (Priority: P1) 🎯 MVP

**Goal**: Users can create an App via a form on the home page with name, description, and optional theme

**Independent Test**: Access home page, fill app creation form, submit, verify redirect to app dashboard at /app/:appId

### Implementation for User Story 1

- [x] T015 [US1] Implement slug generation utility with slugify in packages/backend/src/app/app.service.ts (generateUniqueSlug method)
- [x] T016 [US1] Update AppService.create to accept new CreateAppRequest format (name, description, themeVariables) and generate slug in packages/backend/src/app/app.service.ts
- [x] T017 [US1] Update AppController.create endpoint to use new CreateAppRequest in packages/backend/src/app/app.controller.ts
- [x] T018 [US1] Add getById and getBySlug methods to AppService in packages/backend/src/app/app.service.ts
- [x] T019 [US1] Add GET /apps/:appId endpoint to AppController in packages/backend/src/app/app.controller.ts
- [x] T020 [P] [US1] Create AppForm component in packages/frontend/src/components/app/AppForm.tsx (name input, description textarea, optional theme picker)
- [x] T021 [US1] Modify Home page to show AppForm instead of PromptForm in packages/frontend/src/pages/Home.tsx
- [x] T022 [US1] Update frontend api.ts to add createApp and getApp functions in packages/frontend/src/lib/api.ts
- [x] T023 [US1] Create AppDashboard page skeleton in packages/frontend/src/pages/AppDashboard.tsx (fetch app by ID, display name/description, empty flows section)
- [x] T024 [US1] Implement Home → AppDashboard navigation after app creation in packages/frontend/src/pages/Home.tsx

**Checkpoint**: User Story 1 complete - users can create an app and see its dashboard

---

## Phase 4: User Story 2 - Create Flow via AI Prompt (Priority: P2)

**Goal**: Users can describe a flow in natural language and the system generates an MCP tool with initial view

**Independent Test**: From app dashboard, enter a flow prompt, verify flow is created with at least one view, verify redirect to flow editor

### Implementation for User Story 2

- [x] T025 [US2] Create FlowService with CRUD operations in packages/backend/src/flow/flow.service.ts (create, findById, findByAppId, update, delete)
- [x] T026 [US2] Create FlowController with endpoints in packages/backend/src/flow/flow.controller.ts (GET /apps/:appId/flows, POST /apps/:appId/flows, GET /flows/:flowId, PATCH /flows/:flowId, DELETE /flows/:flowId)
- [x] T027 [US2] Create ViewService with CRUD operations in packages/backend/src/view/view.service.ts (create, findById, findByFlowId, update, delete, reorder)
- [x] T028 [US2] Create ViewController with basic endpoints in packages/backend/src/view/view.controller.ts (GET /flows/:flowId/views, POST /flows/:flowId/views, GET /views/:viewId)
- [x] T029 [US2] Modify AgentService.generateFlow to create Flow + initial View instead of App in packages/backend/src/agent/agent.service.ts
- [x] T030 [US2] Add flow generation tool/prompt to extract flow metadata (name, description, toolName) from user prompt in packages/backend/src/agent/tools/
- [x] T031 [US2] Connect FlowController.create to AgentService.generateFlow for AI-assisted creation in packages/backend/src/flow/flow.controller.ts
- [x] T032 [P] [US2] Create PromptInput component for flow creation in packages/frontend/src/components/flow/PromptInput.tsx
- [x] T033 [US2] Update AppDashboard to show PromptInput for flow creation in packages/frontend/src/pages/AppDashboard.tsx
- [x] T034 [US2] Update api.ts to add createFlow, getFlow, listFlows functions in packages/frontend/src/lib/api.ts
- [x] T035 [P] [US2] Create FlowEditor page skeleton in packages/frontend/src/pages/FlowEditor.tsx (fetch flow by ID, display name/description, view list placeholder)
- [x] T036 [US2] Implement AppDashboard → FlowEditor navigation after flow creation in packages/frontend/src/pages/AppDashboard.tsx

**Checkpoint**: User Story 2 complete - users can create flows via AI prompt

---

## Phase 5: User Story 3 - Edit Flow and Views (Priority: P3)

**Goal**: Users can edit flow properties, view the list of views, navigate to view editor, and modify views via chat

**Independent Test**: Navigate to flow editor, see view list, click view to open editor, use chat to modify view, verify changes persist

### Implementation for User Story 3

- [x] T037 [US3] Add PATCH /views/:viewId endpoint to ViewController in packages/backend/src/view/view.controller.ts
- [x] T038 [US3] Add DELETE /views/:viewId endpoint with last-view protection in packages/backend/src/view/view.controller.ts
- [x] T039 [US3] Add POST /flows/:flowId/views/reorder endpoint to ViewController in packages/backend/src/view/view.controller.ts
- [x] T040 [US3] Add POST /views/:viewId/chat endpoint for chat-based view modification in packages/backend/src/view/view.controller.ts
- [x] T041 [US3] Modify AgentService to support view-scoped chat (update view mockData/layout via chat) in packages/backend/src/agent/agent.service.ts
- [x] T042 [P] [US3] Create ViewList component in packages/frontend/src/components/view/ViewList.tsx (display views with name, layout type, click to navigate)
- [x] T043 [P] [US3] Create ViewCard component in packages/frontend/src/components/view/ViewCard.tsx (individual view item in list)
- [x] T044 [US3] Update FlowEditor to display ViewList and flow edit form in packages/frontend/src/pages/FlowEditor.tsx
- [x] T045 [US3] Update api.ts to add updateFlow, deleteFlow, listViews, getView, updateView, deleteView, reorderViews, chatWithView functions in packages/frontend/src/lib/api.ts
- [x] T046 [P] [US3] Create ViewEditor page in packages/frontend/src/pages/ViewEditor.tsx (layout: chat panel left, component preview right, reuse existing editor pattern)
- [x] T047 [US3] Adapt existing LayoutRenderer and VisualDisplay for view-scoped rendering in packages/frontend/src/components/editor/
- [x] T048 [US3] Adapt existing ChatPanel for view-scoped chat in packages/frontend/src/components/chat/ChatPanel.tsx
- [x] T049 [US3] Implement add view functionality in FlowEditor in packages/frontend/src/pages/FlowEditor.tsx
- [x] T050 [US3] Implement view reordering UI (drag-drop or up/down buttons) in packages/frontend/src/components/view/ViewList.tsx

**Checkpoint**: User Story 3 complete - users can fully edit flows and views

---

## Phase 6: User Story 4 - Manage Flows List (Priority: P4)

**Goal**: Users can see all flows for an app, navigate to edit them, and delete flows

**Independent Test**: Create multiple flows, verify they appear in app dashboard list, click to navigate, delete a flow, verify removal

### Implementation for User Story 4

- [x] T051 [P] [US4] Create FlowList component in packages/frontend/src/components/flow/FlowList.tsx (display flows with name, description, click to navigate)
- [x] T052 [P] [US4] Create FlowCard component in packages/frontend/src/components/flow/FlowCard.tsx (individual flow item with delete button)
- [x] T053 [US4] Update AppDashboard to display FlowList in packages/frontend/src/pages/AppDashboard.tsx
- [x] T054 [US4] Implement flow deletion with confirmation in FlowCard in packages/frontend/src/components/flow/FlowCard.tsx
- [x] T055 [US4] Implement FlowList → FlowEditor navigation in packages/frontend/src/components/flow/FlowList.tsx

**Checkpoint**: User Story 4 complete - full flow management implemented

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T056 [P] Update MCP service to serve flows as tools (each flow = one MCP tool) in packages/backend/src/mcp/mcp.tool.ts
- [x] T057 [P] Add breadcrumb navigation component for App → Flow → View hierarchy in packages/frontend/src/pages/ViewEditor.tsx (inline implementation)
- [x] T058 Add empty state handling for flows list (no flows yet) in packages/frontend/src/components/flow/FlowList.tsx
- [x] T059 Add empty state handling for views list (should not happen, but defensive) in packages/frontend/src/components/view/ViewList.tsx
- [x] T060 Add loading states and error handling across all pages in packages/frontend/src/pages/
- [x] T061 Validate quickstart.md workflow end-to-end (create app → create flow → edit view → verify) - POC scope
- [x] T062 Clean up unused Editor.tsx page if no longer needed in packages/frontend/src/pages/ (deprecated, route removed)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (shared types) - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories should be done in priority order: US1 → US2 → US3 → US4
  - US2 depends on US1 (needs app to exist)
  - US3 depends on US2 (needs flow to exist)
  - US4 extends US2's flow listing
- **Polish (Phase 7)**: Depends on all user stories being complete

### Within Each User Story

- Backend before frontend (API must exist before UI can call it)
- Services before controllers
- Core implementation before UI integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup):**
- T001, T002, T003 can run in parallel

**Phase 2 (Foundational):**
- T007, T008 can run in parallel (entity creation)
- T011, T012 can run in parallel (module skeletons)

**Phase 3 (US1):**
- T020 can run in parallel with backend tasks

**Phase 4 (US2):**
- T032, T035 can run in parallel

**Phase 5 (US3):**
- T042, T043, T046 can run in parallel

**Phase 6 (US4):**
- T051, T052 can run in parallel

**Phase 7 (Polish):**
- T056, T057 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Backend tasks first (sequential for service→controller dependency):
Task T015: Implement slug generation utility
Task T016: Update AppService.create
Task T017: Update AppController.create endpoint
Task T018: Add getById and getBySlug methods
Task T019: Add GET /apps/:appId endpoint

# Frontend tasks (T020 parallel with backend, T021+ after API ready):
Task T020: [P] Create AppForm component
Task T021: Modify Home page to show AppForm
Task T022: Update api.ts
Task T023: Create AppDashboard page skeleton
Task T024: Implement navigation
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (entities, modules)
3. Complete Phase 3: User Story 1 (create app)
4. **STOP and VALIDATE**: Test app creation → dashboard flow
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test app creation → Deploy/Demo (MVP!)
3. Add User Story 2 → Test flow creation via AI → Deploy/Demo
4. Add User Story 3 → Test flow/view editing → Deploy/Demo
5. Add User Story 4 → Test flow management → Deploy/Demo
6. Polish → Final validation

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (User Story 1)**

This delivers:
- App creation form on home page
- Slug-based URL routing
- App dashboard (ready for flows in next increment)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story builds on previous but adds independent value
- POC scope: No automated tests per constitution
- Backend uses TypeORM auto-sync, no migrations needed
- Commit after each task or logical group
