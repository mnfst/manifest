# Tasks: Flow Execution Tracking

**Input**: Design documents from `/specs/001-flow-executions/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Not required (POC phase per constitution - testing deferred)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `packages/backend/src/`
- **Frontend**: `packages/frontend/src/`
- **Shared**: `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new module structure and shared types

- [x] T001 [P] Create shared execution types in packages/shared/src/types/execution.ts
- [x] T002 [P] Export execution types from packages/shared/src/index.ts
- [x] T003 Create flow-execution module directory at packages/backend/src/flow-execution/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create FlowExecutionEntity in packages/backend/src/flow-execution/flow-execution.entity.ts per data-model.md
- [x] T005 Create FlowExecutionModule in packages/backend/src/flow-execution/flow-execution.module.ts
- [x] T006 Register FlowExecutionModule and FlowExecutionEntity in packages/backend/src/app/app.module.ts
- [x] T007 Create FlowExecutionService in packages/backend/src/flow-execution/flow-execution.service.ts with createExecution, updateExecution, findByFlow, findOne methods
- [x] T008 Create FlowExecutionController in packages/backend/src/flow-execution/flow-execution.controller.ts with GET /api/flows/:flowId/executions and GET /api/flows/:flowId/executions/:executionId endpoints
- [x] T009 Integrate FlowExecutionService into McpToolService in packages/backend/src/mcp/mcp.tool.ts - wrap executeTool() with execution lifecycle
- [x] T010 Add execution API methods to packages/frontend/src/lib/api.ts (getExecutions, getExecution)

**Checkpoint**: Foundation ready - backend captures executions, frontend can fetch them

---

## Phase 3: User Story 1 - View Flow Execution History (Priority: P1)

**Goal**: Users can see a history of all executions for their flows in the "Usage" tab with two-column layout

**Independent Test**: Execute a flow via MCP, then view the Usage tab and verify execution appears in the list with status indicator, start time, duration, and first parameter preview

### Implementation for User Story 1

- [x] T011 [P] [US1] Create ExecutionStatusBadge component in packages/frontend/src/components/execution/ExecutionStatusBadge.tsx with colored circles (green/orange/red) and tooltip
- [x] T012 [P] [US1] Create ExecutionListItem component in packages/frontend/src/components/execution/ExecutionListItem.tsx displaying status, start time, duration, first param preview
- [x] T013 [US1] Create Pagination component in packages/frontend/src/components/common/Pagination.tsx with page numbers and prev/next buttons
- [x] T014 [US1] Create ExecutionList component in packages/frontend/src/components/execution/ExecutionList.tsx with paginated list using ExecutionListItem and Pagination
- [x] T015 [US1] Create ExecutionEmptyState component in packages/frontend/src/components/execution/ExecutionEmptyState.tsx for "no executions yet" message
- [x] T016 [US1] Integrate ExecutionList into FlowDetail.tsx Usage tab in packages/frontend/src/pages/FlowDetail.tsx - left panel of two-column layout

**Checkpoint**: User Story 1 complete - users can view execution history list with status, time, and pagination

---

## Phase 4: User Story 2 - Inspect Execution Details (Priority: P2)

**Goal**: Users can click on an execution in the list and see its details (initial params, node-by-node data, error info) in the right panel

**Independent Test**: Click on an execution in the list and verify the right panel displays initial parameters, node execution data, and error information (if applicable)

### Implementation for User Story 2

- [x] T017 [P] [US2] Create ExecutionDataViewer component in packages/frontend/src/components/execution/ExecutionDataViewer.tsx for displaying JSON data with proper formatting
- [x] T018 [P] [US2] Create NodeExecutionCard component in packages/frontend/src/components/execution/NodeExecutionCard.tsx showing individual node execution with status, input/output data
- [x] T019 [US2] Create ExecutionDetail component in packages/frontend/src/components/execution/ExecutionDetail.tsx displaying full execution details including initial params, node executions array, and error info
- [x] T020 [US2] Create ExecutionDetailPlaceholder component in packages/frontend/src/components/execution/ExecutionDetailPlaceholder.tsx for "select an execution" prompt
- [x] T021 [US2] Integrate ExecutionDetail into FlowDetail.tsx Usage tab in packages/frontend/src/pages/FlowDetail.tsx - right panel of two-column layout with selection state

**Checkpoint**: User Story 2 complete - users can view full execution details with node-by-node data

---

## Phase 5: User Story 3 - Track Execution Status in Real-Time (Priority: P3)

**Goal**: Users can see the current status of ongoing executions update automatically without page refresh

**Independent Test**: Trigger a flow execution, observe the Usage tab, and verify status updates from pending to fulfilled/error without manual refresh

### Implementation for User Story 3

- [x] T022 [US3] Add hasPendingExecutions flag to execution list API response in packages/backend/src/flow-execution/flow-execution.service.ts
- [x] T023 [US3] Implement polling logic in ExecutionList component in packages/frontend/src/components/execution/ExecutionList.tsx - poll every 3 seconds when pending executions exist and tab is active
- [x] T024 [US3] Add useExecutionPolling hook in packages/frontend/src/hooks/useExecutionPolling.ts to manage polling lifecycle

**Checkpoint**: User Story 3 complete - real-time status updates via polling

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and improvements that affect multiple user stories

- [x] T025 [P] Add timeout handling in FlowExecutionService in packages/backend/src/flow-execution/flow-execution.service.ts - mark pending executions > 5 minutes as error on query
- [x] T026 [P] Handle flow deletion gracefully - verify SET NULL works and flowName is preserved (verify via manual test)
- [x] T027 Ensure loading states in ExecutionList and ExecutionDetail components
- [ ] T028 Run quickstart.md manual testing checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (P1 -> P2 -> P3)
  - Or P1 and P2 can run in parallel (different files), then P3
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 list component for selection
- **User Story 3 (P3)**: Depends on User Story 1 (needs ExecutionList component for polling integration)

### Within Each User Story

- Components marked [P] can be developed in parallel
- Integration tasks depend on component completion
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
```
T001 (shared types) || T002 (exports) || T003 (directory)
```

**Phase 2 (Foundational)**: Sequential - entity -> module -> service -> controller -> MCP integration

**Phase 3 (US1)**:
```
T011 (StatusBadge) || T012 (ListItem) -> T013 (Pagination) -> T014 (List) -> T015 (Empty) -> T016 (Integration)
```

**Phase 4 (US2)**:
```
T017 (DataViewer) || T018 (NodeCard) -> T019 (Detail) -> T020 (Placeholder) -> T021 (Integration)
```

**Phase 5 (US3)**: Sequential - T022 -> T023 -> T024

**Phase 6 (Polish)**:
```
T025 (timeout) || T026 (deletion) -> T027 (loading) -> T028 (validation)
```

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Launch StatusBadge and ListItem in parallel:
Task: "Create ExecutionStatusBadge in packages/frontend/src/components/execution/ExecutionStatusBadge.tsx"
Task: "Create ExecutionListItem in packages/frontend/src/components/execution/ExecutionListItem.tsx"

# Then Pagination (depends on UI patterns):
Task: "Create Pagination in packages/frontend/src/components/common/Pagination.tsx"

# Then ExecutionList (depends on ListItem and Pagination):
Task: "Create ExecutionList in packages/frontend/src/components/execution/ExecutionList.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently via quickstart.md checklist
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Test independently -> Deploy/Demo (MVP!)
3. Add User Story 2 -> Test independently -> Deploy/Demo
4. Add User Story 3 -> Test independently -> Deploy/Demo
5. Each story adds value without breaking previous stories

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (User Story 1)**

This delivers:
- Execution tracking on all MCP invocations
- Visible execution history in Usage tab
- Status indicators and pagination
- Immediate value: users can see flow usage patterns

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after foundational phase
- Testing deferred per POC constitution - use quickstart.md manual checklist
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
