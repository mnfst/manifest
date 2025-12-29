# Tasks: UI Component Actions

**Input**: Design documents from `/specs/015-ui-actions/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT required (POC phase per constitution - testing deferred)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared types and interfaces that all stories depend on

- [x] T001 [P] Add LayoutAction interface and extend LAYOUT_REGISTRY with actions array in packages/shared/src/types/app.ts
- [x] T002 [P] Create ActionConnection shared types in packages/shared/src/types/action-connection.ts
- [x] T003 Export new types from packages/shared/src/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend entity and API that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create ActionConnectionEntity in packages/backend/src/action-connection/action-connection.entity.ts
- [x] T005 Create ActionConnectionService with CRUD operations in packages/backend/src/action-connection/action-connection.service.ts
- [x] T006 Create ActionConnectionController with REST endpoints in packages/backend/src/action-connection/action-connection.controller.ts
- [x] T007 Create ActionConnectionModule in packages/backend/src/action-connection/action-connection.module.ts
- [x] T008 Register ActionConnectionEntity and ActionConnectionModule in packages/backend/src/app/app.module.ts
- [x] T009 Add action connection API functions in packages/frontend/src/lib/api.ts

**Checkpoint**: Foundation ready - Backend API responds to `/api/views/:viewId/action-connections`

---

## Phase 3: User Story 1 - View Component Actions in Flow Diagram (Priority: P1)

**Goal**: Display action handles on view nodes so users can see available actions for each UI component

**Independent Test**: Open a flow with a post-list view and verify "onReadMore" action handle appears on the right edge of the ViewNode

### Implementation for User Story 1

- [x] T010 [US1] Import LAYOUT_REGISTRY and lookup actions for view's layoutTemplate in packages/frontend/src/components/flow/ViewNode.tsx
- [x] T011 [US1] Add action handles section with source handles for each action (right side, labeled) in packages/frontend/src/components/flow/ViewNode.tsx
- [x] T012 [US1] Call useUpdateNodeInternals when actions change dynamically in packages/frontend/src/components/flow/ViewNode.tsx
- [x] T013 [US1] Style action handles with purple color (#a855f7) consistent with call flow styling in packages/frontend/src/components/flow/ViewNode.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - action handles visible on post-list views

---

## Phase 4: User Story 2 - Connect Action to Return Value (Priority: P2)

**Goal**: Allow users to drag connections from action handles to return value nodes and execute the return value when action is triggered

**Independent Test**: Connect onReadMore to a return value, execute the MCP tool, click "Read more" in the widget, and verify return value content is sent back

### Implementation for User Story 2

- [x] T014 [US2] Fetch action connections for flow from API in packages/frontend/src/pages/FlowDetail.tsx and packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T015 [US2] Generate action connection edges from sourceHandle (action name) to return value nodes in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T016 [US2] Add left target handle to ReturnValueNode for incoming action connections in packages/frontend/src/components/flow/ReturnValueNode.tsx
- [x] T017 [US2] Implement onConnect handler to detect action handle connections and call API in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T018 [US2] Add isValidConnection check to allow action handles to connect only to valid targets in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T019 [US2] Inject action trigger data attributes in widget HTML for post-list component in packages/backend/src/mcp/mcp.tool.ts
- [x] T020 [US2] Add JavaScript handler script for action triggers in widget output in packages/backend/src/mcp/mcp.tool.ts
- [x] T021 [US2] Look up ActionConnection and execute return value target when action is triggered in packages/backend/src/mcp/mcp.tool.ts

**Checkpoint**: User Story 2 complete - can connect actions to return values and trigger them from widget

---

## Phase 5: User Story 3 - Connect Action to Call Flow (Priority: P3)

**Goal**: Allow users to drag connections from action handles to call flow nodes and trigger the target flow when action is clicked

**Independent Test**: Connect an action to a call flow, trigger the action, and verify the target flow executes

### Implementation for User Story 3

- [x] T022 [US3] Add left target handle to CallFlowNode for incoming action connections in packages/frontend/src/components/flow/CallFlowNode.tsx
- [x] T023 [US3] Update isValidConnection to allow action handles to connect to call flow nodes in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T024 [US3] Generate action connection edges to call flow nodes in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T025 [US3] Execute call flow target when action is triggered (extend T021 logic) in packages/backend/src/mcp/mcp.tool.ts

**Checkpoint**: User Story 3 complete - can connect actions to both return values AND call flows

---

## Phase 6: User Story 4 - Disconnect or Reconfigure Action (Priority: P4)

**Goal**: Allow users to delete existing connections or replace them with new targets

**Independent Test**: Create a connection, then create a new one from the same action to a different target, verify only the new connection exists

### Implementation for User Story 4

- [x] T026 [US4] Add edge deletion UI (click) for action connection edges in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T027 [US4] Call DELETE API when action connection edge is removed in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T028 [US4] Handle replace behavior: backend API replaces existing connection for same viewId+actionName
- [x] T029 [US4] Handle graceful no-op when unconnected action is triggered (handleOnReadMore=null) in packages/backend/src/mcp/mcp.tool.ts
- [x] T030 [US4] Visual indicator for orphaned connections (edges skip targets that don't exist) in packages/frontend/src/components/flow/FlowDiagram.tsx

**Checkpoint**: User Story 4 complete - can delete, replace, and handle disconnected actions gracefully

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and improvements that affect multiple user stories

- [x] T031 [P] Update action handles when view's layoutTemplate changes (useUpdateNodeInternals re-renders) in packages/frontend/src/components/flow/ViewNode.tsx
- [x] T032 [P] Handle cleanup of action connections when view is deleted (onDelete: CASCADE) in packages/backend/src/action-connection/action-connection.entity.ts
- [x] T033 Run quickstart.md validation checklist (lint passes, build OK)
- [x] T034 Verify backward compatibility - existing flows without actions work unchanged (no breaking changes to existing types/APIs)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories should proceed sequentially in priority order (P1 → P2 → P3 → P4)
  - US2, US3, US4 build on previous stories
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Independently testable
- **User Story 2 (P2)**: Depends on US1 (needs action handles to connect from)
- **User Story 3 (P3)**: Depends on US2 (extends the connection pattern)
- **User Story 4 (P4)**: Depends on US2/US3 (needs connections to delete/replace)

### Within Each User Story

- Frontend changes can proceed in parallel with backend changes for different stories
- Models before services before controllers (already sequenced in Foundational)
- Core implementation before edge cases

### Parallel Opportunities

**Phase 1 (all parallel):**
```
Task: T001 - LayoutAction interface in packages/shared/src/types/app.ts
Task: T002 - ActionConnection types in packages/shared/src/types/action-connection.ts
```

**Phase 2 (sequential - entity before service before controller):**
```
T004 → T005 → T006 → T007 → T008 → T009
```

**Phase 3 US1 (sequential - all in same file):**
```
T010 → T011 → T012 → T013
```

**Phase 7 Polish (parallel - different files):**
```
Task: T031 - ViewNode.tsx template change handling
Task: T032 - Service cascade cleanup
```

---

## Parallel Example: Phase 1

```bash
# Launch all shared types tasks together:
Task: "Add LayoutAction interface and extend LAYOUT_REGISTRY in packages/shared/src/types/app.ts"
Task: "Create ActionConnection shared types in packages/shared/src/types/action-connection.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Verify action handles appear on post-list views
5. Demo: Show users can see available actions

### Incremental Delivery

1. Complete Setup + Foundational → Backend API ready
2. Add User Story 1 → Action handles visible → Demo visibility feature
3. Add User Story 2 → Return value connections work → Demo interactive actions
4. Add User Story 3 → Call flow connections work → Demo multi-flow workflows
5. Add User Story 4 → Full editing capability → Complete feature

### Sequential Team Strategy

Due to story dependencies:
1. Complete Setup + Foundational together
2. User Story 1 (P1) - prerequisite for all others
3. User Story 2 (P2) - core connection functionality
4. User Story 3 (P3) - extends to call flows
5. User Story 4 (P4) - editing and edge cases
6. Polish phase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Testing deferred per POC constitution - manual validation via quickstart.md
- US1 is independently testable; US2-4 build progressively
- Backend uses TypeORM auto-sync (synchronize: true) - no migrations needed
- Purple edge color (#a855f7) for action connections (consistent with call flows)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
