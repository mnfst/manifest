# Tasks: App List Home Page and Header Navigation

**Input**: Design documents from `/specs/003-app-list-header/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/

**Tests**: POC scope - no automated tests required per constitution

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: API client function needed by multiple user stories

- [ ] T001 Add listApps() function to frontend API client in packages/frontend/src/lib/api.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend endpoint that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Add findAll() method to AppService in packages/backend/src/app/app.service.ts (returns all apps sorted by createdAt DESC)
- [ ] T003 Add GET /api/apps endpoint to AppController in packages/backend/src/app/app.controller.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - App List Home Page (Priority: P1) 🎯 MVP

**Goal**: Users land on the home page and see a list of all existing apps in the system

**Independent Test**: Navigate to root URL ("/"), verify app list is displayed with all existing apps, verify each app card is clickable and navigates to the app dashboard

### Implementation for User Story 1

- [ ] T004 [P] [US1] Create AppCard component in packages/frontend/src/components/app/AppCard.tsx (display name, description, status badge, click to navigate)
- [ ] T005 [P] [US1] Create AppList component in packages/frontend/src/components/app/AppList.tsx (grid layout, empty state handling)
- [ ] T006 [US1] Modify Home page to display AppList instead of AppForm in packages/frontend/src/pages/Home.tsx
- [ ] T007 [US1] Add loading and error states to Home page in packages/frontend/src/pages/Home.tsx

**Checkpoint**: User Story 1 complete - users can view all apps from home page

---

## Phase 4: User Story 2 - Create New App Button (Priority: P2)

**Goal**: Users can click a "Create new app" button that reveals the app creation form

**Independent Test**: On home page, click "Create new app" button, verify form appears, fill form and submit, verify new app appears in list

### Implementation for User Story 2

- [ ] T008 [P] [US2] Create CreateAppModal component in packages/frontend/src/components/app/CreateAppModal.tsx (modal wrapper for AppForm, backdrop click to close)
- [ ] T009 [US2] Add "Create new app" button and modal state to Home page in packages/frontend/src/pages/Home.tsx
- [ ] T010 [US2] Implement modal open/close logic and form submission in packages/frontend/src/pages/Home.tsx (refresh list after creation, navigate to new app)

**Checkpoint**: User Story 2 complete - users can create apps from home page

---

## Phase 5: User Story 3 - App Switcher in Header (Priority: P3)

**Goal**: Header displays current app name with dropdown to switch between apps

**Independent Test**: Navigate to an app dashboard, verify app name appears in header, click on app name, verify dropdown shows other apps, click another app, verify navigation occurs

### Implementation for User Story 3

- [ ] T011 [P] [US3] Create AppSwitcher component in packages/frontend/src/components/layout/AppSwitcher.tsx (dropdown with app list, click-outside-to-close)
- [ ] T012 [P] [US3] Create Header component skeleton in packages/frontend/src/components/layout/Header.tsx (logo, center section for app switcher, right section placeholder)
- [ ] T013 [US3] Integrate AppSwitcher into Header component in packages/frontend/src/components/layout/Header.tsx
- [ ] T014 [US3] Add Header to AppDetail page in packages/frontend/src/pages/AppDetail.tsx (pass currentApp prop)
- [ ] T015 [P] [US3] Add Header to FlowDetail page in packages/frontend/src/pages/FlowDetail.tsx (fetch app and pass to Header)
- [ ] T016 [P] [US3] Add Header to ViewEditor page in packages/frontend/src/pages/ViewEditor.tsx (fetch app and pass to Header)

**Checkpoint**: User Story 3 complete - users can switch between apps from any app page

---

## Phase 6: User Story 4 - Dummy User Avatar (Priority: P4)

**Goal**: Header displays a dummy user name and avatar on the top right

**Independent Test**: Navigate to any page, verify user avatar and name appear in top-right corner of header

### Implementation for User Story 4

- [ ] T017 [P] [US4] Create UserAvatar component in packages/frontend/src/components/layout/UserAvatar.tsx (circular avatar with initials, hardcoded "Demo User")
- [ ] T018 [US4] Integrate UserAvatar into Header right section in packages/frontend/src/components/layout/Header.tsx

**Checkpoint**: User Story 4 complete - dummy user display visible in header

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T019 Add empty state styling consistency across AppList in packages/frontend/src/components/app/AppList.tsx
- [ ] T020 Handle long app names with truncation in AppSwitcher dropdown in packages/frontend/src/components/layout/AppSwitcher.tsx
- [ ] T021 Add max-height and scroll to AppSwitcher dropdown for many apps in packages/frontend/src/components/layout/AppSwitcher.tsx
- [ ] T022 Validate quickstart.md workflow end-to-end (create app → view list → switch apps → verify header)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (API client needed) - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories should be done in priority order: US1 → US2 → US3 → US4
  - US2 depends on US1 (adds to home page that US1 creates)
  - US3 and US4 are independent of US1/US2 (header is separate from home page)
- **Polish (Phase 7)**: Depends on all user stories being complete

### Within Each User Story

- Parallel tasks can be done simultaneously
- Components before page integration
- Core functionality before polish

### Parallel Opportunities

**Phase 3 (US1):**
- T004, T005 can run in parallel (different components)

**Phase 5 (US3):**
- T011, T012 can run in parallel (different components)
- T015, T016 can run in parallel (different pages)

**Phase 6 (US4):**
- T017 can run in parallel with other work (independent component)

---

## Parallel Example: User Story 1

```bash
# Launch parallel component creation:
Task T004: "Create AppCard component in packages/frontend/src/components/app/AppCard.tsx"
Task T005: "Create AppList component in packages/frontend/src/components/app/AppList.tsx"

# Then sequential integration:
Task T006: "Modify Home page to display AppList" (depends on T005)
Task T007: "Add loading and error states" (depends on T006)
```

---

## Parallel Example: User Story 3

```bash
# Launch parallel component creation:
Task T011: "Create AppSwitcher component"
Task T012: "Create Header component skeleton"

# Then integration:
Task T013: "Integrate AppSwitcher into Header" (depends on T011, T012)

# Finally, parallel page updates (all can run together after T013):
Task T014: "Add Header to AppDetail page"
Task T015: "Add Header to FlowDetail page"
Task T016: "Add Header to ViewEditor page"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (API client)
2. Complete Phase 2: Foundational (backend endpoint)
3. Complete Phase 3: User Story 1 (app list display)
4. **STOP and VALIDATE**: Test app list displays correctly
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test app list → Deploy/Demo (MVP!)
3. Add User Story 2 → Test app creation modal → Deploy/Demo
4. Add User Story 3 → Test header and app switching → Deploy/Demo
5. Add User Story 4 → Test user avatar display → Deploy/Demo
6. Polish → Final validation

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (User Story 1)**

This delivers:
- Backend endpoint to list all apps
- Home page showing app list grid
- Clickable cards navigating to app dashboard
- Empty state when no apps exist

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story builds on previous but adds independent value
- POC scope: No automated tests per constitution
- Commit after each task or logical group
