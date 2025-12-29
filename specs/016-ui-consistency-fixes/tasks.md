# Tasks: UI Consistency Fixes

**Input**: Design documents from `/specs/016-ui-consistency-fixes/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Not required (POC mode - manual testing acceptable per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/frontend/src/` for frontend code
- All tasks are frontend-only (no backend changes required)

---

## Phase 1: Setup

**Purpose**: No setup tasks required - modifying existing project structure

*All dependencies already installed (React, lucide-react, Tailwind CSS)*

**Checkpoint**: Ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the new SidebarAppSelector component that is required by multiple user stories

**⚠️ CRITICAL**: US1, US2, and US3 all depend on this component

- [x] T001 Create SidebarAppSelector component with dropdown logic in packages/frontend/src/components/layout/SidebarAppSelector.tsx

**Component requirements**:
- Display current app logo, name, and chevron-down icon (ChevronDown from lucide-react)
- Implement dropdown with click-outside and escape key handlers (follow AppSwitcher.tsx pattern)
- Load all apps via api.listApps() when dropdown opens
- Show each app with logo and name in dropdown
- Include "Create new app" link with Plus icon at bottom
- Handle navigation to selected app via useNavigate()
- Accept onCreateApp prop callback for modal trigger
- Handle edge cases: no apps, long names (truncate), no logo (placeholder)

**Checkpoint**: SidebarAppSelector ready - user story implementation can begin

---

## Phase 3: User Story 1 - App Selection from Sidebar (Priority: P1) 🎯 MVP

**Goal**: Users can switch between apps directly from the sidebar without navigating to a separate page

**Independent Test**: Click app selector in sidebar, verify dropdown shows all apps with logos/names, select different app and verify navigation works, click "Create new app" and verify modal opens

### Implementation for User Story 1

- [x] T002 [US1] Integrate SidebarAppSelector into Sidebar component in packages/frontend/src/components/layout/Sidebar.tsx
  - Import SidebarAppSelector
  - Add component below logo section with border separator
  - Add CreateAppModal state and pass onCreateApp callback
  - Remove "Apps" navigation item from nav list

- [x] T003 [US1] Add CreateAppModal integration to Sidebar in packages/frontend/src/components/layout/Sidebar.tsx
  - Import CreateAppModal component
  - Add isCreateModalOpen state
  - Render modal with open/close handlers

**Checkpoint**: App selection works from sidebar on all pages

---

## Phase 4: User Story 2 - Top Header Removal (Priority: P1)

**Goal**: Remove the redundant top header bar from app-scoped pages to provide more vertical space

**Independent Test**: Navigate to AppDetail, FlowDetail, and ViewEditor pages; verify no top header bar is displayed

### Implementation for User Story 2

- [x] T004 [P] [US2] Remove Header component from AppDetail page in packages/frontend/src/pages/AppDetail.tsx
  - Remove Header import
  - Remove <Header /> from JSX

- [x] T005 [P] [US2] Remove Header component from FlowDetail page in packages/frontend/src/pages/FlowDetail.tsx
  - Remove Header import
  - Remove <Header /> from JSX

- [x] T006 [P] [US2] Remove Header component from ViewEditor page in packages/frontend/src/pages/ViewEditor.tsx (if exists)
  - Remove Header import if present
  - Remove <Header /> from JSX if present

**Checkpoint**: No header bar on any content pages, content starts at top

---

## Phase 5: User Story 3 - App List View Removal (Priority: P1)

**Goal**: Remove the standalone app list page and redirect root URL to first app

**Independent Test**: Navigate to "/" with apps present and verify redirect to first app; navigate with no apps and verify create prompt appears

### Implementation for User Story 3

- [x] T007 [US3] Create HomeRedirect component and update routing in packages/frontend/src/App.tsx
  - Create inline HomeRedirect component with api.listApps() call
  - If apps exist: navigate to first app with replace: true
  - If no apps: render create app prompt or show message
  - Replace Home route element with HomeRedirect

- [x] T008 [US3] Remove or deprecate Home.tsx page in packages/frontend/src/pages/Home.tsx
  - Either delete file or add @deprecated JSDoc comment
  - Update any imports that reference Home component

**Checkpoint**: Root URL "/" redirects appropriately, app list page no longer accessible

---

## Phase 6: User Story 4 - App Edit Button in App Detail (Priority: P2)

**Goal**: Users can edit an app after creation via a visible edit button

**Independent Test**: Navigate to any app detail page, verify edit button is visible next to app name, click it and verify EditAppModal opens with correct data

### Implementation for User Story 4

- [x] T009 [US4] Add edit button and EditAppModal integration to AppDetail in packages/frontend/src/pages/AppDetail.tsx
  - Import Pencil icon from lucide-react
  - Import EditAppModal component
  - Add isEditModalOpen state
  - Add edit button with pencil icon next to app name (follow FlowDetail pattern)
  - Render EditAppModal with app data and handlers
  - Add handleAppUpdate callback to refresh app data after save

**Checkpoint**: App can be edited from detail page with one click

---

## Phase 7: User Story 5 - Create New Flow Button Positioning (Priority: P2)

**Goal**: Move "Create New Flow" button to top of flows section for consistency

**Independent Test**: Navigate to app detail page, verify "Create New Flow" button appears at top of Flows section (in header area with section title)

### Implementation for User Story 5

- [x] T010 [US5] Reposition Create New Flow button in AppDetail in packages/frontend/src/pages/AppDetail.tsx
  - Find current "Create New Flow" button (likely after FlowList)
  - Move button to header area of Flows section
  - Create section header with flex layout: title on left, button on right
  - Use primary button style with Plus icon
  - Keep empty state button in FlowList as secondary action

**Checkpoint**: Create button is consistently positioned at top of list sections

---

## Phase 8: User Story 6 - Flow Editor Tabs Centering (Priority: P3)

**Goal**: Center the Build/Preview/Usage tabs horizontally for better visual balance

**Independent Test**: Open any flow, verify tabs are horizontally centered within available width

### Implementation for User Story 6

- [x] T011 [US6] Center tabs container in FlowDetail in packages/frontend/src/pages/FlowDetail.tsx
  - Find tabs container div (currently px-6 bg-background or similar)
  - Add flex justify-center to container
  - Verify tabs remain functional and properly spaced

**Checkpoint**: Tabs are visually centered in flow editor

---

## Phase 9: User Story 7 - Usage Tab Icon Update (Priority: P3)

**Goal**: Replace BookOpen icon with a chart/metrics icon for Usage tab

**Independent Test**: View Flow Detail tabs, verify Usage tab shows BarChart3 icon instead of BookOpen

### Implementation for User Story 7

- [x] T012 [US7] Update Usage tab icon in FlowDetail in packages/frontend/src/pages/FlowDetail.tsx
  - Change import from BookOpen to BarChart3 (lucide-react)
  - Update tabs array to use BarChart3 for usage tab icon

**Checkpoint**: Usage tab icon represents metrics/analytics

---

## Phase 10: User Story 8 - Steps Bar Removal (Priority: P3)

**Goal**: Remove the redundant Steps header bar with Add Step button

**Independent Test**: Open any flow in Build tab, verify no "Steps" header bar or "Add Step" button appears above the flow diagram

### Implementation for User Story 8

- [x] T013 [US8] Remove Steps header bar from FlowDetail Build tab in packages/frontend/src/pages/FlowDetail.tsx
  - Locate steps header section (likely div with "Steps" heading and "Add Step" button)
  - Remove entire section
  - Verify flow diagram still renders correctly
  - Ensure addStep functionality is only available from diagram nodes

**Checkpoint**: Steps bar removed, cleaner flow editor interface

---

## Phase 11: Polish & Cleanup

**Purpose**: Remove unused code and verify consistency

- [x] T014 [P] Delete unused Header.tsx component in packages/frontend/src/components/layout/Header.tsx
  - Remove file entirely since it's no longer imported anywhere

- [x] T015 [P] Delete or deprecate AppSwitcher.tsx if no longer used in packages/frontend/src/components/layout/AppSwitcher.tsx
  - Check if AppSwitcher is still referenced
  - If not: delete file
  - If yes: verify it's still needed or update to use new pattern

- [x] T016 Verify all imports are cleaned up across modified files
  - Remove unused Header imports
  - Remove unused icon imports (BookOpen if replaced)
  - Ensure no TypeScript errors

- [x] T017 Run application and perform manual testing per quickstart.md checklist
  - Use .specify/scripts/bash/serve-app.sh to start application
  - Verify all 15 items in quickstart.md Testing Checklist pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks - ready immediately
- **Foundational (Phase 2)**: T001 - BLOCKS US1, US2, US3
- **User Stories (Phase 3-10)**: Depend on Foundational completion
  - US1, US2, US3 (all P1) can proceed in parallel after T001
  - US4, US5 (P2) can run after or parallel with US1-3
  - US6, US7, US8 (P3) can run after or parallel with earlier stories
- **Polish (Phase 11)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on T001 (SidebarAppSelector)
- **User Story 2 (P1)**: Can run in parallel with US1 (different files)
- **User Story 3 (P1)**: Can run in parallel with US1/US2 (different files)
- **User Story 4 (P2)**: Independent - only modifies AppDetail
- **User Story 5 (P2)**: Can run with US4 (both modify AppDetail but different sections)
- **User Story 6 (P3)**: Independent - only modifies FlowDetail
- **User Story 7 (P3)**: Can run with US6 (same file, different code areas)
- **User Story 8 (P3)**: Can run with US6/US7 (same file, different sections)

### Parallel Opportunities

**After T001 completes, these can run in parallel:**
```
Team member A: T002, T003 (US1 - Sidebar integration)
Team member B: T004, T005, T006 (US2 - Header removal)
Team member C: T007, T008 (US3 - Home redirect)
```

**These can run in parallel within FlowDetail:**
```
T011, T012, T013 (US6, US7, US8 - all modify FlowDetail.tsx but different sections)
```

---

## Parallel Example: User Stories 1-3 (P1)

```bash
# After T001 completes, launch all P1 stories together:
Task: "Integrate SidebarAppSelector into Sidebar component"
Task: "Remove Header component from AppDetail page"
Task: "Remove Header component from FlowDetail page"
Task: "Create HomeRedirect component and update routing"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete T001: SidebarAppSelector
2. Complete T002-T003: Sidebar integration (US1)
3. Complete T004-T006: Header removal (US2)
4. Complete T007-T008: Home redirect (US3)
5. **STOP and VALIDATE**: Core navigation restructuring complete
6. Deploy/demo if ready

### Incremental Delivery

1. T001 → Foundation ready
2. Add US1 (T002-T003) → App switching works from sidebar
3. Add US2 (T004-T006) → Header removed, more vertical space
4. Add US3 (T007-T008) → No app list, clean navigation
5. Add US4-5 (T009-T010) → Edit button and button positioning
6. Add US6-8 (T011-T013) → Visual polish in flow editor
7. Cleanup (T014-T017) → Production ready

---

## Notes

- All tasks are frontend-only (packages/frontend/src/)
- No API changes required
- POC mode: Manual testing acceptable (no automated tests required)
- T001 is the critical path - all P1 stories depend on it
- Most tasks modify single files - low risk of conflicts
- Commit after each task for easy rollback
- Stop at any checkpoint to validate independently
