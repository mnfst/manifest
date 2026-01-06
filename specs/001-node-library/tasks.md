# Tasks: Node Library Sidedrawer

**Input**: Design documents from `/specs/001-node-library/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓

**Tests**: Not requested (POC phase - testing deferred per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (monorepo)**: `packages/frontend/src/`, `packages/backend/src/`, `packages/shared/src/`
- This feature is frontend-only

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create project structure for Node Library components

- [x] T001 Create NodeLibrary component directory at packages/frontend/src/components/flow/NodeLibrary/
- [x] T002 [P] Create barrel export file at packages/frontend/src/components/flow/NodeLibrary/index.ts
- [x] T003 [P] Create node configuration file at packages/frontend/src/lib/nodeConfig.ts with NodeTypeConfig, NodeColor, and NodeGroup interfaces

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core configuration and types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Define NodeGroup configurations (Display, Output, Flow Control) in packages/frontend/src/lib/nodeConfig.ts
- [x] T005 Define NodeTypeConfig for Interface node (type, name, description, icon, color, groupId) in packages/frontend/src/lib/nodeConfig.ts
- [x] T006 Define NodeTypeConfig for Return node in packages/frontend/src/lib/nodeConfig.ts
- [x] T007 Define NodeTypeConfig for CallFlow node in packages/frontend/src/lib/nodeConfig.ts
- [x] T008 Export helper functions (getNodesByGroup, getAllNodes, getGroupById) from packages/frontend/src/lib/nodeConfig.ts

**Checkpoint**: Foundation ready - all node types and groups configured

---

## Phase 3: User Story 5 - Open and Close the Node Library (Priority: P1) 🎯 MVP

**Goal**: Users can toggle the Node Library sidedrawer open and closed with smooth animations

**Independent Test**: Open the flow editor, click toggle to open library, verify animation plays, click to close, verify it folds away

### Implementation for User Story 5

- [x] T009 [US5] Create NodeLibrary.tsx shell component with isOpen prop and basic container in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T010 [US5] Implement sidedrawer CSS transitions (translateX, duration-300, ease-out) in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T011 [US5] Add toggle button (chevron icon) that controls open/close in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T012 [US5] Implement escape key handler to close sidedrawer in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T013 [US5] Add isOpen state and toggle handler in packages/frontend/src/pages/FlowDetail.tsx
- [x] T014 [US5] Integrate NodeLibrary component into FlowDetail layout (adjacent to sidebar, before canvas) in packages/frontend/src/pages/FlowDetail.tsx
- [x] T015 [US5] Ensure canvas container uses flex-1 to adjust when library opens/closes in packages/frontend/src/pages/FlowDetail.tsx

**Checkpoint**: Sidedrawer opens and closes with animation, canvas adjusts layout

---

## Phase 4: User Story 1 - Browse Node Groups (Priority: P1)

**Goal**: Users see all node groups with icons and colors when library is open

**Independent Test**: Open Node Library, verify all 3 groups (Display, Output, Flow Control) display with correct icons and colors

### Implementation for User Story 1

- [x] T016 [P] [US1] Create NodeGroup.tsx component displaying group icon, name, and color in packages/frontend/src/components/flow/NodeLibrary/NodeGroup.tsx
- [x] T017 [US1] Add groups list view state and render NodeGroup for each group in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T018 [US1] Style NodeGroup with hover states matching existing design patterns (bg-{color}-100, hover:bg-{color}-200) in packages/frontend/src/components/flow/NodeLibrary/NodeGroup.tsx
- [x] T019 [US1] Export NodeGroup from barrel in packages/frontend/src/components/flow/NodeLibrary/index.ts

**Checkpoint**: Opening library shows 3 groups with correct visual presentation

---

## Phase 5: User Story 2 - Navigate Into a Node Group (Priority: P1)

**Goal**: Users can click a group to see its nodes with animated transition, and navigate back

**Independent Test**: Click on "Display" group, verify slide animation shows Interface node, click back button, verify return to groups

### Implementation for User Story 2

- [x] T020 [P] [US2] Create NodeItem.tsx component displaying node icon, name, description, and color in packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx
- [x] T021 [US2] Add currentView state ('groups' | 'nodes') and selectedGroupId to NodeLibrary in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T022 [US2] Implement horizontal slide animation container (overflow-hidden, transform transitions) in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T023 [US2] Add onClick handler to NodeGroup that sets currentView='nodes' and selectedGroupId in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T024 [US2] Render nodes list using getNodesByGroup(selectedGroupId) when currentView='nodes' in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T025 [US2] Add back button with ArrowLeft icon that returns to groups view in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T026 [US2] Export NodeItem from barrel in packages/frontend/src/components/flow/NodeLibrary/index.ts

**Checkpoint**: Full navigation flow works: groups → nodes → back to groups with animations

---

## Phase 6: User Story 3 - Add Node to Canvas (Priority: P1)

**Goal**: Clicking a node adds it to the canvas

**Independent Test**: Navigate to any node, click it, verify node appears on canvas, library stays open

### Implementation for User Story 3

- [x] T027 [US3] Add onSelectNode prop to NodeLibrary component in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T028 [US3] Add onClick handler to NodeItem that calls onSelectNode(nodeType) in packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx
- [x] T029 [US3] Pass disabledTypes prop to NodeLibrary and apply disabled styling to NodeItem in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T030 [US3] Implement disabled state styling (opacity-50, cursor-not-allowed) in NodeItem in packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx
- [x] T031 [US3] Connect onSelectNode to existing node creation logic in packages/frontend/src/pages/FlowDetail.tsx
- [x] T032 [US3] Ensure library remains open after node selection (don't auto-close) in packages/frontend/src/pages/FlowDetail.tsx

**Checkpoint**: Complete browse-and-add flow works: open → browse → select → node added to canvas

---

## Phase 7: User Story 4 - Search for Nodes (Priority: P2)

**Goal**: Users can search for nodes at root level with instant filtering

**Independent Test**: Type "View" in search, verify Interface node appears instantly, click to add, clear search to return to groups

### Implementation for User Story 4

- [x] T033 [P] [US4] Create NodeSearch.tsx component with search input and clear button in packages/frontend/src/components/flow/NodeLibrary/NodeSearch.tsx
- [x] T034 [US4] Add searchTerm state to NodeLibrary in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T035 [US4] Render NodeSearch only when currentView='groups' in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T036 [US4] Implement search filtering logic using getAllNodes().filter() in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T037 [US4] Render flat list of matching NodeItems when searchTerm is not empty in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T038 [US4] Add empty state message "No nodes match your search" when no results in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T039 [US4] Implement clear search (X button) that resets searchTerm and returns to groups view in packages/frontend/src/components/flow/NodeLibrary/NodeSearch.tsx
- [x] T040 [US4] Export NodeSearch from barrel in packages/frontend/src/components/flow/NodeLibrary/index.ts

**Checkpoint**: Search works: type → instant filter → click result → node added → clear returns to groups

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, integration, and edge case handling

- [x] T041 Remove StepTypeDrawer.tsx (no longer used) from packages/frontend/src/components/flow/
- [x] T042 Remove AddStepNode.tsx (no longer used) from packages/frontend/src/components/flow/
- [x] T043 Remove StepTypeDrawer imports and usage from packages/frontend/src/pages/FlowDetail.tsx
- [x] T044 Handle edge case: empty group shows "No nodes in this group" message in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T045 Handle edge case: rapid open/close interrupts animation gracefully in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [x] T046 Verify visual consistency with existing node colors (blue/green/purple) across all components
- [ ] T047 Run pnpm lint and fix any linting errors
- [ ] T048 Run quickstart.md manual testing checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T003) - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational (Phase 2) completion
  - US5 (Open/Close) should come first as it creates the base component
  - US1, US2, US3 build incrementally on US5
  - US4 (Search) is independent of navigation but needs base component
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 5 (P1)**: Foundational → Creates NodeLibrary shell
- **User Story 1 (P1)**: US5 → Adds groups list to the shell
- **User Story 2 (P1)**: US1 → Adds navigation within the groups
- **User Story 3 (P1)**: US2 → Adds node selection callback
- **User Story 4 (P2)**: US1 → Adds search (can parallelize with US2/US3 if needed)

### Suggested Execution Flow

```
T001 → T002 + T003 (parallel)
     ↓
T004 → T005 + T006 + T007 (parallel) → T008
     ↓
T009 → T010 → T011 → T012 → T013 → T014 → T015 (US5 complete)
     ↓
T016 + T017 (parallel) → T018 → T019 (US1 complete)
     ↓
T020 + T021 (parallel) → T022 → T023 → T024 → T025 → T026 (US2 complete)
     ↓
T027 → T028 → T029 → T030 → T031 → T032 (US3 complete)
     ↓
T033 + T034 (parallel) → T035 → T036 → T037 → T038 → T039 → T040 (US4 complete)
     ↓
T041 + T042 + T043 (parallel) → T044 → T045 → T046 → T047 → T048
```

### Parallel Opportunities

Within Phase 2:
- T005, T006, T007 can run in parallel (different node configs)

Within User Stories:
- T016 + T017 (NodeGroup component + groups list)
- T020 + T021 (NodeItem component + view state)
- T033 + T034 (NodeSearch component + search state)

Within Polish:
- T041 + T042 + T043 (removing old files)

---

## Parallel Example: Foundational Phase

```bash
# Launch node configuration tasks in parallel:
Task: "Define NodeTypeConfig for Interface node in packages/frontend/src/lib/nodeConfig.ts"
Task: "Define NodeTypeConfig for Return node in packages/frontend/src/lib/nodeConfig.ts"
Task: "Define NodeTypeConfig for CallFlow node in packages/frontend/src/lib/nodeConfig.ts"
```

## Parallel Example: User Story 1

```bash
# Launch component and integration in parallel:
Task: "Create NodeGroup.tsx component in packages/frontend/src/components/flow/NodeLibrary/NodeGroup.tsx"
Task: "Add groups list view state in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 5, 1, 2, 3)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T008)
3. Complete Phase 3: User Story 5 - Open/Close (T009-T015)
4. Complete Phase 4: User Story 1 - Browse Groups (T016-T019)
5. Complete Phase 5: User Story 2 - Navigate Into Group (T020-T026)
6. Complete Phase 6: User Story 3 - Add Node (T027-T032)
7. **STOP and VALIDATE**: Test complete browse-and-add flow
8. Deploy/demo if ready - Search can be added incrementally

### Incremental Delivery

1. US5 complete → Sidedrawer opens/closes
2. US5 + US1 → Can see groups
3. US5 + US1 + US2 → Can navigate into groups and see nodes
4. US5 + US1 + US2 + US3 → Can add nodes to canvas (FULL MVP)
5. Add US4 → Search functionality (enhancement)
6. Polish → Remove old components, edge cases

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story builds on previous but adds distinct value
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Remember: Testing deferred per POC constitution
