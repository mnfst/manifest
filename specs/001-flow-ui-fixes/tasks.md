# Tasks: Flow UI Fixes

**Input**: Design documents from `/specs/001-flow-ui-fixes/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Not required (POC phase - manual testing per constitution)

**Organization**: Tasks grouped by user story (5 bug fixes). Each fix is independent and can be completed/tested separately.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Exact file paths included in descriptions

## Path Conventions

- **Frontend**: `packages/frontend/src/`
- **Backend**: `packages/backend/src/`

---

## Phase 1: Setup

**Purpose**: No setup required - all fixes are changes to existing files

*No tasks in this phase*

---

## Phase 2: Foundational

**Purpose**: No foundational work required - each fix is isolated to specific files

*No tasks in this phase*

**Checkpoint**: Ready to proceed with user story implementation

---

## Phase 3: User Story 1 - Preview Flow Without UI Nodes (Priority: P1) 🎯

**Goal**: Enable the Preview tab for flows that have any nodes, not just UI nodes (StatCard/PostList)

**Independent Test**: Create a flow with only UserIntent → Return nodes (no StatCard/PostList) and verify Preview tab is enabled

### Implementation for User Story 1

- [x] T001 [US1] Change Preview tab disabled condition from `interfaceNodes.length === 0` to `nodes.length === 0` in `packages/frontend/src/pages/FlowDetail.tsx:582`

**Checkpoint**: Preview tab should now be enabled for any flow with at least one node

---

## Phase 4: User Story 2 - Transformer Node Visual Update (Priority: P1) 🎯

**Goal**: Make transformer nodes appear immediately on the canvas after insertion without page reload

**Independent Test**: Add a transformer between two connected nodes and verify it appears immediately with both connections visible

### Implementation for User Story 2

- [x] T002 [P] [US2] Add `onFlowUpdate?: (flow: Flow) => void` prop to FlowDiagramProps interface in `packages/frontend/src/components/flow/FlowDiagram.tsx:40-58`
- [x] T003 [P] [US2] Pass `onFlowUpdate` callback from FlowDetail to FlowDiagram in `packages/frontend/src/pages/FlowDetail.tsx:708-721`
- [x] T004 [US2] Modify `onTransformerInserted` callback to fetch fresh flow data and call `onFlowUpdate` in `packages/frontend/src/components/flow/FlowDiagram.tsx:718-722`
- [x] T005 [US2] In FlowDetail, implement the `onFlowUpdate` handler that calls `setFlow()` with the new flow data in `packages/frontend/src/pages/FlowDetail.tsx`

**Checkpoint**: Transformer nodes appear immediately on canvas with correct upstream and downstream connections

---

## Phase 5: User Story 3 - Share Modal Working URLs (Priority: P2)

**Goal**: Display complete absolute URLs in the share modal that work when copied and shared

**Independent Test**: Open share modal for a published app and verify both URLs include the domain and work when opened

### Implementation for User Story 3

- [x] T006 [US3] Create `getAbsoluteUrl` helper function that uses `window.location.origin` when BACKEND_URL is empty or relative in `packages/frontend/src/components/app/ShareModal.tsx`
- [x] T007 [US3] Update `landingPageUrl` and `mcpEndpointUrl` to use the `getAbsoluteUrl` helper in `packages/frontend/src/components/app/ShareModal.tsx:18-19`

**Checkpoint**: Share modal displays complete URLs with domain that work when opened in browser

---

## Phase 6: User Story 4 - PostList Node Addition (Priority: P2)

**Goal**: Make PostList node creation work when selected from node library

**Independent Test**: Select "Post List" from node library and verify node appears on canvas with code editor opening

### Implementation for User Story 4

- [x] T008 [US4] Add console logging to debug PostList node creation in `handleNodeLibrarySelect` in `packages/frontend/src/pages/FlowDetail.tsx:256-281`
- [x] T009 [US4] Add user-visible error feedback (toast/alert) if node creation fails in `packages/frontend/src/pages/FlowDetail.tsx:277-279`
- [x] T010 [US4] Verify and fix any issues with the PostList branch of `handleNodeLibrarySelect` callback in `packages/frontend/src/pages/FlowDetail.tsx:256-281`
- [x] T011 [US4] Remove debug logging after fix is verified in `packages/frontend/src/pages/FlowDetail.tsx`

**Checkpoint**: PostList nodes are successfully created 100% of the time when selected from node library

---

## Phase 7: User Story 5 - API Key Settings Link (Priority: P3)

**Goal**: Add a clickable link to Settings page when API key is required for preview

**Independent Test**: Remove API key, view Preview tab, and verify clickable link navigates to Settings

### Implementation for User Story 5

- [x] T012 [P] [US5] Import `Link` from `react-router-dom` in `packages/frontend/src/components/chat/PreviewChat.tsx`
- [x] T013 [US5] Replace the plain text "Settings > API Keys" with a React Router `<Link to="/settings">` component in `packages/frontend/src/components/chat/PreviewChat.tsx:184-186`
- [x] T014 [US5] Style the link to match the existing UI (text-primary underline on hover) in `packages/frontend/src/components/chat/PreviewChat.tsx`

**Checkpoint**: Users can navigate from API Key Required message to Settings with single click

---

## Phase 8: Additional Improvements

**Purpose**: User-requested enhancements

- [x] T015 [EXTRA] Add copy button to sample data in UI card edit preview in `packages/frontend/src/components/editor/ComponentPreview.tsx`

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [x] T016 Run all quickstart.md test scenarios to verify all 5 fixes work correctly
- [x] T017 Remove any debug code or console.log statements added during development

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A - no setup needed
- **Foundational (Phase 2)**: N/A - no foundational work needed
- **User Stories (Phase 3-7)**: All independent - can be done in any order or parallel
- **Polish (Phase 8)**: After all user stories complete

### User Story Dependencies

All user stories are **completely independent** - they modify different files and can be implemented in any order:

| Story | Files Modified | Dependencies |
|-------|---------------|--------------|
| US1 (Preview tab) | FlowDetail.tsx | None |
| US2 (Transformer) | FlowDiagram.tsx, FlowDetail.tsx | None |
| US3 (Share URLs) | ShareModal.tsx | None |
| US4 (PostList) | FlowDetail.tsx | None |
| US5 (Settings link) | PreviewChat.tsx | None |

**Note**: US2 and US4 both modify FlowDetail.tsx but in different functions, so they can still be done in parallel.

### Parallel Opportunities

All user stories can run in parallel since they affect different functionality:

```bash
# All five stories can be done simultaneously:
Task: US1 - Preview tab fix (FlowDetail.tsx - tabs config)
Task: US2 - Transformer fix (FlowDiagram.tsx + FlowDetail.tsx - onFlowUpdate)
Task: US3 - Share URLs fix (ShareModal.tsx)
Task: US4 - PostList fix (FlowDetail.tsx - handleNodeLibrarySelect)
Task: US5 - Settings link (PreviewChat.tsx)
```

Within US2, tasks T002 and T003 can run in parallel (different files).

---

## Implementation Strategy

### Recommended Order (by Priority)

1. **US1 (P1)**: Preview tab - Single line change, quick win
2. **US2 (P1)**: Transformer - More complex, involves prop threading
3. **US3 (P2)**: Share URLs - Self-contained fix
4. **US4 (P2)**: PostList - May need debugging
5. **US5 (P3)**: Settings link - Simple UX improvement

### MVP First

Complete US1 and US2 (both P1) first - these address the most critical user-blocking issues.

### Quick Wins

US1 (T001) and US5 (T012-T014) are the simplest changes - good candidates for immediate implementation.

---

## Notes

- All fixes are frontend-only
- No new dependencies required
- Each fix follows existing patterns in the codebase
- Manual testing per POC constitution (no automated tests required)
- Commit after each user story for clean git history
