# Tasks: Registry-Based UI Nodes

**Input**: Design documents from `/specs/091-registry-items/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not included (POC phase per constitution - testing deferred)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo structure**: `packages/frontend/src/`, `packages/backend/src/`, `packages/nodes/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and cleanup of old static nodes

- [x] T001 [P] Add registry types to packages/shared/src/types/registry.ts (copy from contracts/internal-types.ts)
- [x] T002 [P] Export registry types from packages/shared/src/types/index.ts
- [x] T003 [P] Add 'RegistryComponent' to NodeType union in packages/shared/src/types/node.ts
- [x] T004 Delete packages/nodes/src/nodes/interface/ folder entirely (StatCardNode.ts, PostListNode.ts, index.ts)
- [x] T005 Remove interface node exports from packages/nodes/src/nodes/index.ts (StatCard, PostList, interfaceNodes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create registry service in packages/frontend/src/services/registry.ts with fetchRegistry() and fetchComponentDetail() functions
- [x] T007 Add VITE_REGISTRY_URL to packages/frontend/.env.example with default value
- [x] T008 Create migration to delete flows containing old interface nodes in packages/backend/src/flow/flow.service.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Browse UI Components by Category (Priority: P1) 🎯 MVP

**Goal**: Enable users to browse UI components organized by dynamic registry categories under the "UIs" section

**Independent Test**: Open node library → Click "UIs" → See registry categories (form, payment, list, blogging, etc.) → Click a category → See components

### Implementation for User Story 1

- [x] T009 [P] [US1] Create RegistryItemSkeleton component in packages/frontend/src/components/flow/NodeLibrary/RegistryItemSkeleton.tsx
- [x] T010 [P] [US1] Create CategoryList component for displaying registry categories in packages/frontend/src/components/flow/NodeLibrary/CategoryList.tsx
- [x] T011 [US1] Add view state for registry navigation (categories/items) in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T012 [US1] Add registry fetch state management to NodeLibrary.tsx with loading/error/loaded states
- [x] T013 [US1] Implement category extraction from registry items (group by category, preserve order) in NodeLibrary.tsx
- [x] T014 [US1] Modify handleGroupClick to show registry categories when "interface" category is selected in NodeLibrary.tsx
- [x] T015 [US1] Add back navigation from registry categories/items to main categories in NodeLibrary.tsx
- [x] T016 [US1] Display skeleton loading state in UI section while fetching registry in NodeLibrary.tsx
- [x] T017 [US1] Display error state with message when registry fetch fails in NodeLibrary.tsx

**Checkpoint**: User Story 1 complete - users can browse categories and see component lists

---

## Phase 4: User Story 2 - Add Registry Component to Canvas (Priority: P1)

**Goal**: Enable users to add a registry component to the canvas with full code embedded in node data

**Independent Test**: Select component from category → System fetches detail JSON → Node appears on canvas → Node data contains full component code

### Implementation for User Story 2

- [x] T018 [P] [US2] Create RegistryItemList component for displaying components in a category in packages/frontend/src/components/flow/NodeLibrary/RegistryItemList.tsx
- [x] T019 [P] [US2] Create RegistryItem component (individual item display) in packages/frontend/src/components/flow/NodeLibrary/RegistryItem.tsx
- [x] T020 [US2] Implement component detail fetch on item click in RegistryItemList.tsx using registry service
- [x] T021 [US2] Transform ComponentDetail to RegistryNodeParameters format in packages/frontend/src/services/registry.ts
- [x] T022 [US2] Implement onSelectRegistryComponent callback in NodeLibrary.tsx to create node with full component data
- [x] T023 [US2] Add loading indicator while fetching component detail in RegistryItem.tsx
- [x] T024 [US2] Display error message when component detail fetch fails in RegistryItem.tsx (user re-clicks to retry)
- [x] T025 [US2] Create RegistryComponentNode React component for canvas rendering in packages/frontend/src/components/flow/RegistryComponentNode.tsx
- [x] T026 [US2] Register RegistryComponentNode in FlowDiagram.tsx nodeTypes mapping
- [x] T027 [US2] Update node creation logic in FlowDiagram.tsx to handle 'RegistryComponent' type

**Checkpoint**: User Story 2 complete - users can add registry components to canvas with embedded code

---

## Phase 5: User Story 3 - View Component Information (Priority: P2)

**Goal**: Display version, title, and description for each component before adding

**Independent Test**: View any category → Each component shows title, version badge, description in consistent format

### Implementation for User Story 3

- [x] T028 [US3] Add version badge display to RegistryItem.tsx showing version number (e.g., "v2.0.2")
- [x] T029 [US3] Style component title prominently in RegistryItem.tsx
- [x] T030 [US3] Add description text (truncated) in RegistryItem.tsx
- [x] T031 [US3] Ensure consistent layout across all registry items (title row with version, description below)
- [x] T032 [US3] Handle missing fields with sensible defaults (name→title fallback, "No description" placeholder)

**Checkpoint**: User Story 3 complete - users see rich component information before adding

---

## Phase 6: User Story 4 - Configure Registry URL (Priority: P3)

**Goal**: Allow administrators to configure custom registry URL via environment variable

**Independent Test**: Set VITE_REGISTRY_URL env var → Restart → System fetches from configured URL

### Implementation for User Story 4

- [x] T033 [US4] Update packages/frontend/src/services/registry.ts to read VITE_REGISTRY_URL with fallback to default
- [x] T034 [US4] Document VITE_REGISTRY_URL in packages/frontend/.env.example
- [x] T035 [US4] Add registry URL configuration note to quickstart.md

**Checkpoint**: User Story 4 complete - custom registry URLs supported

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T036 [P] Export new NodeLibrary components from packages/frontend/src/components/flow/NodeLibrary/index.ts
- [ ] T037 Run migration to delete flows with old interface nodes
- [ ] T038 Manual testing: Verify full flow (browse → select → add → view node data)
- [ ] T039 Manual testing: Verify error states (registry unreachable, component fetch fails)
- [ ] T040 Manual testing: Verify skeleton loading appears in UI section only

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (needs category browsing) - Can start in parallel with US1 for non-overlapping files
- **User Story 3 (P2)**: Depends on US2 (needs RegistryItem component) - Enhances existing implementation
- **User Story 4 (P3)**: Can start after Phase 2 - Independent of other stories

### Within Each User Story

- Create components before wiring them up
- Implement core functionality before error handling
- Core implementation before integration

### Parallel Opportunities

Within Phase 1 (Setup):
- T001, T002, T003 can run in parallel (different files)
- T004 can run in parallel with T001-T003

Within Phase 3 (US1):
- T009, T010 can run in parallel (different component files)

Within Phase 4 (US2):
- T018, T019 can run in parallel (different component files)

---

## Parallel Example: User Story 1

```bash
# Launch skeleton and category components in parallel:
Task: "Create RegistryItemSkeleton component in packages/frontend/src/components/flow/NodeLibrary/RegistryItemSkeleton.tsx"
Task: "Create CategoryList component in packages/frontend/src/components/flow/NodeLibrary/CategoryList.tsx"
```

## Parallel Example: User Story 2

```bash
# Launch item list and individual item components in parallel:
Task: "Create RegistryItemList component in packages/frontend/src/components/flow/NodeLibrary/RegistryItemList.tsx"
Task: "Create RegistryItem component in packages/frontend/src/components/flow/NodeLibrary/RegistryItem.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (types, cleanup old nodes)
2. Complete Phase 2: Foundational (registry service, migration)
3. Complete Phase 3: User Story 1 (browse categories)
4. Complete Phase 4: User Story 2 (add components)
5. **STOP and VALIDATE**: Test browsing and adding components
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Types defined, old nodes removed
2. Add User Story 1 → Test browsing → Deploy (partial MVP)
3. Add User Story 2 → Test adding → Deploy (full MVP!)
4. Add User Story 3 → Test component info display → Deploy
5. Add User Story 4 → Test custom URL → Deploy
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Testing deferred per POC constitution - manual testing in Phase 7
- User Stories 1 and 2 together form the MVP
- User Stories 3 and 4 are enhancements
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
