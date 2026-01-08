# Tasks: UI Node Actions

**Input**: Design documents from `/specs/090-ui-node-actions/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: POC phase - no automated tests required per constitution

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/nodes/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and shared foundation for the feature

- [x] T001 [P] Add 'post-list' to LayoutTemplate union type in packages/shared/src/types/app.ts
- [x] T002 [P] Add 'PostList' to NodeType union type in packages/shared/src/types/node.ts
- [x] T003 Add post-list config to LAYOUT_REGISTRY with onReadMore action in packages/shared/src/types/app.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: PostListNode definition that all user stories depend on

**⚠️ CRITICAL**: User story implementation cannot begin until Phase 2 is complete

- [x] T004 Create PostListNode definition with inputSchema for posts array in packages/nodes/src/nodes/interface/PostListNode.ts
- [x] T005 Add outputSchema for Post object (action output) to PostListNode in packages/nodes/src/nodes/interface/PostListNode.ts
- [x] T006 Set outputs array to ['action:onReadMore'] in PostListNode in packages/nodes/src/nodes/interface/PostListNode.ts
- [x] T007 Export PostListNode from packages/nodes/src/nodes/interface/index.ts
- [x] T008 Register PostListNode in builtInNodes and builtInNodeList in packages/nodes/src/nodes/index.ts

**Checkpoint**: Foundation ready - PostListNode is defined and registered, user story implementation can begin

---

## Phase 3: User Story 1 - Add Post List UI Node with Action (Priority: P1) 🎯 MVP

**Goal**: Flow builders can add a Post List node to their flow with a visible onReadMore action handler, and when connected to downstream nodes, the action triggers execution with Post data

**Independent Test**: Add a Post List node to a flow, connect a Return Value node to its "onReadMore" action handler, run the app, click "Read More" on a post, and verify the Post data is returned

### Implementation for User Story 1

- [x] T009 [US1] Add PostList case to execution switch in packages/backend/src/mcp/mcp.tool.ts (similar to StatCard handling)
- [x] T010 [US1] Create ExecuteActionRequest type with toolName, nodeId, action, data fields in packages/shared/src/types/node.ts
- [x] T011 [US1] Add executeAction endpoint POST /api/apps/:appSlug/actions in packages/backend/src/mcp/mcp.controller.ts
- [x] T012 [US1] Implement executeAction method in packages/backend/src/mcp/mcp.tool.ts that finds downstream nodes from action handle
- [x] T013 [US1] Add getNodesFromActionHandle helper to find nodes connected via action:actionName sourceHandle in packages/backend/src/mcp/mcp.tool.ts
- [x] T014 [US1] Update executeAction to pass action data as input to downstream nodes in packages/backend/src/mcp/mcp.tool.ts
- [x] T015 [US1] Verify ViewNode.tsx correctly renders action handles for post-list template (already implemented, validate works)

**Checkpoint**: User Story 1 complete - Post List node appears in canvas with onReadMore handle, actions trigger downstream execution

---

## Phase 4: User Story 2 - Conditional Flow Execution via Actions (Priority: P2)

**Goal**: Actions create branching execution paths where nodes connected to action handles only execute when that specific action is triggered, not during initial flow execution

**Independent Test**: Create a flow with a Post List node having both regular output and action handle connections, verify action-connected nodes only execute on user action, not on initial trigger

### Implementation for User Story 2

- [x] T016 [US2] Modify getNodesReachableFrom to stop traversal at action handles in packages/backend/src/mcp/mcp.tool.ts
- [x] T017 [US2] Ensure connections with sourceHandle starting with 'action:' are excluded from initial execution path in packages/backend/src/mcp/mcp.tool.ts
- [x] T018 [US2] Add action metadata to McpToolResponse for UI nodes with actions in packages/backend/src/mcp/mcp.tool.ts
- [x] T019 [US2] Include available actions in widget response for client-side action triggering in packages/backend/src/mcp/mcp.tool.ts

**Checkpoint**: User Story 2 complete - Flow execution respects conditional branching, action paths only execute on user interaction

---

## Phase 5: User Story 3 - Node Library Action Information (Priority: P3)

**Goal**: Flow builders see action count (e.g., "1 action") or "read only" label for each UI node in the node library

**Independent Test**: Open node library, verify Post List shows "1 action" and Stat Card shows "read only"

### Implementation for User Story 3

- [x] T020 [US3] Create getActionLabel helper function to compute action info from LAYOUT_REGISTRY in packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx
- [x] T021 [US3] Display action count or "read only" badge for interface category nodes in packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx
- [x] T022 [US3] Style action count badge (e.g., "1 action" in subtle gray) in packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx
- [x] T023 [US3] Style "read only" badge for nodes with zero actions in packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx

**Checkpoint**: User Story 3 complete - Node library shows action information for all UI nodes

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and edge case handling

- [x] T024 [P] Verify action handles render correctly for nodes with multiple actions (future-proofing)
- [x] T025 [P] Handle edge case: action handle with no connected nodes (fire but no execution)
- [x] T026 Run serve-app.sh and manually test all three user stories per constitution Auto-Serve requirement

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T003) - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational phase; can run in parallel with US1 but logically extends it
- **User Story 3 (Phase 5)**: Depends on Foundational phase; can run in parallel with US1/US2 (frontend-only)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Core feature - provides PostList node and action execution. No dependencies on other stories.
- **User Story 2 (P2)**: Extends US1 with conditional branching. Builds on action execution from US1.
- **User Story 3 (P3)**: Pure frontend enhancement. Independent of US1/US2 backend work.

### Within Each User Story

- Backend types before service implementation
- Service methods before controller endpoints
- Core implementation before edge case handling

### Parallel Opportunities

- T001, T002 can run in parallel (different type files)
- T020, T021, T022, T023 are in same file but can be done as one atomic change
- US3 (frontend) can run in parallel with US1/US2 (backend) after Foundational phase

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all type updates together:
Task: "Add 'post-list' to LayoutTemplate union type in packages/shared/src/types/app.ts"
Task: "Add 'PostList' to NodeType union type in packages/shared/src/types/node.ts"
```

## Parallel Example: After Foundational

```bash
# Frontend and backend work can proceed in parallel:

# Developer A (Backend - US1/US2):
Task: "Add PostList case to execution switch in packages/backend/src/mcp/mcp.tool.ts"
Task: "Implement executeAction method..."

# Developer B (Frontend - US3):
Task: "Create getActionLabel helper function..."
Task: "Display action count or read only badge..."
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (type definitions)
2. Complete Phase 2: Foundational (PostListNode)
3. Complete Phase 3: User Story 1 (action execution)
4. **STOP and VALIDATE**: Add Post List node, connect Return node to action, test execution
5. MVP is deliverable: Post List with working action

### Incremental Delivery

1. Setup + Foundational → PostListNode registered
2. Add User Story 1 → Test action execution → Demo MVP
3. Add User Story 2 → Test conditional branching → Demo enhanced flows
4. Add User Story 3 → Test library display → Complete feature

### Parallel Team Strategy

With two developers:

1. Both complete Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Stories 1 & 2 (backend)
   - Developer B: User Story 3 (frontend)
3. Merge and run final validation together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run serve-app.sh after implementation per constitution requirement
