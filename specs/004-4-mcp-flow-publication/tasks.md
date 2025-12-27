# Tasks: MCP Flow Publication

**Input**: Design documents from `/specs/004-4-mcp-flow-publication/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/

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

**Purpose**: Shared type updates needed by multiple components

- [x] T001 Add isActive field to Flow interface in packages/shared/src/types/flow.ts
- [x] T002 Add isActive to UpdateFlowRequest interface in packages/shared/src/types/flow.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend entity and service changes that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add isActive column to FlowEntity in packages/backend/src/flow/flow.entity.ts (boolean, default true)
- [x] T004 Update FlowService.update() to support isActive field in packages/backend/src/flow/flow.service.ts
- [x] T005 Update FlowService.entityToFlow() to include isActive in response in packages/backend/src/flow/flow.service.ts
- [x] T006 Update McpToolService.listTools() to filter by isActive=true in packages/backend/src/mcp/mcp.tool.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Toggle Flow Active Status (Priority: P1) 🎯 MVP

**Goal**: Users can toggle whether a flow is active or inactive, controlling tool visibility on MCP server

**Independent Test**: Navigate to flow detail page, toggle active switch, verify MCP server only shows active flows

### Implementation for User Story 1

- [x] T007 [P] [US1] Add updateFlow function to frontend API client in packages/frontend/src/lib/api.ts
- [x] T008 [P] [US1] Create FlowActiveToggle component in packages/frontend/src/components/flow/FlowActiveToggle.tsx (toggle switch with label)
- [x] T009 [US1] Integrate FlowActiveToggle into FlowDetail page in packages/frontend/src/pages/FlowDetail.tsx
- [x] T010 [US1] Add loading and error states for toggle in packages/frontend/src/pages/FlowDetail.tsx

**Checkpoint**: User Story 1 complete - users can toggle flow active status

---

## Phase 4: User Story 2 - Publish/Unpublish App (Priority: P2)

**Goal**: Users can publish or unpublish their app to control MCP server accessibility

**Independent Test**: On app detail page, click Publish button, verify MCP endpoint is accessible. Click Unpublish, verify 404.

### Implementation for User Story 2

- [x] T011 [P] [US2] Add status field to UpdateAppRequest in packages/shared/src/types/app.ts
- [x] T012 [P] [US2] Update AppService.update() to support status field in packages/backend/src/app/app.service.ts
- [x] T013 [P] [US2] Add publishApp function to frontend API client in packages/frontend/src/lib/api.ts
- [x] T014 [US2] Create PublishButton component in packages/frontend/src/components/app/PublishButton.tsx (shows Publish/Unpublish based on status)
- [x] T015 [US2] Integrate PublishButton into AppDetail page in packages/frontend/src/pages/AppDetail.tsx
- [x] T016 [US2] Add MCP endpoint URL display when published in packages/frontend/src/pages/AppDetail.tsx

**Checkpoint**: User Story 2 complete - users can publish/unpublish apps

---

## Phase 5: User Story 3 - App Landing Page (Priority: P3)

**Goal**: Published apps have a landing page with ChatGPT integration instructions

**Independent Test**: Publish an app, navigate to /servers/{slug}, verify landing page displays with instructions

### Implementation for User Story 3

- [x] T017 [P] [US3] Create landing page HTML template in packages/backend/src/mcp/templates/landing.html
- [x] T018 [US3] Add GET /servers/:slug endpoint for landing page in packages/backend/src/mcp/ui.controller.ts
- [x] T019 [US3] Include app name, description, MCP URL, and ChatGPT instructions in landing page
- [x] T020 [US3] Display list of active tools on landing page in packages/backend/src/mcp/ui.controller.ts
- [x] T021 [US3] Return 404 for draft apps on landing page endpoint in packages/backend/src/mcp/ui.controller.ts

**Checkpoint**: User Story 3 complete - landing page available for published apps

---

## Phase 6: User Story 4 - MCP Server Protocol Compliance (Priority: P4)

**Goal**: MCP server correctly filters by active flows and rejects calls to inactive tools

**Independent Test**: Connect MCP client, verify tools/list returns only active flows, verify tools/call rejects inactive tools

### Implementation for User Story 4

- [x] T022 [US4] Update McpToolService.executeTool() to check isActive before execution in packages/backend/src/mcp/mcp.tool.ts
- [x] T023 [US4] Return proper MCP error (-32602) for inactive tool calls in packages/backend/src/mcp/mcp.tool.ts
- [x] T024 [US4] Ensure GET /servers/:slug/mcp returns 404 for draft apps in packages/backend/src/mcp/ui.controller.ts
- [x] T025 [US4] Ensure GET /servers/:slug/ui/* returns 404 for draft apps in packages/backend/src/mcp/ui.controller.ts

**Checkpoint**: User Story 4 complete - MCP server is protocol compliant

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and validation

- [x] T026 Handle app with no flows (return empty tools array) in packages/backend/src/mcp/mcp.tool.ts
- [x] T027 Handle app with all inactive flows (return empty tools array) in packages/backend/src/mcp/mcp.tool.ts
- [x] T028 Validate quickstart.md workflow end-to-end (toggle flow → publish app → check landing page → check MCP endpoint)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (shared types needed) - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1): Can start immediately after Phase 2
  - US2 (P2): Can run in parallel with US1 (different files)
  - US3 (P3): Can run in parallel with US1/US2 (different files)
  - US4 (P4): Depends on Phase 2 completion, can run in parallel with other stories
- **Polish (Phase 7)**: Depends on all user stories being complete

### Within Each User Story

- Parallel tasks can be done simultaneously
- Backend changes before frontend integration
- Core functionality before polish

### Parallel Opportunities

**Phase 3 (US1):**
- T007, T008 can run in parallel (different files - api.ts vs component)

**Phase 4 (US2):**
- T011, T012, T013 can run in parallel (different packages/files)

**Phase 5 (US3):**
- T017 can run in parallel with other stories (new template file)

---

## Parallel Example: Phase 4 (User Story 2)

```bash
# Launch parallel type and service updates:
Task T011: "Add status field to UpdateAppRequest in packages/shared/src/types/app.ts"
Task T012: "Update AppService.update() to support status in packages/backend/src/app/app.service.ts"
Task T013: "Add publishApp function to frontend API in packages/frontend/src/lib/api.ts"

# Then sequential frontend integration:
Task T014: "Create PublishButton component" (depends on T013)
Task T015: "Integrate PublishButton into AppDetail" (depends on T014)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (shared types)
2. Complete Phase 2: Foundational (entity + service updates)
3. Complete Phase 3: User Story 1 (toggle flow active)
4. **STOP and VALIDATE**: Toggle flows, check MCP tools/list filtering
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test toggle → Deploy/Demo (MVP!)
3. Add User Story 2 → Test publish/unpublish → Deploy/Demo
4. Add User Story 3 → Test landing page → Deploy/Demo
5. Add User Story 4 → Test protocol compliance → Deploy/Demo
6. Polish → Final validation

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (User Story 1)**

This delivers:
- isActive field on flows
- Toggle UI in flow detail page
- MCP server filters active flows only
- Immediate value for controlling tool visibility

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story builds on previous but adds independent value
- POC scope: No automated tests per constitution
- Commit after each task or logical group
