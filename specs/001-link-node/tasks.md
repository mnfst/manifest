# Tasks: Link Output Node

**Input**: Design documents from `/specs/001-link-node/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: DEFERRED per constitution (POC phase). Manual testing documented in quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**:
  - `packages/shared/src/` - Shared types
  - `packages/nodes/src/` - Node definitions
  - `packages/backend/src/` - Backend services
  - `packages/frontend/src/` - Frontend components

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add Link type to shared types that all packages depend on

- [x] T001 [P] Add 'Link' to NodeType union in packages/shared/src/types/node.ts
- [x] T002 [P] Add LinkNodeParameters interface in packages/shared/src/types/node.ts
- [x] T003 [P] Add isLinkNode type guard function in packages/shared/src/types/node.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Link node implementation that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create LinkNode definition in packages/nodes/src/nodes/return/LinkNode.ts with normalizeUrl, isValidUrl, and resolveTemplate helper functions
- [x] T005 Implement execute() method for LinkNode with URL validation and template resolution in packages/nodes/src/nodes/return/LinkNode.ts
- [x] T006 Register LinkNode in packages/nodes/src/nodes/index.ts (add to builtInNodeList and builtInNodes)
- [x] T007 Build packages to verify no TypeScript errors (run pnpm build)

**Checkpoint**: Foundation ready - Link node core exists but is not yet connected to UI

---

## Phase 3: User Story 1 - Open External Link After UI Interaction (Priority: P1)

**Goal**: Flow designers can add a Link node to a flow and have it open an external URL when executed

**Independent Test**: Create a flow with UserIntent → StatCard → Link, configure Link with a static URL, execute flow, verify external URL opens

### Implementation for User Story 1

- [x] T008 [P] [US1] Create LinkNode frontend component in packages/frontend/src/components/flow/LinkNode.tsx with blue theme, left handle only, dropdown menu
- [x] T009 [P] [US1] Register LinkNode in frontend node types mapping in packages/frontend/src/components/flow/FlowDiagram.tsx (nodeTypes config)
- [x] T010 [US1] Add Link node editor section in packages/frontend/src/components/flow/NodeEditModal.tsx with URL input field
- [x] T011 [US1] Add linkHref state variable and save handler in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T012 [US1] Verify Link node appears in node library and can be added to canvas
- [x] T013 [US1] Manual test: Create UserIntent → StatCard → Link flow with static URL, verify flow completes successfully

**Checkpoint**: User Story 1 complete - Link node with static URL works end-to-end

---

## Phase 4: User Story 2 - Dynamic URL from Flow Data (Priority: P2)

**Goal**: Flow designers can use template variables like `{{ nodeSlug.field }}` to dynamically determine the URL from upstream data

**Independent Test**: Create a flow where upstream node outputs a URL field, configure Link to use `{{ upstream.field }}`, verify correct URL opens

### Implementation for User Story 2

- [x] T014 [US2] Add UsePreviousOutputs component integration in packages/frontend/src/components/flow/NodeEditModal.tsx for Link node editor
- [x] T015 [US2] Add TemplateReferencesDisplay component for URL validation in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T016 [US2] Manual test: Create flow with dynamic URL from upstream node, verify template resolution works

**Checkpoint**: User Story 2 complete - Dynamic URLs from flow data work

---

## Phase 5: User Story 3 - Placement Constraint Validation (Priority: P2)

**Goal**: System prevents Link nodes from being connected after non-UI nodes (only interface category nodes allowed)

**Independent Test**: Attempt to connect ApiCall → Link, verify connection is rejected with error message

### Implementation for User Story 3

- [x] T017 [US3] Add Link node source constraint validation in packages/backend/src/node/schema/schema.service.ts validateFlowConnections() method
- [x] T018 [US3] Manual test: Verify StatCard → Link connection is accepted
- [x] T019 [US3] Manual test: Verify ApiCall → Link connection is rejected with clear error message
- [x] T020 [US3] Manual test: Verify UserIntent → Link connection is rejected with clear error message

**Checkpoint**: User Story 3 complete - Invalid Link placements are blocked with feedback

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and edge case handling

- [x] T021 [P] Verify URL validation handles empty URLs with appropriate error message
- [x] T022 [P] Verify URL validation auto-prepends https:// when protocol missing
- [x] T023 [P] Verify build passes with no TypeScript errors (pnpm build)
- [x] T024 [P] Verify lint passes with no errors (pnpm lint)
- [x] T025 Run full verification checklist from quickstart.md
- [x] T026 Start application with .specify/scripts/bash/serve-app.sh for final manual testing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (US1 → US2 → US3)
  - US2 and US3 are both P2 but have different focus areas
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core Link node functionality
- **User Story 2 (P2)**: Can start after US1 complete - Adds dynamic URL capability
- **User Story 3 (P2)**: Can start after Foundational - Independent of US1/US2 (constraint validation)

### Within Each User Story

- Frontend component before modal integration
- Modal integration before manual testing
- Each story complete before moving to next

### Parallel Opportunities

- All Setup tasks (T001-T003) can run in parallel - different sections of same file
- All Polish tasks marked [P] (T021-T024) can run in parallel
- US1 T008-T009 can run in parallel (different files)
- US3 (constraint validation) could technically start in parallel with US1 once foundational is done

---

## Parallel Example: Setup Phase

```bash
# Launch all setup tasks together (different sections of node.ts):
Task: "Add 'Link' to NodeType union in packages/shared/src/types/node.ts"
Task: "Add LinkNodeParameters interface in packages/shared/src/types/node.ts"
Task: "Add isLinkNode type guard function in packages/shared/src/types/node.ts"
```

## Parallel Example: User Story 1

```bash
# Launch frontend component tasks together (different files):
Task: "Create LinkNode frontend component in packages/frontend/src/components/flow/LinkNode.tsx"
Task: "Register LinkNode in frontend node types mapping in packages/frontend/src/components/flow/FlowCanvas.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T007)
3. Complete Phase 3: User Story 1 (T008-T013)
4. **STOP and VALIDATE**: Test Link node with static URL independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Link node exists in system
2. Add User Story 1 → Link node works with static URLs (MVP!)
3. Add User Story 2 → Dynamic URLs from flow data
4. Add User Story 3 → Placement constraint validation
5. Each story adds value without breaking previous stories

### Recommended Order

For solo developer, execute sequentially:
1. T001-T003 (Setup - 3 tasks)
2. T004-T007 (Foundational - 4 tasks)
3. T008-T013 (US1 - 6 tasks) → **MVP Checkpoint**
4. T014-T016 (US2 - 3 tasks)
5. T017-T020 (US3 - 4 tasks)
6. T021-T026 (Polish - 6 tasks)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are DEFERRED (POC phase) - manual testing per quickstart.md
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Auto-serve after implementation complete per constitution
