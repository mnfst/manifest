# Tasks: Flow Return Value Support

**Input**: Design documents from `/specs/001-flow-return-value/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are deferred for POC phase (manual testing only).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared types and base entity that all stories depend on

- [x] T001 [P] Create ReturnValue types in packages/shared/src/types/return-value.ts
- [x] T002 [P] Add returnValues to Flow type in packages/shared/src/types/flow.ts
- [x] T003 Export return-value types from packages/shared/src/types/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create ReturnValueEntity in packages/backend/src/return-value/return-value.entity.ts
- [x] T005 Add OneToMany returnValues relation to FlowEntity in packages/backend/src/flow/flow.entity.ts
- [x] T006 Create ReturnValueService with CRUD operations in packages/backend/src/return-value/return-value.service.ts
- [x] T007 Update FlowService to load returnValues relation in packages/backend/src/flow/flow.service.ts
- [x] T008 Create ReturnValueController with REST endpoints in packages/backend/src/return-value/return-value.controller.ts
- [x] T009 Create ReturnValueModule in packages/backend/src/return-value/return-value.module.ts
- [x] T010 Import ReturnValueModule in packages/backend/src/app.module.ts

**Checkpoint**: Backend CRUD for return values is functional via REST API

---

## Phase 3: User Story 1 - Add Return Value Step to Flow (Priority: P1)

**Goal**: Users can create and edit return value steps in flows through the UI

**Independent Test**: Create a new flow, fill user intent, click "Add next step", select "Return value", edit text, save, and verify persistence

### Implementation for User Story 1

- [x] T011 [P] [US1] Add return value API methods to packages/frontend/src/lib/api.ts (listReturnValues, createReturnValue, getReturnValue, updateReturnValue, deleteReturnValue, reorderReturnValues)
- [x] T012 [P] [US1] Rename AddViewNode.tsx to AddStepNode.tsx and update text from "Create your first view" to "Add next step" in packages/frontend/src/components/flow/AddStepNode.tsx
- [x] T013 [P] [US1] Create StepTypeDrawer component with View and Return value options in packages/frontend/src/components/flow/StepTypeDrawer.tsx
- [x] T014 [P] [US1] Create ReturnValueEditor component with textarea for text editing in packages/frontend/src/components/flow/ReturnValueEditor.tsx
- [x] T015 [P] [US1] Create ReturnValueNode component for flow diagram display in packages/frontend/src/components/flow/ReturnValueNode.tsx
- [x] T016 [US1] Update FlowDiagram to register AddStepNode and ReturnValueNode types in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T017 [US1] Integrate StepTypeDrawer and return value creation in packages/frontend/src/pages/FlowDetail.tsx
- [x] T018 [US1] Add return value editing modal/drawer integration in packages/frontend/src/pages/FlowDetail.tsx

**Checkpoint**: User Story 1 is fully functional - users can create, view, edit, and save return values through the UI

---

## Phase 4: User Story 2 - MCP Tool Returns Text to LLM (Priority: P1)

**Goal**: When an LLM calls a tool with return values, the system returns all configured text content following MCP protocol

**Independent Test**: Configure a flow with return values, make an MCP tool call, verify response format has content array with text items

### Implementation for User Story 2

- [x] T019 [US2] Modify McpToolService.executeTool to check for returnValues and return MCP text content format in packages/backend/src/mcp/mcp.tool.ts
- [x] T020 [US2] Ensure multiple return values are returned as separate content items in order in packages/backend/src/mcp/mcp.tool.ts

**Checkpoint**: User Story 2 is fully functional - MCP tool calls return text content for flows with return values

---

## Phase 5: User Story 3 - Choose Between View and Return Value (Priority: P2)

**Goal**: Users can choose between View and Return value when adding steps, with mutual exclusivity enforced

**Independent Test**: Create a flow with views, verify cannot add return value; create a flow with return values, verify cannot add view

### Implementation for User Story 3

- [x] T021 [US3] Add mutual exclusivity validation in ReturnValueService.create to reject if flow has views in packages/backend/src/return-value/return-value.service.ts
- [x] T022 [US3] Add mutual exclusivity validation in ViewService.create to reject if flow has returnValues in packages/backend/src/view/view.service.ts
- [x] T023 [US3] Update StepTypeDrawer to show appropriate options based on existing flow steps in packages/frontend/src/components/flow/StepTypeDrawer.tsx
- [x] T024 [US3] Handle API errors for mutual exclusivity violations in packages/frontend/src/pages/FlowDetail.tsx

**Checkpoint**: User Story 3 is fully functional - mutual exclusivity is enforced both in UI and API

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [x] T025 [P] Add visual indicator for empty/unconfigured return values in packages/frontend/src/components/flow/ReturnValueNode.tsx
- [x] T026 [P] Add support for reordering return values in the diagram in packages/frontend/src/components/flow/FlowDiagram.tsx (Skipped for POC - API exists, UI deferred)
- [x] T027 [P] Add delete confirmation for return values in packages/frontend/src/pages/FlowDetail.tsx
- [x] T028 Run manual testing checklist from quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) can proceed in sequence
  - US3 (P2) can start after Foundational but integrates with US1
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core UI functionality
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Backend MCP integration
- **User Story 3 (P2)**: Depends on US1 components existing for UI integration

### Within Each User Story

- Models before services
- Services before controllers
- Backend before frontend (for API-dependent tasks)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
```bash
# Can run in parallel:
T001: Create ReturnValue types
T002: Add returnValues to Flow type
```

**Phase 3 (User Story 1)**:
```bash
# Can run in parallel (different files):
T011: API methods in api.ts
T012: AddStepNode rename
T013: StepTypeDrawer component
T014: ReturnValueEditor component
T015: ReturnValueNode component
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (backend entity + CRUD)
3. Complete Phase 3: User Story 1 (UI for creating/editing)
4. Complete Phase 4: User Story 2 (MCP execution)
5. **STOP and VALIDATE**: Test end-to-end flow
6. Deploy/demo if ready

### Full Feature

1. Complete MVP (US1 + US2)
2. Add User Story 3 (mutual exclusivity)
3. Add Phase 6: Polish
4. Run full manual testing checklist

---

## Summary

| Phase | Tasks | Parallel Tasks |
|-------|-------|----------------|
| Phase 1: Setup | 3 | 2 |
| Phase 2: Foundational | 7 | 0 |
| Phase 3: User Story 1 | 8 | 5 |
| Phase 4: User Story 2 | 2 | 0 |
| Phase 5: User Story 3 | 4 | 0 |
| Phase 6: Polish | 4 | 3 |
| **Total** | **28** | **10** |

### Tasks per User Story

- US1 (Add Return Value Step): 8 tasks
- US2 (MCP Tool Returns Text): 2 tasks
- US3 (Choose Between View/Return Value): 4 tasks

### MVP Scope

User Stories 1 + 2 (Phases 1-4): **20 tasks**

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- POC phase: manual testing only, no automated tests required
