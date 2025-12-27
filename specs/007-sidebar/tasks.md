# Tasks: Navigation Sidebar

**Input**: Design documents from `/specs/007-sidebar/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not included (POC phase - testing deferred per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared types and API infrastructure needed for all user stories

- [x] T001 [P] Add FlowWithApp interface to packages/shared/src/types/flow.ts
- [x] T002 [P] Add findAllWithApp method to packages/backend/src/flow/flow.service.ts
- [x] T003 Add GET /api/flows endpoint to packages/backend/src/flow/flow.controller.ts (depends on T002)
- [x] T004 Add getAllFlows API method to packages/frontend/src/lib/api.ts (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core layout integration that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create SidebarItem component in packages/frontend/src/components/layout/SidebarItem.tsx
- [x] T006 Create Sidebar component with navigation items in packages/frontend/src/components/layout/Sidebar.tsx (depends on T005)
- [x] T007 Integrate Sidebar into App.tsx layout structure in packages/frontend/src/App.tsx (depends on T006)

**Checkpoint**: Sidebar is visible on all pages - user story implementation can now begin

---

## Phase 3: User Story 1 - Sidebar Apps Shortcut (Priority: P1) 🎯 MVP

**Goal**: Sidebar displays "Apps" shortcut that navigates to app list page ("/") with active state highlighting

**Independent Test**: Open any page, verify sidebar visible with "Apps" shortcut, click it, verify navigation to "/" and "Apps" is highlighted

### Implementation for User Story 1

- [x] T008 [US1] Add Apps navigation item to Sidebar component with route "/" in packages/frontend/src/components/layout/Sidebar.tsx
- [x] T009 [US1] Implement active state detection using useLocation for Apps route in packages/frontend/src/components/layout/Sidebar.tsx
- [x] T010 [US1] Style active state highlighting for Apps item in packages/frontend/src/components/layout/SidebarItem.tsx

**Checkpoint**: Apps shortcut fully functional - can navigate to app list from any page

---

## Phase 4: User Story 2 - Sidebar Flows Shortcut (Priority: P1)

**Goal**: Sidebar displays "Flows" shortcut that navigates to flows listing page showing all flows with parent app context

**Independent Test**: Click "Flows" shortcut, verify flows page shows all flows with parent app names, click a flow to navigate to its detail page

### Implementation for User Story 2

- [x] T011 [P] [US2] Create FlowsPage component in packages/frontend/src/pages/FlowsPage.tsx
- [x] T012 [P] [US2] Create FlowCard component for flows listing in packages/frontend/src/components/flow/FlowCardWithApp.tsx
- [x] T013 [US2] Implement empty state for no flows in packages/frontend/src/pages/FlowsPage.tsx (depends on T011)
- [x] T014 [US2] Add /flows route to App.tsx router configuration in packages/frontend/src/App.tsx (depends on T011)
- [x] T015 [US2] Add Flows navigation item to Sidebar component with route "/flows" in packages/frontend/src/components/layout/Sidebar.tsx
- [x] T016 [US2] Implement active state detection for Flows route (including /flows/* paths) in packages/frontend/src/components/layout/Sidebar.tsx

**Checkpoint**: Flows shortcut fully functional - can view all flows with app context and navigate to flow details

---

## Phase 5: User Story 3 - Sidebar Persistence Across Navigation (Priority: P2)

**Goal**: Sidebar remains visible and active state updates correctly during navigation between all pages

**Independent Test**: Navigate through home → app detail → flow detail → view editor, verify sidebar visible and active section updates correctly at each step

### Implementation for User Story 3

- [x] T017 [US3] Verify sidebar renders on app detail route /app/:appId in packages/frontend/src/App.tsx
- [x] T018 [US3] Verify sidebar renders on flow detail route /app/:appId/flow/:flowId in packages/frontend/src/App.tsx
- [x] T019 [US3] Verify sidebar renders on view editor route /app/:appId/flow/:flowId/view/:viewId in packages/frontend/src/App.tsx
- [x] T020 [US3] Update active state logic to highlight "Flows" for all flow-related routes in packages/frontend/src/components/layout/Sidebar.tsx

**Checkpoint**: Sidebar persistence verified across all application routes

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T021 [P] Add hover states and transitions to sidebar items in packages/frontend/src/components/layout/SidebarItem.tsx
- [x] T022 [P] Add icons to Apps and Flows navigation items in packages/frontend/src/components/layout/Sidebar.tsx
- [x] T023 Run quickstart.md validation steps to verify complete feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on T001 (FlowWithApp type), T004 (API method) for Flows page
- **User Stories (Phase 3+)**: All depend on Foundational phase completion (T005-T007)
  - US1 and US2 can proceed in parallel after Foundational
  - US3 validates both US1 and US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Parallel with US1, uses Setup API (T003, T004)
- **User Story 3 (P2)**: Depends on US1 and US2 completion (validates their integration)

### Within Each User Story

- Core component before integration
- Route configuration after page component exists
- Active state after navigation item exists

### Parallel Opportunities

- T001 and T002 can run in parallel (different packages)
- T005 and T011 can run in parallel (different components)
- T011 and T012 can run in parallel (different files)
- T021 and T022 can run in parallel (polish tasks)

---

## Parallel Example: Setup Phase

```bash
# Launch shared type and backend service in parallel:
Task: "Add FlowWithApp interface to packages/shared/src/types/flow.ts"
Task: "Add findAllWithApp method to packages/backend/src/flow/flow.service.ts"
```

## Parallel Example: User Story 2

```bash
# Launch page and card components in parallel:
Task: "Create FlowsPage component in packages/frontend/src/pages/FlowsPage.tsx"
Task: "Create FlowCard component for flows listing in packages/frontend/src/components/flow/FlowCardWithApp.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (sidebar visible on all pages)
3. Complete Phase 3: User Story 1 (Apps shortcut works)
4. **STOP and VALIDATE**: Sidebar shows, Apps shortcut navigates to /
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Sidebar visible
2. Add User Story 1 → Apps navigation works → Deploy/Demo (MVP!)
3. Add User Story 2 → Flows page with listing → Deploy/Demo
4. Add User Story 3 → Verify persistence → Deploy/Demo
5. Each story adds value without breaking previous stories

### Recommended Execution Order

Since US1 and US2 are both P1 priority, recommended order is:
1. Setup (T001-T004)
2. Foundational (T005-T007)
3. US1 (T008-T010) - establishes sidebar pattern
4. US2 (T011-T016) - adds new page and API integration
5. US3 (T017-T020) - validates integration
6. Polish (T021-T023)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No automated tests included (POC phase - deferred per constitution)
