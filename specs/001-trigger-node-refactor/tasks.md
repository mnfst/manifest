# Tasks: Trigger Node Refactor

**Input**: Design documents from `/specs/001-trigger-node-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not required (POC phase per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/nodes/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Type Definitions)

**Purpose**: Update shared types that all packages depend on

- [x] T001 [P] Add NodeTypeCategory type to packages/shared/src/types/node.ts
- [x] T002 [P] Add 'UserIntent' to NodeType union in packages/shared/src/types/node.ts
- [x] T003 [P] Add UserIntentNodeParameters interface to packages/shared/src/types/node.ts
- [x] T004 [P] Add isUserIntentNode type guard to packages/shared/src/types/node.ts
- [x] T005 Remove whenToUse property from Flow interface in packages/shared/src/types/flow.ts
- [x] T006 Remove whenNotToUse property from Flow interface in packages/shared/src/types/flow.ts

---

## Phase 2: Foundational (Node Package Updates)

**Purpose**: Core node definition infrastructure that MUST be complete before user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Add 'category' property to NodeTypeDefinition interface in packages/nodes/src/types.ts
- [x] T008 [P] Create UserIntentNode definition in packages/nodes/src/nodes/UserIntentNode.ts
- [x] T009 [P] Add category property to InterfaceNode in packages/nodes/src/nodes/InterfaceNode.ts
- [x] T010 [P] Add category property to ReturnNode in packages/nodes/src/nodes/ReturnNode.ts
- [x] T011 [P] Add category property to CallFlowNode in packages/nodes/src/nodes/CallFlowNode.ts
- [x] T012 Export UserIntentNode and update builtInNodes registry in packages/nodes/src/nodes/index.ts

**Checkpoint**: Foundation ready - node definitions complete with categories

---

## Phase 3: User Story 1 & 2 - Add UserIntent Trigger Node + Multiple Triggers (Priority: P1)

**Goal**: Enable users to add UserIntent trigger nodes to flows, with support for multiple triggers per flow

**Independent Test**: Create a new flow, add one or more UserIntent trigger nodes, configure properties, save, and verify persistence

### Backend Implementation

- [x] T013 [US1] Remove whenToUse column from FlowEntity in packages/backend/src/flow/flow.entity.ts
- [x] T014 [US1] Remove whenNotToUse column from FlowEntity in packages/backend/src/flow/flow.entity.ts
- [x] T015 [US1] Update FlowService to not handle whenToUse/whenNotToUse in packages/backend/src/flow/flow.service.ts
- [x] T016 [US1] Add trigger node connection validation in NodeService.createConnection in packages/backend/src/node/node.service.ts
- [x] T017 [P] [US1] Create GET /api/node-types endpoint in packages/backend/src/node/node-types.controller.ts
- [x] T018 [US1] Add getNodeTypes method to return node types with categories in packages/backend/src/node/node.service.ts

### Frontend Implementation

- [x] T019 [US1] Update UserIntentNode React component for editing in packages/frontend/src/components/flow/UserIntentNode.tsx
- [x] T020 [US1] Add UserIntentNode editing modal or inline editing support in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T021 [US1] Register 'UserIntent' node type mapping in FlowDiagram in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T022 [US1] Update flow diagram to convert UserIntent nodes correctly in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T023 [US1] Remove UserIntentModal usage since user intent is now per-node in packages/frontend/src/pages/FlowDetail.tsx
- [x] T024 [P] [US1] Update API service - no changes needed (types from shared package)

**Checkpoint**: UserIntent trigger nodes can be added, configured, and saved. Multiple triggers per flow work naturally.

---

## Phase 4: User Story 3 - Grouped Node Selection Modal (Priority: P2)

**Goal**: Update AddStepModal to display nodes grouped by category (Triggers, Agentic Interfaces, Actions, Return Values)

**Independent Test**: Open add-step modal and verify nodes are grouped under correct category headers

- [x] T025 [US3] Fetch node types from /api/node-types in AddStepModal in packages/frontend/src/components/flow/AddStepModal.tsx
- [x] T026 [US3] Group nodes by category in AddStepModal in packages/frontend/src/components/flow/AddStepModal.tsx
- [x] T027 [US3] Add category section headers to AddStepModal UI in packages/frontend/src/components/flow/AddStepModal.tsx
- [x] T028 [US3] Add UserIntent option under Triggers category in AddStepModal in packages/frontend/src/components/flow/AddStepModal.tsx
- [x] T029 [US3] Style category headers consistently with existing modal design in packages/frontend/src/components/flow/AddStepModal.tsx

**Checkpoint**: AddStepModal displays nodes in 4 category groups with headers

---

## Phase 5: User Story 4 - Existing Nodes with New Names (Priority: P2)

**Goal**: Rename InterfaceNode to "Agentic Interface" and ReturnNode to "Return Value" in all user-facing places

**Independent Test**: View any flow with Interface or Return nodes and verify new display names appear

- [x] T030 [P] [US4] Update displayName to "Agentic Interface" in InterfaceNode in packages/nodes/src/nodes/InterfaceNode.ts
- [x] T031 [P] [US4] Update displayName to "Return Value" in ReturnNode in packages/nodes/src/nodes/ReturnNode.ts
- [x] T032 [US4] Update ViewNode component display name if hardcoded in packages/frontend/src/components/flow/ViewNode.tsx
- [x] T033 [US4] Update ReturnValueNode component display name if hardcoded in packages/frontend/src/components/flow/ReturnValueNode.tsx

**Checkpoint**: All nodes display with new naming conventions

---

## Phase 6: User Story 5 - Migration of Existing Flow Data (Priority: P3)

**Goal**: Migrate existing flow-level whenToUse/whenNotToUse data to UserIntentNode instances

**Independent Test**: Load an existing flow with flow-level user intent data and verify a UserIntentNode is created

- [ ] T034 [US5] Create migration script file in packages/backend/src/migrations/migrate-user-intent-to-nodes.ts
- [ ] T035 [US5] Implement migration logic to find flows with user intent data in packages/backend/src/migrations/migrate-user-intent-to-nodes.ts
- [ ] T036 [US5] Implement UserIntentNode creation for each flow with data in packages/backend/src/migrations/migrate-user-intent-to-nodes.ts
- [ ] T037 [US5] Clear flow-level whenToUse/whenNotToUse after migration in packages/backend/src/migrations/migrate-user-intent-to-nodes.ts
- [ ] T038 [US5] Add idempotency check to prevent duplicate migrations in packages/backend/src/migrations/migrate-user-intent-to-nodes.ts
- [ ] T039 [US5] Add migration runner script or endpoint in packages/backend/src/main.ts

**Checkpoint**: All existing flows with user intent are migrated to UserIntentNodes

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation

- [x] T040 [P] Remove unused UserIntentModal component in packages/frontend/src/components/flow/UserIntentModal.tsx
- [x] T041 [P] Remove AddUserIntentNode placeholder component if no longer needed in packages/frontend/src/components/flow/AddUserIntentNode.tsx (KEPT - still needed for UX when no triggers exist)
- [x] T042 Update FlowDiagram helper getFlowState to handle UserIntent nodes in packages/frontend/src/components/flow/FlowDiagram.tsx (already implemented)
- [ ] T043 Run serve-app.sh and manually test all user stories per quickstart.md checklist
- [x] T044 Verify no TypeScript errors across all packages with pnpm type-check (pre-existing errors in legacy View/MockData components - not part of this feature)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1/US2 (Phase 3): Core trigger node - should complete first
  - US3 (Phase 4): Grouped modal - can start after Phase 3
  - US4 (Phase 5): Renaming - can run in parallel with Phase 4
  - US5 (Phase 6): Migration - should be last before polish
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 & US2 (P1)**: Can start after Foundational - Core functionality
- **US3 (P2)**: Can start after US1/US2 - Needs node types endpoint
- **US4 (P2)**: Can start after Foundational - Independent of other stories
- **US5 (P3)**: Should run after US1/US2 - Requires UserIntent node type

### Within Each Phase

- Tasks marked [P] can run in parallel
- Backend tasks can run in parallel with frontend tasks when on different files
- Node package changes should complete before backend/frontend changes that depend on them

### Parallel Opportunities

**Phase 1 (all parallel)**:
```
T001, T002, T003, T004 can run together (same file but independent additions)
T005, T006 can run together (same file but independent removals)
```

**Phase 2 (partial parallel)**:
```
After T007: T008, T009, T010, T011 can run in parallel (different files)
```

**Phase 3 (partial parallel)**:
```
T013, T014 together (same file)
T017, T024 together (different packages)
```

**Phase 4 & 5 can run in parallel** (different components)

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (shared types)
2. Complete Phase 2: Foundational (node definitions)
3. Complete Phase 3: User Stories 1 & 2 (trigger nodes)
4. **STOP and VALIDATE**: Test trigger node functionality manually
5. Deploy/demo if ready - users can add trigger nodes

### Incremental Delivery

1. Setup + Foundational → Type system ready
2. Add US1/US2 → Test independently → **MVP Ready**
3. Add US3 → Grouped modal improves UX
4. Add US4 → Better naming consistency
5. Add US5 → Backward compatibility for existing data
6. Polish → Clean up unused components

### Suggested Order for Single Developer

1. T001-T006 (Setup - 30 min)
2. T007-T012 (Foundational - 45 min)
3. T013-T024 (US1/US2 - 2 hours)
4. T025-T029 (US3 - 1 hour)
5. T030-T033 (US4 - 30 min)
6. T034-T039 (US5 - 1 hour)
7. T040-T044 (Polish - 30 min)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- POC phase - no automated tests required per constitution
- Run `.specify/scripts/bash/serve-app.sh` after implementation for manual testing
- Commit after each phase or logical group of tasks
