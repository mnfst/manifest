# Tasks: UI Node Edit Modal Consolidation

**Input**: Design documents from `/specs/001-ui-edit-modal-merge/`
**Prerequisites**: plan.md, spec.md, data-model.md, quickstart.md, contracts/

**Tests**: Not required (POC phase - testing deferred per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create foundational types in shared package that all user stories depend on

- [x] T001 [P] Create appearance schema types file at packages/shared/src/types/appearance.ts
- [x] T002 [P] Define AppearanceOptionSchema and ComponentAppearanceSchema interfaces in packages/shared/src/types/appearance.ts
- [x] T003 Define COMPONENT_APPEARANCE_REGISTRY with all component schemas in packages/shared/src/types/appearance.ts
- [x] T004 Update UINodeParameters type (remove layoutTemplate, add appearanceConfig) in packages/shared/src/types/node.ts
- [x] T005 Export new appearance types from packages/shared/src/index.ts
- [x] T006 Rebuild shared package to verify types compile correctly

**Checkpoint**: Shared types ready - frontend and backend can now use new types

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ensure tab component exists for the unified editor

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Verify tabs component exists at packages/frontend/src/components/ui/tabs.tsx or add from shadcn/ui
- [x] T008 Verify switch component exists at packages/frontend/src/components/ui/switch.tsx for boolean toggles
- [x] T009 Verify select component exists at packages/frontend/src/components/ui/select.tsx for enum dropdowns

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Unified UI Node Editing Experience (Priority: P1) 🎯 MVP

**Goal**: Consolidate all UI node editing into a single tabbed interface with General, Appearance, Code, and Preview tabs

**Independent Test**: Open a UI node for editing and verify all configuration options are accessible in a single tabbed interface

### Implementation for User Story 1

- [x] T010 [US1] Create GeneralTab component at packages/frontend/src/components/editor/GeneralTab.tsx with name input field
- [x] T011 [US1] Create AppearanceTab component at packages/frontend/src/components/editor/AppearanceTab.tsx with dynamic form generation
- [x] T012 [US1] Add form field renderer (enum→select, boolean→switch, string→text, number→number) in AppearanceTab
- [x] T013 [US1] Refactor InterfaceEditor to use tabs structure at packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T014 [US1] Add General tab content wrapping GeneralTab component in InterfaceEditor
- [x] T015 [US1] Add Appearance tab content wrapping AppearanceTab component in InterfaceEditor
- [x] T016 [US1] Move existing code editor to Code tab content in InterfaceEditor
- [x] T017 [US1] Move existing preview to Preview tab content in InterfaceEditor
- [x] T018 [US1] Implement editor state management to preserve unsaved changes across tab switches in InterfaceEditor
- [x] T019 [US1] Update InterfaceEditor props to accept and pass node name and appearanceConfig
- [x] T020 [US1] Rename "Edit Code" to "Edit" in packages/frontend/src/components/flow/ViewNodeDropdown.tsx

**Checkpoint**: User Story 1 complete - unified editor with 4 tabs, changes preserved across tab switches

---

## Phase 4: User Story 2 - Appearance Configuration for UI Nodes (Priority: P2)

**Goal**: Enable form-based visual appearance configuration with live preview updates

**Independent Test**: Select different appearance options in the form and verify they reflect in the preview

**Dependencies**: US1 must be complete (AppearanceTab already created)

### Implementation for User Story 2

- [x] T021 [US2] Add empty state message to AppearanceTab when component has no appearance options
- [x] T022 [US2] Implement appearance config change handler that updates preview in real-time in InterfaceEditor
- [x] T023 [US2] Pass appearanceConfig to ComponentPreview component at packages/frontend/src/components/editor/ComponentPreview.tsx
- [x] T024 [US2] Update ComponentPreview to apply appearanceConfig values to rendered component
- [x] T025 [US2] Implement save handler in InterfaceEditor to persist appearanceConfig to node parameters
- [x] T026 [US2] Load existing appearanceConfig when opening editor for existing nodes in InterfaceEditor

**Checkpoint**: User Story 2 complete - appearance form controls work, preview updates in real-time, values persist on save

---

## Phase 5: User Story 3 - Non-Disruptive Node Addition (Priority: P3)

**Goal**: Adding UI nodes no longer auto-opens the editor

**Independent Test**: Add a UI node and verify it appears on the canvas without any modal or editor opening

**Dependencies**: None - can be implemented independently

### Implementation for User Story 3

- [x] T027 [US3] Remove setEditingCodeNodeId call after StatCard creation in packages/frontend/src/pages/FlowDetail.tsx
- [x] T028 [US3] Verify node is added to canvas without opening any modal in FlowDetail handleNodeLibrarySelect
- [x] T029 [US3] Ensure double-click on ViewNode triggers edit (verify existing behavior) at packages/frontend/src/components/flow/ViewNode.tsx

**Checkpoint**: User Story 3 complete - adding UI nodes stays on canvas without interruption

---

## Phase 6: User Story 4 - Complete Backend Cleanup (Priority: P4)

**Goal**: Remove layoutTemplate from all interfaces and ensure backward compatibility

**Independent Test**: Create/update UI nodes via API and confirm layoutTemplate is neither sent nor received

**Dependencies**: None - can be implemented independently

### Implementation for User Story 4

- [x] T030 [US4] Remove layoutTemplate from StatCardNodeParameters references in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T031 [US4] Remove layoutTemplate dropdown and LAYOUT_OPTIONS from NodeEditModal
- [x] T032 [US4] Remove layoutTemplate from StatCard handling in FlowDetail handleNodeLibrarySelect at packages/frontend/src/pages/FlowDetail.tsx
- [x] T033 [US4] Update ViewNode to not display layoutTemplate badge at packages/frontend/src/components/flow/ViewNode.tsx
- [x] T034 [US4] Ensure frontend ignores layoutTemplate when reading existing node parameters
- [x] T035 [US4] Review backend node DTOs and remove layoutTemplate if explicitly typed at packages/backend/src/node/dto/ (N/A - no explicit node DTOs exist)

**Checkpoint**: User Story 4 complete - layoutTemplate fully removed, existing nodes work without errors

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [x] T036 [P] Run type-check across all packages (pnpm type-check)
- [x] T037 [P] Run lint across all packages (pnpm lint)
- [ ] T038 Manual testing: Add UI node, verify stays on canvas
- [ ] T039 Manual testing: Edit UI node, verify 4-tab interface
- [ ] T040 Manual testing: Change appearance options, verify preview updates
- [ ] T041 Manual testing: Save and reopen, verify values persisted
- [ ] T042 Manual testing: Load existing node with layoutTemplate, verify backward compatibility
- [ ] T043 Run serve-app.sh for user testing (.specify/scripts/bash/serve-app.sh)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1): Can start immediately after Foundational
  - US2 (P2): Depends on US1 (uses AppearanceTab and InterfaceEditor created in US1)
  - US3 (P3): Can start after Foundational (independent of US1/US2)
  - US4 (P4): Can start after Foundational (independent of US1/US2/US3)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Creates the unified editor structure
- **User Story 2 (P2)**: Depends on US1 - Extends AppearanceTab with preview integration
- **User Story 3 (P3)**: Independent - Can run in parallel with US1/US2
- **User Story 4 (P4)**: Independent - Can run in parallel with US1/US2/US3

### Within Each User Story

- Tasks without [P] marker depend on previous tasks in sequence
- Tasks with [P] marker within same story can run in parallel

### Parallel Opportunities

**After Foundational phase completes:**
- US1 and US3 can start in parallel (different files)
- US1 and US4 can start in parallel (different files)
- US3 and US4 can start in parallel (different files)

**After US1 completes:**
- US2 can start (depends on US1's AppearanceTab)

---

## Parallel Example: Setup Phase

```bash
# Launch these tasks in parallel (different files):
Task: "Create appearance schema types file at packages/shared/src/types/appearance.ts"
Task: "Define AppearanceOptionSchema and ComponentAppearanceSchema interfaces"
```

## Parallel Example: User Stories 1, 3, 4

```bash
# After Foundational phase, these can run in parallel:
# Developer A: User Story 1 (unified editor)
# Developer B: User Story 3 (non-disruptive add)
# Developer C: User Story 4 (backend cleanup)

# Then after US1 completes:
# Developer A: User Story 2 (appearance preview integration)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test unified 4-tab editor
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP: unified editor)
3. Add User Story 2 → Test independently → Deploy (appearance preview)
4. Add User Story 3 → Test independently → Deploy (non-disruptive add)
5. Add User Story 4 → Test independently → Deploy (backend cleanup)

Each story adds value without breaking previous stories.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- POC phase: no automated tests required (per constitution)
