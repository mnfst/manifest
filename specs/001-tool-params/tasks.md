# Tasks: MCP Tool Parameters

**Input**: Design documents from `/specs/001-tool-params/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No automated tests (POC mode - manual testing only)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared type definitions that all components depend on

- [x] T001 Add ParameterType union type to packages/shared/src/types/flow.ts
- [x] T002 Add FlowParameter interface to packages/shared/src/types/flow.ts
- [x] T003 Update Flow interface with optional parameters field in packages/shared/src/types/flow.ts
- [x] T004 Update CreateFlowRequest interface with optional parameters field in packages/shared/src/types/flow.ts
- [x] T005 Update UpdateFlowRequest interface with optional parameters field in packages/shared/src/types/flow.ts
- [x] T006 Build shared package to verify types compile (npm run build -w packages/shared)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend entity and API changes that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Add parameters column (simple-json, nullable) to FlowEntity in packages/backend/src/flow/flow.entity.ts
- [x] T008 Update FlowService.entityToFlow() to include parameters (treat null as empty array) in packages/backend/src/flow/flow.service.ts
- [x] T009 Add parameter validation helper function (unique names, valid types, non-empty names, max 50 chars) in packages/backend/src/flow/flow.controller.ts
- [x] T010 Update FlowController.createFlow() to accept and validate parameters in packages/backend/src/flow/flow.controller.ts
- [x] T011 Update FlowController.updateFlow() to accept and validate parameters in packages/backend/src/flow/flow.controller.ts
- [x] T012 Restart backend to auto-sync schema and verify parameters column exists

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Add Parameters During Flow Creation (Priority: P1)

**Goal**: Users can define parameters (name, type, optional flag) when creating a new flow

**Independent Test**: Create a new flow, add 2-3 parameters of different types, submit form, verify parameters are persisted and visible after page refresh

### Implementation for User Story 1

- [x] T013 [P] [US1] Create ParameterRow component (name input, type dropdown, optional checkbox, remove button) in packages/frontend/src/components/flow/ParameterRow.tsx
- [x] T014 [P] [US1] Create ParameterEditor component (list of ParameterRow, add button, validation display) in packages/frontend/src/components/flow/ParameterEditor.tsx
- [x] T015 [US1] Integrate ParameterEditor into CreateFlowModal in packages/frontend/src/components/flow/CreateFlowModal.tsx
- [x] T016 [US1] Update CreateFlowModal form state to track parameters array in packages/frontend/src/components/flow/CreateFlowModal.tsx
- [x] T017 [US1] Update CreateFlowModal submit handler to include parameters in API request in packages/frontend/src/components/flow/CreateFlowModal.tsx
- [x] T018 [US1] Add client-side validation for parameter names (non-empty, unique, max 50 chars) in packages/frontend/src/components/flow/ParameterEditor.tsx

**Checkpoint**: User Story 1 complete - users can create flows with parameters

---

## Phase 4: User Story 2 - Edit Parameters on Existing Flow (Priority: P2)

**Goal**: Users can modify parameters (add, edit name/type/optional) on existing flows

**Independent Test**: Open existing flow with parameters, modify one parameter's name, add a new parameter, save, verify changes persist after refresh

### Implementation for User Story 2

- [x] T019 [US2] Add ParameterEditor to EditFlowForm in packages/frontend/src/components/flow/EditFlowForm.tsx
- [x] T020 [US2] Initialize ParameterEditor with existing flow parameters in packages/frontend/src/components/flow/EditFlowForm.tsx
- [x] T021 [US2] Update EditFlowForm submit handler to include parameters in PATCH request in packages/frontend/src/components/flow/EditFlowForm.tsx
- [x] T022 [US2] Ensure parameter changes are reflected in local state after save in packages/frontend/src/components/flow/EditFlowForm.tsx

**Checkpoint**: User Story 2 complete - users can edit existing flow parameters

---

## Phase 5: User Story 3 - Remove Parameters (Priority: P2)

**Goal**: Users can remove parameters from flows

**Independent Test**: Open flow with 3 parameters, remove middle parameter, save, verify only 2 parameters remain after refresh

### Implementation for User Story 3

- [x] T023 [US3] Implement remove handler in ParameterEditor (splice from array) in packages/frontend/src/components/flow/ParameterEditor.tsx
- [x] T024 [US3] Add remove button click handler to ParameterRow in packages/frontend/src/components/flow/ParameterRow.tsx
- [x] T025 [US3] Verify removing last parameter results in empty array (not null) in packages/frontend/src/components/flow/ParameterEditor.tsx

**Checkpoint**: User Story 3 complete - users can remove parameters from flows

---

## Phase 6: User Story 4 - View Parameter Count on Flow Cards (Priority: P3)

**Goal**: Flow cards display parameter count alongside view count

**Independent Test**: View flow list with multiple flows having different parameter counts, verify each card shows correct "X params • Y views" format

### Implementation for User Story 4

- [x] T026 [US4] Add paramCount calculation (flow.parameters?.length ?? 0) to FlowCard in packages/frontend/src/components/flow/FlowCard.tsx
- [x] T027 [US4] Update FlowCard display to show "{paramCount} params • {viewCount} views" in packages/frontend/src/components/flow/FlowCard.tsx
- [x] T028 [US4] Handle pluralization for param/params in display in packages/frontend/src/components/flow/FlowCard.tsx

**Checkpoint**: User Story 4 complete - parameter counts visible on flow cards

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T029 Run manual validation checklist from quickstart.md
- [x] T030 Verify backward compatibility (existing flows without parameters still work)
- [x] T031 Code cleanup and remove any debug console.log statements

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US4 have no cross-dependencies
  - US2 and US3 depend on ParameterEditor from US1
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Creates ParameterEditor component
- **User Story 2 (P2)**: Depends on US1 (reuses ParameterEditor) - Can run after US1
- **User Story 3 (P2)**: Depends on US1 (reuses ParameterEditor) - Can run after US1, parallel with US2
- **User Story 4 (P3)**: Can start after Foundational - Independent of other stories

### Parallel Opportunities

**Phase 1** (all can run in parallel - same file but different sections):
- T001-T005 are sequential edits to same file
- T006 depends on T001-T005

**Phase 2** (sequential - same files):
- T007-T011 are sequential edits
- T012 depends on all

**Phase 3 (US1)** (within story):
- T013 and T014 can run in parallel (different files)
- T015-T018 are sequential (same file)

**Phase 4-6** (cross-story):
- US2 (T019-T022) and US3 (T023-T025) can run in parallel after US1 completes
- US4 (T026-T028) can run in parallel with US1, US2, US3 (different component)

---

## Parallel Example: After Foundational Phase

```bash
# Developer A: User Story 1 (core parameter creation)
Task: T013 "Create ParameterRow component"
Task: T014 "Create ParameterEditor component"
# Then T015-T018 sequentially

# Developer B: User Story 4 (display - independent)
Task: T026 "Add paramCount calculation to FlowCard"
Task: T027 "Update FlowCard display"
Task: T028 "Handle pluralization"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (backend + API)
3. Complete Phase 3: User Story 1 (create flow with parameters)
4. **STOP and VALIDATE**: Test parameter creation end-to-end
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP ready
3. Add User Stories 2 & 3 (edit + remove) → Full CRUD functionality
4. Add User Story 4 → Enhanced discoverability
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- POC mode: No automated tests - use manual validation from quickstart.md
- TypeORM auto-sync handles schema changes (no migrations needed)
- Parameters stored as JSON column (simple-json) for simplicity
- Existing flows will have null/undefined parameters - treat as empty array
