# Tasks: UI Selection Architecture Refactor

**Input**: Design documents from `/specs/001-ui-selection/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested - POC phase (manual testing per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo structure**: `packages/nodes/src/`, `packages/shared/src/`, `packages/backend/src/`, `packages/frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the folder structure for node reorganization

- [x] T001 Create category subfolders in packages/nodes/src/nodes/ (trigger/, action/, interface/, return/)
- [x] T002 [P] Create barrel export index.ts in packages/nodes/src/nodes/trigger/
- [x] T003 [P] Create barrel export index.ts in packages/nodes/src/nodes/action/
- [x] T004 [P] Create barrel export index.ts in packages/nodes/src/nodes/interface/
- [x] T005 [P] Create barrel export index.ts in packages/nodes/src/nodes/return/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update shared types and remove table/post-list references from shared package

**CRITICAL**: These changes affect all packages and must complete before user story implementation

- [x] T006 Update LayoutTemplate type in packages/shared/src/types/app.ts (remove table/post-list, add stat-card)
- [x] T007 Update LAYOUT_REGISTRY in packages/shared/src/types/app.ts for stat-card only
- [x] T008 Run pnpm build to verify shared package compiles with new types

**Checkpoint**: Foundation ready - shared types updated, category folders created

---

## Phase 3: User Story 3 - Navigate Organized Node Codebase (Priority: P3)

**Goal**: Reorganize existing nodes into category subfolders for better maintainability

**Independent Test**: Navigate to packages/nodes/src/nodes/ and verify category folders exist with correct node files; run pnpm build to confirm imports work

**Note**: Implementing US3 first because folder structure refactor is prerequisite for US1/US2

### Implementation for User Story 3

- [x] T009 [P] [US3] Move UserIntentNode.ts to packages/nodes/src/nodes/trigger/UserIntentNode.ts
- [x] T010 [P] [US3] Move ApiCallNode.ts to packages/nodes/src/nodes/action/ApiCallNode.ts
- [x] T011 [P] [US3] Move InterfaceNode.ts to packages/nodes/src/nodes/interface/InterfaceNode.ts
- [x] T012 [P] [US3] Move ReturnNode.ts to packages/nodes/src/nodes/return/ReturnNode.ts
- [x] T013 [P] [US3] Move CallFlowNode.ts to packages/nodes/src/nodes/return/CallFlowNode.ts
- [x] T014 [US3] Update trigger/index.ts to export UserIntentNode in packages/nodes/src/nodes/trigger/index.ts
- [x] T015 [US3] Update action/index.ts to export ApiCallNode in packages/nodes/src/nodes/action/index.ts
- [x] T016 [US3] Update interface/index.ts to export InterfaceNode in packages/nodes/src/nodes/interface/index.ts
- [x] T017 [US3] Update return/index.ts to export ReturnNode and CallFlowNode in packages/nodes/src/nodes/return/index.ts
- [x] T018 [US3] Update root nodes/index.ts to re-export from category subfolders in packages/nodes/src/nodes/index.ts
- [x] T019 [US3] Update package.json exports field for wildcard pattern in packages/nodes/package.json
- [x] T020 [US3] Delete original flat node files from packages/nodes/src/nodes/ (after verifying imports)
- [x] T021 [US3] Run pnpm build to verify all imports resolve correctly

**Checkpoint**: Node folder structure reorganized - existing functionality preserved

---

## Phase 4: User Story 1 - Add Stat Card UI to Flow (Priority: P1) MVP

**Goal**: Create the StatCardNode component and supporting infrastructure for displaying stats in flows

**Independent Test**: Open flow canvas, drag Stat Card from node library, connect data source with stats array, verify metrics display with trend indicators

### Implementation for User Story 1

#### Backend: Stat Card HTML Template

- [ ] T022 [P] [US1] Create stats.html template in packages/backend/src/mcp/templates/stats.html
- [ ] T023 [P] [US1] Delete table.html template from packages/backend/src/mcp/templates/table.html
- [ ] T024 [P] [US1] Delete post-list.html template from packages/backend/src/mcp/templates/post-list.html
- [ ] T025 [US1] Update layout-selector.ts for stat-card in packages/backend/src/agent/tools/layout-selector.ts

#### Nodes Package: StatCardNode

- [ ] T026 [US1] Create StatCardNode definition in packages/nodes/src/nodes/interface/StatCardNode.ts
- [ ] T027 [US1] Update interface/index.ts to export StatCardNode in packages/nodes/src/nodes/interface/index.ts
- [ ] T028 [US1] Update root nodes/index.ts to include StatCardNode in builtInNodes and builtInNodeList

#### Frontend: Stats React Component

- [ ] T029 [P] [US1] Create Stats React component in packages/frontend/src/components/ui/stats.tsx
- [ ] T030 [P] [US1] Delete table.tsx component from packages/frontend/src/components/ui/table.tsx
- [ ] T031 [P] [US1] Delete blog-post-list.tsx component from packages/frontend/src/components/ui/blog-post-list.tsx
- [ ] T032 [P] [US1] Delete blog-post-card.tsx component from packages/frontend/src/components/ui/blog-post-card.tsx
- [ ] T033 [US1] Update LayoutRenderer for stat-card in packages/frontend/src/components/editor/LayoutRenderer.tsx

#### MCP Integration

- [ ] T034 [US1] Update mcp.tool.ts to handle stat-card layout in packages/backend/src/mcp/mcp.tool.ts (if needed)

#### Validation

- [ ] T035 [US1] Run pnpm build to verify all packages compile
- [ ] T036 [US1] Run pnpm lint to verify no linting errors

**Checkpoint**: Stat Card node fully functional - can be added to flows and renders stats with trends

---

## Phase 5: User Story 2 - Browse UI Components in Node Library (Priority: P2)

**Goal**: Ensure StatCard appears correctly in node library with proper metadata

**Independent Test**: Open node library, verify Stat Card appears under interface category with correct icon, name, and description; search for "stat" and verify it appears in results

### Implementation for User Story 2

- [ ] T037 [US2] Verify StatCardNode metadata (displayName, icon, group, description) in packages/nodes/src/nodes/interface/StatCardNode.ts
- [ ] T038 [US2] Verify node library displays Stat Card in interface category (may require ViewNode.tsx updates) in packages/frontend/src/components/flow/ViewNode.tsx
- [ ] T039 [US2] Test node search functionality returns Stat Card when searching "stat"

**Checkpoint**: Stat Card discoverable in node library with correct metadata

---

## Phase 6: Cleanup - Remove Remaining Table/Post-List References

**Purpose**: Ensure complete removal of all table/post-list traces per FR-002, FR-003

- [ ] T040 Search codebase for remaining "table" references related to layout (grep -r "table" packages/)
- [ ] T041 Search codebase for remaining "post-list" references (grep -r "post-list" packages/)
- [ ] T042 Remove any remaining table/post-list imports or references found
- [ ] T043 Verify SC-004: Zero references to table or post-list UI components in codebase

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T044 Run full build: pnpm clean && pnpm build
- [ ] T045 Start application with .specify/scripts/bash/serve-app.sh
- [ ] T046 Manual test: Verify node library shows Stat Card under interface category
- [ ] T047 Manual test: Add Stat Card to flow and verify rendering
- [ ] T048 Manual test: Verify all existing nodes (UserIntent, ApiCall, Return, CallFlow, Interface) still work
- [ ] T049 Run pnpm lint and fix any issues
- [ ] T050 Verify quickstart.md instructions work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS user stories
- **User Story 3 (Phase 3)**: Depends on Foundational - folder reorganization first
- **User Story 1 (Phase 4)**: Depends on US3 - needs new folder structure
- **User Story 2 (Phase 5)**: Depends on US1 - needs StatCardNode to exist
- **Cleanup (Phase 6)**: Depends on US1 completion
- **Polish (Phase 7)**: Depends on all phases complete

### Why US3 Comes Before US1

User Story 3 (folder reorganization) is implemented first because:
1. The new folder structure is prerequisite for adding StatCardNode in the correct location
2. Reorganizing existing nodes first ensures clean baseline
3. US1 (Stat Card) can then be added to the already-organized interface/ folder

### User Story Dependencies

- **User Story 3 (P3)**: Must complete first - folder structure is prerequisite
- **User Story 1 (P1)**: Depends on US3 - StatCardNode goes in interface/ folder
- **User Story 2 (P2)**: Depends on US1 - verifies StatCardNode appears in library

### Within Each User Story

- Backend tasks can run parallel to frontend tasks
- Delete operations can run parallel
- Index updates depend on file moves completing
- Final validation depends on all implementation tasks

### Parallel Opportunities

**Phase 1 (Setup):**
```
T002, T003, T004, T005 can run in parallel (different folders)
```

**Phase 3 (US3 - File Moves):**
```
T009, T010, T011, T012, T013 can run in parallel (different files)
```

**Phase 4 (US1 - Implementation):**
```
T022, T023, T024 can run in parallel (different backend templates)
T029, T030, T031, T032 can run in parallel (different frontend components)
```

---

## Parallel Example: User Story 1 (Phase 4)

```bash
# Launch backend template tasks in parallel:
Task: "Create stats.html template in packages/backend/src/mcp/templates/stats.html"
Task: "Delete table.html template from packages/backend/src/mcp/templates/table.html"
Task: "Delete post-list.html template from packages/backend/src/mcp/templates/post-list.html"

# Launch frontend component tasks in parallel:
Task: "Create Stats React component in packages/frontend/src/components/ui/stats.tsx"
Task: "Delete table.tsx component from packages/frontend/src/components/ui/table.tsx"
Task: "Delete blog-post-list.tsx component from packages/frontend/src/components/ui/blog-post-list.tsx"
Task: "Delete blog-post-card.tsx component from packages/frontend/src/components/ui/blog-post-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (folder structure)
2. Complete Phase 2: Foundational (type updates)
3. Complete Phase 3: User Story 3 (reorganize existing nodes)
4. Complete Phase 4: User Story 1 (StatCardNode)
5. **STOP and VALIDATE**: Test Stat Card independently
6. Deploy/demo if ready

### Full Feature Delivery

1. Complete Phases 1-4 (MVP)
2. Complete Phase 5: User Story 2 (library discoverability)
3. Complete Phase 6: Cleanup (remove all traces)
4. Complete Phase 7: Polish (final validation)

---

## Summary

| Phase | Tasks | User Story | Parallel Tasks |
|-------|-------|------------|----------------|
| Phase 1: Setup | T001-T005 | - | T002-T005 |
| Phase 2: Foundational | T006-T008 | - | - |
| Phase 3: US3 | T009-T021 | Navigate Organized Codebase | T009-T013 |
| Phase 4: US1 | T022-T036 | Add Stat Card UI | T022-T024, T029-T032 |
| Phase 5: US2 | T037-T039 | Browse UI Components | - |
| Phase 6: Cleanup | T040-T043 | - | - |
| Phase 7: Polish | T044-T050 | - | - |

**Total Tasks**: 50
**MVP Scope**: Phases 1-4 (T001-T036 = 36 tasks)
**Full Feature**: All phases (T001-T050 = 50 tasks)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US3 implemented before US1 due to folder structure dependency
- Manual testing only (POC phase per constitution)
- Commit after each phase or logical group
- Stop at any checkpoint to validate independently
