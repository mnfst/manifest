# Tasks: App & Flow Management

**Input**: Design documents from `/specs/005-app-flow-management/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are DEFERRED per constitution (POC phase). Manual testing only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `packages/backend/src/`
- **Frontend**: `packages/frontend/src/`
- **Shared**: `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared types and backend infrastructure used by multiple user stories

- [x] T001 [P] Add AppWithFlowCount interface in packages/shared/src/types/app.ts
- [x] T002 [P] Add DeleteAppResponse interface in packages/shared/src/types/app.ts
- [x] T003 [P] Add FlowDeletionCheck interface in packages/shared/src/types/flow.ts
- [x] T004 [P] Add DeleteFlowResponse interface in packages/shared/src/types/flow.ts
- [x] T005 Export new types from packages/shared/src/types/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend changes that MUST be complete before frontend work

**⚠️ CRITICAL**: No frontend user story work can begin until this phase is complete

- [x] T006 Modify findAll() in packages/backend/src/app/app.service.ts to include flowCount using loadRelationCountAndMap
- [x] T007 Add delete() method to packages/backend/src/app/app.service.ts with cascade delete
- [x] T008 Add DELETE endpoint to packages/backend/src/app/app.controller.ts for /api/apps/:appId
- [x] T009 Add checkDeletion() method to packages/backend/src/flow/flow.service.ts to check last-flow and app-published status
- [x] T010 Add GET endpoint to packages/backend/src/flow/flow.controller.ts for /api/flows/:flowId/deletion-check
- [x] T011 Create reusable DeleteConfirmDialog component in packages/frontend/src/components/common/DeleteConfirmDialog.tsx

**Checkpoint**: Backend APIs ready, DeleteConfirmDialog available - frontend story implementation can now begin

---

## Phase 3: User Story 1 - Edit App Details (Priority: P1) 🎯 MVP

**Goal**: Users can edit app name and description from the app list via a modal

**Independent Test**: Create an app, click edit on its card, change name/description, save, verify changes persist in the list

### Implementation for User Story 1

- [ ] T012 [US1] Create EditAppModal component in packages/frontend/src/components/app/EditAppModal.tsx (based on CreateAppModal pattern)
- [ ] T013 [US1] Add onEdit prop and edit button to AppCard in packages/frontend/src/components/app/AppCard.tsx
- [ ] T014 [US1] Add edit state management and EditAppModal integration to Home page in packages/frontend/src/pages/Home.tsx
- [ ] T015 [US1] Add updateApp API call function in packages/frontend/src/pages/Home.tsx
- [ ] T016 [US1] Add form validation for app name (required, max 100 chars) in EditAppModal

**Checkpoint**: User Story 1 complete - users can edit apps from the app list

---

## Phase 4: User Story 2 - Delete App (Priority: P1)

**Goal**: Users can delete apps from the app list with confirmation dialog showing cascade warning

**Independent Test**: Create an app with flows, delete it from the list, verify app and flows are removed

### Implementation for User Story 2

- [ ] T017 [US2] Add onDelete prop and delete button to AppCard in packages/frontend/src/components/app/AppCard.tsx
- [ ] T018 [US2] Add delete state management and DeleteConfirmDialog integration to Home page in packages/frontend/src/pages/Home.tsx
- [ ] T019 [US2] Add deleteApp API call function with cascade warning message in packages/frontend/src/pages/Home.tsx
- [ ] T020 [US2] Update app list state after successful deletion in packages/frontend/src/pages/Home.tsx

**Checkpoint**: User Stories 1 & 2 complete - full app CRUD from app list

---

## Phase 5: User Story 3 - Edit Flow Details (Priority: P2)

**Goal**: Users can edit flow name, description, toolName, and toolDescription from the flow detail page

**Independent Test**: Navigate to a flow, edit its details, save, verify changes persist

### Implementation for User Story 3

- [ ] T021 [US3] Create EditFlowForm component in packages/frontend/src/components/flow/EditFlowForm.tsx with all editable fields
- [ ] T022 [US3] Add edit state and EditFlowForm integration to FlowDetail page in packages/frontend/src/pages/FlowDetail.tsx
- [ ] T023 [US3] Add updateFlow API call function in packages/frontend/src/pages/FlowDetail.tsx
- [ ] T024 [US3] Add form validation for flow fields (name required, toolName required, max lengths) in EditFlowForm

**Checkpoint**: User Story 3 complete - users can edit flows

---

## Phase 6: User Story 4 - Delete Flow (Priority: P2)

**Goal**: Users can delete flows from the flow detail page with last-flow warning for published apps

**Independent Test**: Create a flow, delete it, verify it's removed and user is redirected to app detail

### Implementation for User Story 4

- [ ] T025 [US4] Add delete button and DeleteConfirmDialog integration to FlowDetail page in packages/frontend/src/pages/FlowDetail.tsx
- [ ] T026 [US4] Add fetchDeletionCheck API call to check last-flow status before showing dialog in packages/frontend/src/pages/FlowDetail.tsx
- [ ] T027 [US4] Add dynamic warning message based on FlowDeletionCheck response in packages/frontend/src/pages/FlowDetail.tsx
- [ ] T028 [US4] Add deleteFlow API call and redirect to app detail after successful deletion in packages/frontend/src/pages/FlowDetail.tsx

**Checkpoint**: User Story 4 complete - users can delete flows with appropriate warnings

---

## Phase 7: User Story 5 - Display Flow Count on App Cards (Priority: P2)

**Goal**: App cards in the list display the number of flows with proper singular/plural formatting

**Independent Test**: Create apps with 0, 1, and 3 flows, verify each shows correct count ("No flows", "1 flow", "3 flows")

### Implementation for User Story 5

- [ ] T029 [US5] Add flowCount display to AppCard component in packages/frontend/src/components/app/AppCard.tsx
- [ ] T030 [US5] Add singular/plural formatting ("1 flow" vs "N flows") in AppCard
- [ ] T031 [US5] Update AppCard props interface to accept AppWithFlowCount in packages/frontend/src/components/app/AppCard.tsx

**Checkpoint**: User Story 5 complete - flow counts visible on all app cards

---

## Phase 8: User Story 6 - Prevent Publishing App Without Flows (Priority: P3)

**Goal**: Publish button is disabled when app has no flows, with tooltip explaining requirement

**Independent Test**: Create app without flows, verify publish button is disabled with tooltip

### Implementation for User Story 6

- [ ] T032 [US6] Pass flowCount to PublishButton component in packages/frontend/src/pages/AppDetail.tsx
- [ ] T033 [US6] Add disabled state and tooltip when flowCount=0 to PublishButton in packages/frontend/src/components/app/PublishButton.tsx
- [ ] T034 [US6] Update PublishButton props interface to accept flowCount in packages/frontend/src/components/app/PublishButton.tsx

**Checkpoint**: User Story 6 complete - publish guard enforced in UI

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T035 Verify all edit/delete operations handle loading and error states consistently
- [ ] T036 Run quickstart.md manual testing checklist
- [ ] T037 Verify cascade deletes work correctly (delete app removes flows, delete flow removes views)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - BLOCKS all frontend user stories
- **User Stories (Phases 3-8)**: All depend on Foundational (Phase 2) completion
  - US1 & US2 can run in parallel (different files, both P1)
  - US3 & US4 can run in parallel (different aspects of FlowDetail)
  - US5 can run in parallel with US3/US4 (AppCard vs FlowDetail)
  - US6 can run in parallel with others (AppDetail focus)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Can Start After | Independent? | Notes |
|-------|-----------------|--------------|-------|
| US1 (Edit App) | Phase 2 | ✅ Yes | No dependencies on other stories |
| US2 (Delete App) | Phase 2 | ✅ Yes | No dependencies on other stories |
| US3 (Edit Flow) | Phase 2 | ✅ Yes | No dependencies on other stories |
| US4 (Delete Flow) | Phase 2 | ✅ Yes | Uses deletion-check endpoint from Phase 2 |
| US5 (Flow Count) | Phase 2 | ✅ Yes | Uses flowCount from Phase 2 backend |
| US6 (Publish Guard) | Phase 2 | ✅ Yes | Uses flowCount, independent of other stories |

### Within Each User Story

- Components/forms before page integration
- API calls before state management
- Validation as final step

### Parallel Opportunities

**Phase 1 (all parallel):**
```
T001, T002, T003, T004 can run simultaneously
```

**Phase 2 (backend in parallel, then frontend):**
```
T006, T007, T008, T009, T010 can run in parallel
T011 (DeleteConfirmDialog) after backend is ready
```

**User Stories (can run in parallel with each other):**
```
US1 (T012-T016) can run parallel to US2 (T017-T020)
US3 (T021-T024) can run parallel to US4 (T025-T028)
US5 (T029-T031) can run parallel to US6 (T032-T034)
```

---

## Parallel Example: Phase 2 Backend

```bash
# Launch all backend tasks together:
Task: "Modify findAll() in packages/backend/src/app/app.service.ts"
Task: "Add delete() method to packages/backend/src/app/app.service.ts"
Task: "Add DELETE endpoint to packages/backend/src/app/app.controller.ts"
Task: "Add checkDeletion() method to packages/backend/src/flow/flow.service.ts"
Task: "Add GET endpoint to packages/backend/src/flow/flow.controller.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (shared types)
2. Complete Phase 2: Foundational (backend + DeleteConfirmDialog)
3. Complete Phase 3: User Story 1 (Edit App)
4. Complete Phase 4: User Story 2 (Delete App)
5. **STOP and VALIDATE**: Full app CRUD from app list works
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Backend ready
2. Add US1 + US2 → App edit/delete working → Deploy/Demo (MVP!)
3. Add US3 + US4 → Flow edit/delete working → Deploy/Demo
4. Add US5 → Flow counts visible → Deploy/Demo
5. Add US6 → Publish guard active → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With 2 developers after Foundational phase:
- Developer A: US1 (Edit App) → US3 (Edit Flow)
- Developer B: US2 (Delete App) → US4 (Delete Flow)

Then merge and both work on US5/US6/Polish.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Manual testing per constitution (POC phase)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing PATCH endpoints for app/flow already work - just need frontend integration
