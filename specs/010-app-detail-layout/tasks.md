# Tasks: App Detail Layout Improvement

**Input**: Design documents from `/specs/001-app-detail-layout/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: Not requested - POC phase with manual testing only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/frontend/src/`, `packages/backend/src/`
- Frontend components in `packages/frontend/src/components/`
- Pages in `packages/frontend/src/pages/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup required - frontend-only feature in existing project

*This phase is intentionally empty as the project structure already exists.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the modal component that User Stories 2 and 3 depend on

**⚠️ CRITICAL**: US2 and US3 cannot be completed without the CreateFlowModal component

- [x] T001 Create CreateFlowModal component in packages/frontend/src/components/flow/CreateFlowModal.tsx

**Component Requirements** (from research.md):
- Follow CreateAppModal pattern for modal structure
- Use fixed overlay with `bg-black/50` backdrop
- Centered modal with `flex items-center justify-center`
- Modal box with `bg-card border rounded-lg shadow-lg`
- Animation: `animate-in fade-in zoom-in-95 duration-200`
- Props: `isOpen`, `onClose`, `onSubmit`, `isLoading?`, `error?`
- Escape key handling (disabled during loading)
- Backdrop click to close (disabled during loading)
- Body scroll prevention when open
- Close button in header with X icon
- ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Reuse PromptInput component for form content
- Display error messages below form

**Checkpoint**: CreateFlowModal ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View App Information in Context (Priority: P1) 🎯 MVP

**Goal**: Display app info (slug, creation date, MCP endpoint, landing page) immediately below app name/description

**Independent Test**: Navigate to app detail page and verify app info appears directly below name/description, before the flows list

### Implementation for User Story 1

- [x] T002 [US1] Move App Info section from bottom to below sub-header in packages/frontend/src/pages/AppDetail.tsx
- [x] T003 [US1] Consolidate published links (MCP endpoint, landing page URL) into App Info section in packages/frontend/src/pages/AppDetail.tsx
- [x] T004 [US1] Ensure copy-to-clipboard functionality works for all URLs in the consolidated App Info section in packages/frontend/src/pages/AppDetail.tsx

**Acceptance Criteria**:
1. App info section (slug, creation date) appears immediately below app name and description
2. Published apps show MCP endpoint and landing page URL in app info section with copy functionality
3. Unpublished apps only show slug and creation date

**Checkpoint**: User Story 1 complete - app info is now visible in proper context

---

## Phase 4: User Story 2 - Create Flow via Modal (Priority: P2)

**Goal**: Replace inline flow creation form with "Create New Flow" button that opens CreateFlowModal

**Independent Test**: Click "Create New Flow" button and verify modal appears with prompt input form

### Implementation for User Story 2

- [x] T005 [US2] Add modal state (`isFlowModalOpen`) to AppDetail in packages/frontend/src/pages/AppDetail.tsx
- [x] T006 [US2] Replace inline PromptInput with "Create New Flow" button in packages/frontend/src/pages/AppDetail.tsx
- [x] T007 [US2] Add CreateFlowModal import and render at end of AppDetail component in packages/frontend/src/pages/AppDetail.tsx
- [x] T008 [US2] Update handleCreateFlow to close modal on success before navigating in packages/frontend/src/pages/AppDetail.tsx

**Acceptance Criteria**:
1. "Create New Flow" button visible in flows section
2. Clicking button opens modal with flow creation form
3. Modal can be closed via backdrop click, Escape key, or X button
4. Cannot close modal while loading (flow creation in progress)
5. Form submission creates flow, closes modal, and navigates to editor
6. Error messages display within the modal

**Checkpoint**: User Story 2 complete - flow creation now uses modal

---

## Phase 5: User Story 3 - Empty State Flow Creation (Priority: P3)

**Goal**: Ensure consistent modal experience when app has no flows

**Independent Test**: View an app with no flows and click button to create first flow

### Implementation for User Story 3

- [x] T009 [US3] Update empty state section to use "Create New Flow" button that opens modal in packages/frontend/src/pages/AppDetail.tsx

**Acceptance Criteria**:
1. Empty state (no flows) displays message with "Create New Flow" button
2. Clicking button opens same CreateFlowModal as for apps with existing flows

**Checkpoint**: User Story 3 complete - consistent modal experience for all states

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [x] T010 Run manual testing per quickstart.md testing checklist
- [x] T011 Verify all acceptance scenarios from spec.md pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Empty - existing project
- **Foundational (Phase 2)**: No dependencies - creates CreateFlowModal component
- **User Story 1 (Phase 3)**: No dependencies - layout-only changes in AppDetail.tsx
- **User Story 2 (Phase 4)**: Depends on T001 (CreateFlowModal component)
- **User Story 3 (Phase 5)**: Depends on T001 (CreateFlowModal component)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - can start immediately
- **User Story 2 (P2)**: Depends on T001 (CreateFlowModal)
- **User Story 3 (P3)**: Depends on T001 (CreateFlowModal) and can share implementation with US2

### Within Each User Story

- T002-T004 can be done in sequence within AppDetail.tsx (same file)
- T005-T008 must be done in sequence (state, button, modal render, handler update)
- T009 can be done after T005-T007 are complete

### Parallel Opportunities

- T001 (CreateFlowModal) and T002-T004 (US1 layout changes) can run in parallel
- US2 and US3 both modify AppDetail.tsx so cannot run in parallel with each other

---

## Parallel Example: Maximum Parallelism

```bash
# Phase 2 + Phase 3 can run in parallel:
Task 1: "Create CreateFlowModal in packages/frontend/src/components/flow/CreateFlowModal.tsx"
Task 2: "Move App Info section in packages/frontend/src/pages/AppDetail.tsx"

# After T001 completes, US2 and US3 can proceed sequentially
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Skip Phase 1 (no setup needed)
2. Skip Phase 2 if only US1 needed (modal not required for US1)
3. Complete Phase 3: User Story 1 (T002-T004)
4. **STOP and VALIDATE**: Test layout changes independently
5. Deploy/demo if ready

### Incremental Delivery

1. T001 + T002-T004 in parallel → Foundation + US1 ready
2. T005-T008 → US2 complete (modal flow creation)
3. T009 → US3 complete (empty state)
4. T010-T011 → Final validation

### Recommended Execution Order

For a single developer:
1. T001 - Create CreateFlowModal (blocking for US2/US3)
2. T002-T004 - Complete US1 (layout changes)
3. T005-T008 - Complete US2 (modal integration)
4. T009 - Complete US3 (empty state)
5. T010-T011 - Polish

---

## Notes

- All AppDetail.tsx changes (T002-T009) affect the same file - work sequentially to avoid conflicts
- CreateFlowModal (T001) is in a different file and can be developed in parallel with US1
- No backend changes required - frontend-only feature
- Manual testing only (POC phase) - no automated tests
- Follow existing modal patterns from CreateAppModal for consistency
