# Tasks: Manual Node Connection Workflow

**Input**: Design documents from `/specs/018-node-connection/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not required (POC phase - manual testing acceptable per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (monorepo)**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup required - existing project structure is sufficient

All infrastructure already exists. Proceeding directly to foundational tasks.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend validation that MUST be complete before frontend work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 Add circular connection detection helper method `wouldCreateCycle()` in packages/backend/src/node/node.service.ts
- [X] T002 Add self-connection validation (sourceNodeId !== targetNodeId) in packages/backend/src/node/node.service.ts
- [X] T003 Integrate circular and self-connection checks into `addConnection()` method in packages/backend/src/node/node.service.ts

**Checkpoint**: Backend validation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Create Unconnected Nodes (Priority: P1) 🎯 MVP

**Goal**: Nodes appear on canvas without automatic connections when created

**Independent Test**: Create multiple nodes and verify none have automatic connections between them

### Implementation for User Story 1

- [X] T004 [US1] Remove automatic edge generation between UserIntent and first node in packages/frontend/src/components/flow/FlowDiagram.tsx
- [X] T005 [US1] Remove automatic edge generation between consecutive Interface nodes in packages/frontend/src/components/flow/FlowDiagram.tsx
- [X] T006 [US1] Remove automatic edge generation from last Interface to add-step button in packages/frontend/src/components/flow/FlowDiagram.tsx
- [X] T007 [US1] Update node positioning logic to place new nodes at calculated offset (rightmost + 280px) in packages/frontend/src/components/flow/FlowDiagram.tsx
- [X] T008 [US1] Keep only user-created connections (from flow.connections) as edges in packages/frontend/src/components/flow/FlowDiagram.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - nodes appear without auto-connections

---

## Phase 4: User Story 2 - Manual Connection Creation (Priority: P1)

**Goal**: Users can drag between handles to create connections manually

**Independent Test**: Create two nodes, drag from one handle to another, verify connection is created and saved

### Implementation for User Story 2

- [X] T009 [P] [US2] Add output handle (right side, id="output") to UserIntentNode in packages/frontend/src/components/flow/UserIntentNode.tsx
- [X] T010 [P] [US2] Add input handle (left side, id="input") and output handle (right side, id="output") to ViewNode in packages/frontend/src/components/flow/ViewNode.tsx
- [X] T011 [P] [US2] Add input handle (left side, id="input") to ReturnValueNode in packages/frontend/src/components/flow/ReturnValueNode.tsx
- [X] T012 [P] [US2] Add input handle (left side, id="input") to CallFlowNode in packages/frontend/src/components/flow/CallFlowNode.tsx
- [X] T013 [US2] Update `isValidConnection` callback to prevent circular connections (client-side) in packages/frontend/src/components/flow/FlowDiagram.tsx
- [X] T014 [US2] Update `onConnect` handler to call API and save connection to flow.connections in packages/frontend/src/components/flow/FlowDiagram.tsx
- [X] T015 [US2] Add visual highlighting for valid target handles during drag in packages/frontend/src/components/flow/FlowDiagram.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - nodes are unconnected, users can manually connect them

---

## Phase 5: User Story 3 - Delete Connection on Hover (Priority: P2)

**Goal**: Trash icon appears on hover, click deletes connection without confirmation

**Independent Test**: Create a connection, hover over it, verify trash icon appears, click it, verify connection is deleted

### Implementation for User Story 3

- [X] T016 [P] [US3] Create DeletableEdge custom edge component with trash icon on hover in packages/frontend/src/components/flow/DeletableEdge.tsx
- [X] T017 [US3] Register DeletableEdge in edgeTypes and set as default edge type in packages/frontend/src/components/flow/FlowDiagram.tsx
- [X] T018 [US3] Implement onDelete handler in DeletableEdge to call API and update state in packages/frontend/src/components/flow/DeletableEdge.tsx
- [X] T019 [US3] Remove existing onEdgeClick confirmation dialog (replace with DeletableEdge approach) in packages/frontend/src/components/flow/FlowDiagram.tsx
- [X] T020 [US3] Add hover styles for trash icon visibility (show on hover, hide otherwise) in packages/frontend/src/components/flow/DeletableEdge.tsx

**Checkpoint**: User Stories 1, 2, AND 3 should now work independently - full connection management UI

---

## Phase 6: User Story 4 - Sequential Execution of Connected Nodes (Priority: P2)

**Goal**: Only nodes connected to user intent are executed, unconnected nodes are ignored

**Independent Test**: Create flow with connected and unconnected nodes, execute flow, verify only connected nodes run

### Implementation for User Story 4

- [X] T021 [US4] Create helper function `getConnectedNodes()` to traverse connection graph from user intent in packages/backend/src/mcp/mcp.tool.ts
- [X] T022 [US4] Update flow execution logic to filter nodes using `getConnectedNodes()` in packages/backend/src/mcp/mcp.tool.ts
- [X] T023 [US4] Ensure execution follows connection order (topological sort) in packages/backend/src/mcp/mcp.tool.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T024 [P] Verify all node types have consistent handle styling (size, color, position) across all node components
- [X] T025 [P] Add "Add Step" button that remains visible for adding new unconnected nodes in packages/frontend/src/components/flow/FlowDiagram.tsx
- [X] T026 Run quickstart.md validation - test all user scenarios end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped - no changes needed
- **Foundational (Phase 2)**: No dependencies - can start immediately - BLOCKS all frontend user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Phase 2 - No dependencies on other stories
  - User Story 2 (P1): Can start after Phase 2 - No dependencies on other stories
  - User Story 3 (P2): Can start after Phase 2 - No dependencies on other stories (but T19 requires T16-T18)
  - User Story 4 (P2): Can start after Phase 2 - Backend only, independent of frontend stories
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - removes auto-edges
- **User Story 2 (P1)**: Independent - adds manual connection creation (can run parallel with US1)
- **User Story 3 (P2)**: Independent - adds delete on hover (can run parallel with US1, US2)
- **User Story 4 (P2)**: Independent - backend execution logic (can run parallel with all frontend stories)

### Within Each User Story

- T004-T008 (US1): Sequential changes to same file (FlowDiagram.tsx)
- T009-T012 (US2): Parallel (different node component files)
- T013-T015 (US2): Sequential (same file, depends on T009-T012)
- T016, T018, T020 (US3): Sequential (same file - DeletableEdge.tsx)
- T017, T019 (US3): Sequential (FlowDiagram.tsx, after T16 creates DeletableEdge)
- T021-T023 (US4): Sequential (same service file)

### Parallel Opportunities

- **Phase 2**: T001-T003 are sequential (same file)
- **Phase 4** (US2): T009, T010, T011, T012 can run in parallel (different files)
- **User Stories**: US1, US2, US3, US4 can all be worked on in parallel by different developers
- **Phase 7**: T024 and T025 can run in parallel

---

## Parallel Example: User Story 2

```bash
# Launch all handle tasks in parallel:
Task: "T009 Add output handle to UserIntentNode"
Task: "T010 Add input/output handles to ViewNode"
Task: "T011 Add input handle to ReturnValueNode"
Task: "T012 Add input handle to CallFlowNode"

# Then continue with sequential tasks:
Task: "T013 Update isValidConnection callback"
Task: "T014 Update onConnect handler"
Task: "T015 Add visual highlighting for valid targets"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 2: Foundational (backend validation)
2. Complete Phase 3: User Story 1 (nodes appear unconnected)
3. Complete Phase 4: User Story 2 (manual connection creation)
4. **STOP and VALIDATE**: Test creating nodes and connecting them manually
5. Deploy/demo if ready - basic functionality complete

### Incremental Delivery

1. Complete Foundational → Backend ready
2. Add User Story 1 → Test independently → Nodes unconnected
3. Add User Story 2 → Test independently → Can connect nodes manually (MVP!)
4. Add User Story 3 → Test independently → Delete on hover
5. Add User Story 4 → Test independently → Execution respects connections
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Developer A: Phase 2 (backend) → User Story 4
2. Developer B: User Story 1 → User Story 3
3. Developer C: User Story 2 → Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- POC phase: manual testing is acceptable, no automated tests required
