# Tasks: Standardized Execution Metadata and Enhanced Usage UI

**Input**: Design documents from `/specs/001-execution-metadata-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not required (POC phase per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Shared Types**: `packages/shared/src/types/`
- **Node Implementations**: `packages/nodes/src/nodes/`
- **Backend Logic**: `packages/backend/src/`
- **Frontend Components**: `packages/frontend/src/components/execution/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the standardized ExecutionMetadata types that all nodes and UI components will use

- [x] T001 Copy ExecutionMetadata interfaces from contracts to packages/shared/src/types/execution.ts
- [x] T002 Export new types from packages/shared/src/index.ts
- [x] T003 Rebuild shared package with `pnpm --filter @chatgpt-app-builder/shared build`

---

## Phase 2: Foundational (Node Output Standardization)

**Purpose**: Update ALL node types to use the standardized `_execution` metadata format

**⚠️ CRITICAL**: UI enhancements depend on nodes producing consistent output format

### Action Nodes

- [x] T004 [P] Update ApiCallNode output to spread data at root with _execution metadata in packages/nodes/src/nodes/action/ApiCallNode.ts
- [x] T005 Update backend MCP tool handler for ApiCall to not unwrap output in packages/backend/src/mcp/mcp.tool.ts

### Transform Nodes

- [x] T006 [P] Enhance JavaScriptCodeTransform to track durationMs in _execution in packages/nodes/src/nodes/transform/JavaScriptCodeTransform.ts
- [x] T007 [P] Update testTransform service to include durationMs in output in packages/backend/src/node/node.service.ts

### Trigger Nodes

- [x] T008 [P] Update UserIntentNode to include _execution metadata in packages/nodes/src/nodes/trigger/UserIntentNode.ts

### Return Nodes

- [x] T009 [P] Update ReturnNode to include _execution metadata in packages/nodes/src/nodes/return/ReturnNode.ts
- [x] T010 [P] Update CallFlowNode to include _execution metadata in packages/nodes/src/nodes/return/CallFlowNode.ts

### Interface Nodes

- [x] T011 [P] Update StatCardNode to include _execution metadata in packages/nodes/src/nodes/interface/StatCardNode.ts
- [x] T012 [P] Update PostListNode to include _execution metadata in packages/nodes/src/nodes/interface/PostListNode.ts

### Build & Verify

- [x] T013 Rebuild nodes package with `pnpm --filter @chatgpt-app-builder/nodes build`

**Checkpoint**: All nodes now produce standardized output with `_execution` metadata

---

## Phase 3: User Story 1 - View Execution Status at a Glance (Priority: P1) 🎯 MVP

**Goal**: Users see green/red/orange status indicators immediately when viewing the usage tab

**Independent Test**: Trigger a flow, view usage tab, verify colored status indicators visible for each node

### Implementation for User Story 1

- [x] T014 [US1] Create StatusIcon component with green/red/orange indicators in packages/frontend/src/components/execution/StatusIcon.tsx
- [x] T015 [US1] Add backward-compatible status extraction helper function (hasExecutionMetadata check) in packages/frontend/src/components/execution/executionUtils.ts
- [x] T016 [US1] Update NodeExecutionCard header to display StatusIcon based on _execution.success in packages/frontend/src/components/execution/NodeExecutionCard.tsx
- [x] T017 [US1] Update ExecutionListItem to show status indicator for overall execution in packages/frontend/src/components/execution/ExecutionListItem.tsx
- [x] T018 [US1] Update ExecutionStatusBadge to use consistent green/red/orange colors in packages/frontend/src/components/execution/ExecutionStatusBadge.tsx

**Checkpoint**: Status indicators (green success, red error, orange pending) visible at a glance in usage tab

---

## Phase 4: User Story 2 - Access Error Details Quickly (Priority: P1)

**Goal**: Error messages displayed prominently when a node fails, not hidden in collapsed JSON

**Independent Test**: Trigger a flow with failing API call, verify error message visible without expanding data

### Implementation for User Story 2

- [x] T019 [US2] Create ErrorBanner component with red background and warning icon in packages/frontend/src/components/execution/ErrorBanner.tsx
- [x] T020 [US2] Update NodeExecutionCard to display ErrorBanner above collapsed data when _execution.success is false in packages/frontend/src/components/execution/NodeExecutionCard.tsx
- [x] T021 [US2] Add failed node indicator (name + error summary) to ExecutionListItem in packages/frontend/src/components/execution/ExecutionListItem.tsx
- [x] T022 [US2] For ApiCall failures, display HTTP status and URL context in ErrorBanner in packages/frontend/src/components/execution/NodeExecutionCard.tsx

**Checkpoint**: Error messages prominently displayed, users can identify failing node from list view

---

## Phase 5: User Story 3 - Consistent Data Format from All Nodes (Priority: P2)

**Goal**: UI components separate `_execution` metadata from actual output data visually

**Independent Test**: View any node execution detail, verify _execution is displayed separately from output data

### Implementation for User Story 3

- [x] T023 [US3] Update extractOutputData utility to filter out _execution from displayed data in packages/frontend/src/components/execution/executionUtils.ts
- [x] T024 [US3] Update ExecutionDataViewer to exclude _execution from main JSON display in packages/frontend/src/components/execution/ExecutionDataViewer.tsx
- [x] T025 [US3] Add dedicated "Execution Info" section in NodeExecutionCard showing _execution details in packages/frontend/src/components/execution/NodeExecutionCard.tsx

**Checkpoint**: Data and metadata visually separated, _execution not mixed into output data viewer

---

## Phase 6: User Story 4 - Understand Execution Timeline (Priority: P3)

**Goal**: Users see how long each node took to execute

**Independent Test**: Execute a flow, verify duration displayed for each node that tracks timing

### Implementation for User Story 4

- [x] T026 [US4] Create Duration component to format milliseconds nicely (e.g., "234ms", "1.23s", "2m 34s") in packages/frontend/src/components/execution/Duration.tsx
- [x] T027 [US4] Update NodeExecutionCard to display Duration from _execution.durationMs in packages/frontend/src/components/execution/NodeExecutionCard.tsx
- [ ] T028 [US4] Add total flow duration calculation and display to ExecutionDetail header in packages/frontend/src/components/execution/ExecutionDetail.tsx

**Checkpoint**: Execution durations visible for all nodes that track timing

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final integration and verification

- [ ] T029 [P] Start development server with `.specify/scripts/bash/serve-app.sh`
- [ ] T030 [P] Manual verification: Create test flow with ApiCall, Transform, Return nodes
- [ ] T031 [P] Manual verification: Execute flow successfully - verify green indicators
- [ ] T032 [P] Manual verification: Trigger API failure - verify red indicator and error banner
- [ ] T033 [P] Manual verification: Verify backward compatibility with existing executions in database
- [ ] T034 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user story phases
- **Phase 3-6 (User Stories)**: All depend on Phase 2 completion
  - US1 and US2 are both P1 priority - can proceed in parallel
  - US3 depends on US1 (needs StatusIcon)
  - US4 can proceed independently
- **Phase 7 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Phase 2 - Can proceed in parallel with US1
- **User Story 3 (P2)**: Can start after Phase 2 - References StatusIcon from US1
- **User Story 4 (P3)**: Can start after Phase 2 - Independent of other stories

### Within Each User Story

- Components before integration
- Utilities before components that use them
- Header changes before data changes

### Parallel Opportunities

**Phase 2 (Foundational)**:
- T004, T006, T007, T008, T009, T010, T011, T012 can all run in parallel (different node files)

**Phase 3-6 (User Stories)**:
- US1 and US2 can be worked in parallel (different components)
- US4 is fully independent and can proceed in parallel with any story

---

## Parallel Example: Phase 2 Node Updates

```bash
# Launch all node updates in parallel:
Task: "Update ApiCallNode output in packages/nodes/src/nodes/action/ApiCallNode.ts"
Task: "Enhance JavaScriptCodeTransform durationMs in packages/nodes/src/nodes/transform/JavaScriptCodeTransform.ts"
Task: "Update UserIntentNode in packages/nodes/src/nodes/trigger/UserIntentNode.ts"
Task: "Update ReturnNode in packages/nodes/src/nodes/return/ReturnNode.ts"
Task: "Update CallFlowNode in packages/nodes/src/nodes/return/CallFlowNode.ts"
Task: "Update StatCardNode in packages/nodes/src/nodes/interface/StatCardNode.ts"
Task: "Update PostListNode in packages/nodes/src/nodes/interface/PostListNode.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (all node updates) - **CRITICAL**
3. Complete Phase 3: US1 - Status indicators visible
4. Complete Phase 4: US2 - Error messages prominent
5. **STOP and VALIDATE**: Can identify success/failure at a glance
6. Deploy/demo the MVP

### Incremental Delivery

1. Setup + Foundational → All nodes produce consistent output
2. Add US1 → Green/red/orange indicators visible → Deploy
3. Add US2 → Error messages prominent → Deploy
4. Add US3 → Data/metadata separation → Deploy
5. Add US4 → Duration display → Deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- JavaScriptCodeTransform already has partial _execution support (from earlier fix) - enhance with durationMs
- Backward compatibility: UI must detect old format and fall back gracefully
- Constitution: No automated tests required (POC phase)
- Commit after each phase or logical group
