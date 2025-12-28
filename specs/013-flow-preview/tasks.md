# Tasks: Flow Preview with Tabbed Interface

**Input**: Design documents from `/specs/013-flow-preview/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Not required (POC phase per constitution - manual testing acceptable)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (monorepo)**: `packages/frontend/src/`, `packages/backend/src/`
- This feature is **frontend-only** - all tasks are in `packages/frontend/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create foundational components that all user stories depend on

- [x] T001 [P] Create FlowDetailTab type definition in packages/frontend/src/types/tabs.ts
- [x] T002 [P] Create useTypingAnimation hook in packages/frontend/src/hooks/useTypingAnimation.ts
- [x] T003 Create Tabs component with disabled state support in packages/frontend/src/components/common/Tabs.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core components that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create ChatMessage component with avatar and bubble styling in packages/frontend/src/components/preview/ChatMessage.tsx
- [x] T005 Create ChatConversation container component in packages/frontend/src/components/preview/ChatConversation.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Preview Flow as ChatGPT Conversation (Priority: P1)

**Goal**: Enable users to preview their flow rendered as a simulated ChatGPT conversation with typing animation and LLM response displaying the component view

**Independent Test**: Create a flow with views, switch to Preview tab, observe animated conversation with rendered component. Verify ChatGPT dark theme styling matches.

### Implementation for User Story 1

- [x] T006 [US1] Create FlowPreview orchestrator component in packages/frontend/src/components/preview/FlowPreview.tsx
- [x] T007 [US1] Implement animation phase state machine (idle → typing → thinking → response → complete) in FlowPreview
- [x] T008 [US1] Integrate LayoutRenderer for component view in LLM response in packages/frontend/src/components/preview/FlowPreview.tsx
- [x] T009 [US1] Add ChatGPT dark theme styling to conversation container using existing chatgpt.ts tokens

**Checkpoint**: User Story 1 core functionality complete - preview shows animated conversation with component view

---

## Phase 4: User Story 2 - Switch Between Build and Preview Modes (Priority: P1)

**Goal**: Enable seamless tab switching between Build, Preview, and Usage tabs while preserving state

**Independent Test**: Edit flow in Build tab, switch to Preview, verify changes appear, switch back, confirm edits preserved. Test tab switching < 300ms.

### Implementation for User Story 2

- [x] T010 [US2] Add tab state (activeTab, previewKey) to FlowDetail page in packages/frontend/src/pages/FlowDetail.tsx
- [x] T011 [US2] Integrate Tabs component into FlowDetail header area in packages/frontend/src/pages/FlowDetail.tsx
- [x] T012 [US2] Implement conditional rendering for Build/Preview/Usage content in packages/frontend/src/pages/FlowDetail.tsx
- [x] T013 [US2] Add Preview tab disabled logic when flow has no views in packages/frontend/src/pages/FlowDetail.tsx
- [x] T014 [US2] Implement animation restart on tab switch (previewKey increment) in packages/frontend/src/pages/FlowDetail.tsx
- [x] T015 [US2] Wrap existing FlowDiagram in Build tab conditional in packages/frontend/src/pages/FlowDetail.tsx
- [x] T016 [US2] Integrate FlowPreview component in Preview tab conditional in packages/frontend/src/pages/FlowDetail.tsx

**Checkpoint**: Full tab switching functional - Build shows diagram, Preview shows conversation, state preserved

---

## Phase 5: User Story 3 - View Usage Tab Placeholder (Priority: P3)

**Goal**: Display "Coming Soon..." placeholder message in the Usage tab

**Independent Test**: Click Usage tab, verify centered "Coming Soon..." message appears

### Implementation for User Story 3

- [x] T017 [US3] Add Usage tab placeholder content in packages/frontend/src/pages/FlowDetail.tsx

**Checkpoint**: All three tabs functional with appropriate content

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, refinements, and validation

- [x] T018 Handle long flow names with truncation in ChatMessage component in packages/frontend/src/components/preview/ChatMessage.tsx
- [x] T019 Handle flows with no mock data (use defaults) in FlowPreview in packages/frontend/src/components/preview/FlowPreview.tsx
- [x] T020 [P] Add user avatar icon (lucide-react User) to user message in packages/frontend/src/components/preview/ChatMessage.tsx
- [x] T021 [P] Add LLM avatar icon (lucide-react Sparkles or Bot) to assistant message in packages/frontend/src/components/preview/ChatMessage.tsx
- [x] T022 Verify animation timing targets (typing < 2s, total < 4s) in useTypingAnimation hook
- [x] T023 Run quickstart.md testing checklist for manual validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on T001, T002, T003 from Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on User Story 1 (needs FlowPreview component)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (needs Tabs component) - can run parallel to US1
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on User Story 1 (needs FlowPreview to integrate)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of other stories

### Within Each Phase

- Setup: T001 and T002 can run in parallel, T003 depends on T001
- Foundational: T004 and T005 can run in parallel
- US1: Sequential - T006 → T007 → T008 → T009
- US2: Sequential - T010 → T011 → T012 → T013 → T014 → T015 → T016
- US3: Single task - T017
- Polish: T018-T021 mostly parallel, T022-T023 sequential at end

### Parallel Opportunities

- Setup: T001 and T002 can run in parallel
- Foundational: T004 and T005 can run in parallel
- Polish: T020 and T021 can run in parallel (different sections of same file)

---

## Parallel Example: Setup Phase

```bash
# Launch type definition and hook in parallel:
Task: "Create FlowDetailTab type definition in packages/frontend/src/types/tabs.ts"
Task: "Create useTypingAnimation hook in packages/frontend/src/hooks/useTypingAnimation.ts"

# Then create Tabs component (depends on type definition):
Task: "Create Tabs component in packages/frontend/src/components/common/Tabs.tsx"
```

---

## Parallel Example: Foundational Phase

```bash
# Launch message components in parallel:
Task: "Create ChatMessage component in packages/frontend/src/components/preview/ChatMessage.tsx"
Task: "Create ChatConversation container in packages/frontend/src/components/preview/ChatConversation.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T005)
3. Complete Phase 3: User Story 1 (T006-T009)
4. Complete Phase 4: User Story 2 (T010-T016)
5. **STOP and VALIDATE**: Test Preview tab with animated conversation
6. Deploy/demo if ready - core feature is complete

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Preview conversation works (not integrated yet)
3. Add User Story 2 → Full tab switching works → Deploy/Demo (MVP!)
4. Add User Story 3 → Usage placeholder added
5. Add Polish → Edge cases handled, animation tuned

### Recommended Order (Single Developer)

1. T001, T002 (parallel) → T003 (Setup complete)
2. T004, T005 (parallel) (Foundational complete)
3. T006 → T007 → T008 → T009 (US1 complete)
4. T010 → T011 → T012 → T013 → T014 → T015 → T016 (US2 complete)
5. T017 (US3 complete)
6. T018 → T019 → T020/T021 (parallel) → T022 → T023 (Polish complete)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently testable after completion
- Manual testing per quickstart.md checklist (no automated tests per POC phase)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All new components go in `packages/frontend/src/components/` following existing patterns
