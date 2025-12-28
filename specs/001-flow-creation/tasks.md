# Tasks: Simplified Flow Creation

**Input**: Design documents from `/specs/001-flow-creation/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not required (POC constitution - testing deferred)

**Organization**: Tasks grouped by user story for independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in descriptions

## Path Conventions

- **Monorepo structure**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared type changes and utility functions that all stories depend on

- [ ] T001 Update CreateFlowRequest type to use name/description in `packages/shared/src/types/flow.ts`
- [ ] T002 [P] Add toSnakeCase utility function in `packages/shared/src/utils/string.ts` (create file if needed)
- [ ] T003 [P] Add isValidToolName utility function in `packages/shared/src/utils/string.ts`
- [ ] T004 Export new utilities from `packages/shared/src/index.ts`
- [ ] T005 Rebuild shared package to ensure types are available (`npm run build` in packages/shared)

---

## Phase 2: Foundational (Backend API Changes)

**Purpose**: Backend endpoint changes that MUST be complete before frontend work

**⚠️ CRITICAL**: Frontend cannot use new flow creation until this phase is complete

- [ ] T006 Add toSnakeCase implementation in `packages/backend/src/flow/flow.controller.ts` (import from shared or implement locally)
- [ ] T007 Modify createFlow method in `packages/backend/src/flow/flow.controller.ts` to:
  - Accept name/description instead of prompt
  - Validate name is not empty and produces valid tool name
  - Generate toolName using toSnakeCase
  - Create flow with empty toolDescription
  - Skip view creation
  - Remove agentService.generateFlow call
- [ ] T008 Remove or deprecate generateFlow method in `packages/backend/src/agent/agent.service.ts`
- [ ] T009 Verify backend starts without errors and endpoint accepts new request format

**Checkpoint**: Backend API ready for new flow creation format

---

## Phase 3: User Story 1 - Create Flow with Name/Description (Priority: P1) 🎯 MVP

**Goal**: Replace prompt-based modal with name/description fields, auto-generate tool name

**Independent Test**: Create a new flow from app detail page, verify modal fields, check generated tool name, confirm navigation to empty flow editor

### Implementation for User Story 1

- [ ] T010 [US1] Delete PromptInput component `packages/frontend/src/components/flow/PromptInput.tsx`
- [ ] T011 [US1] Add toSnakeCase helper function in `packages/frontend/src/components/flow/CreateFlowModal.tsx`
- [ ] T012 [US1] Replace PromptInput with name/description form fields in `packages/frontend/src/components/flow/CreateFlowModal.tsx`:
  - Add name input (required, max 300 chars)
  - Add description textarea (optional, max 500 chars)
  - Add read-only tool name preview that updates as user types
  - Add validation for valid tool name generation
- [ ] T013 [US1] Update onSubmit handler in `packages/frontend/src/components/flow/CreateFlowModal.tsx` to pass `{ name, description }` instead of prompt
- [ ] T014 [US1] Update CreateFlowModal props interface to match new behavior in `packages/frontend/src/components/flow/CreateFlowModal.tsx`
- [ ] T015 [US1] Update AppDetail page in `packages/frontend/src/pages/AppDetail.tsx` to pass new modal props
- [ ] T016 [US1] Update api.createFlow call in `packages/frontend/src/pages/AppDetail.tsx` to use new request format

**Checkpoint**: User Story 1 complete - users can create flows with name/description, see tool name preview, and navigate to flow editor

---

## Phase 4: User Story 2 - Add User Intent to Empty Flow (Priority: P1)

**Goal**: Display centered "Add user intent" placeholder on empty flow canvas, open existing modal on click

**Independent Test**: Navigate to newly created flow, see centered placeholder, click to open User Intent modal, save and see UserIntentNode appear

### Implementation for User Story 2

- [ ] T017 [P] [US2] Create AddUserIntentNode component in `packages/frontend/src/components/flow/AddUserIntentNode.tsx`:
  - Custom React Flow node with "+" icon and "Add user intent" text
  - Styled consistently with existing nodes (use Tailwind)
  - Accept onClick callback in node data
  - Use lucide-react Plus icon
- [ ] T018 [US2] Add getFlowState helper function in `packages/frontend/src/components/flow/FlowDiagram.tsx`:
  - Return `{ hasUserIntent, hasViews }` based on flow.toolDescription and flow.views
- [ ] T019 [US2] Register addUserIntentNode type in nodeTypes in `packages/frontend/src/components/flow/FlowDiagram.tsx`
- [ ] T020 [US2] Add conditional logic in `packages/frontend/src/components/flow/FlowDiagram.tsx` to:
  - Detect empty flow state (no user intent)
  - Render AddUserIntentNode centered in canvas when flow has no toolDescription
  - Pass onAddUserIntent callback to node
- [ ] T021 [US2] Update FlowDetail page in `packages/frontend/src/pages/FlowDetail.tsx`:
  - Add state for UserIntentModal open/close
  - Pass onAddUserIntent callback to FlowDiagram
  - Handle UserIntentModal save to refresh flow data

**Checkpoint**: User Story 2 complete - empty flows show "Add user intent" placeholder, clicking opens modal, saving shows UserIntentNode

---

## Phase 5: User Story 3 - Add First View Guidance (Priority: P2)

**Goal**: After user intent is added, show guidance to add first view

**Independent Test**: Create flow, add user intent, see "Add first view" prompt appear, click to open view creation modal

### Implementation for User Story 3

- [ ] T022 [P] [US3] Create AddViewNode component in `packages/frontend/src/components/flow/AddViewNode.tsx`:
  - Custom React Flow node with "+" icon and "Add first view" text
  - Positioned to right of UserIntentNode
  - Accept onClick callback in node data
  - Use lucide-react Plus icon
- [ ] T023 [US3] Register addViewNode type in nodeTypes in `packages/frontend/src/components/flow/FlowDiagram.tsx`
- [ ] T024 [US3] Add conditional logic in `packages/frontend/src/components/flow/FlowDiagram.tsx` to:
  - Detect "has user intent but no views" state
  - Render UserIntentNode + AddViewNode when flow has toolDescription but no views
  - Position AddViewNode to the right of UserIntentNode with edge connection
  - Pass onAddView callback to node
- [ ] T025 [US3] Update FlowDetail page in `packages/frontend/src/pages/FlowDetail.tsx`:
  - Pass onAddView callback to FlowDiagram
  - Open view creation modal when AddViewNode is clicked
  - Refresh flow data after view is created

**Checkpoint**: User Story 3 complete - flows with user intent but no views show "Add first view" guidance

---

## Phase 6: Polish & Code Cleanup

**Purpose**: Final cleanup and verification

- [ ] T026 [P] Remove any unused imports from modified files
- [ ] T027 [P] Verify no remaining references to prompt field in flow creation path
- [ ] T028 Run `npm run type-check` across all packages to ensure no type errors
- [ ] T029 Run `npm run lint` across all packages to ensure no linting errors
- [ ] T030 Manual testing: Complete full flow creation journey (create flow → add user intent → add view)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (needs shared types)
- **User Story 1 (Phase 3)**: Depends on Foundational (needs backend API)
- **User Story 2 (Phase 4)**: Depends on User Story 1 (needs empty flow creation working)
- **User Story 3 (Phase 5)**: Depends on User Story 2 (needs user intent flow working)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Core flow creation
- **User Story 2 (P1)**: Can start after US1 - Requires ability to create empty flows
- **User Story 3 (P2)**: Can start after US2 - Requires user intent functionality

### Within Each Phase

- Tasks marked [P] can run in parallel
- Non-parallel tasks should run sequentially as listed

### Parallel Opportunities

**Phase 1 (Setup)**:
```
# These can run in parallel:
- T002 [P] Add toSnakeCase utility function
- T003 [P] Add isValidToolName utility function
```

**Phase 4 (US2) + Phase 5 (US3)**:
```
# These node components can be created in parallel:
- T017 [P] Create AddUserIntentNode component
- T022 [P] Create AddViewNode component
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T009)
3. Complete Phase 3: User Story 1 (T010-T016)
4. **STOP and VALIDATE**: Test flow creation with name/description
5. Deploy/demo if ready - flows can be created, user intent added via existing edit flow

### Full Feature Delivery

1. Complete Setup + Foundational → API ready
2. Add User Story 1 → Basic flow creation works
3. Add User Story 2 → Guided user intent creation
4. Add User Story 3 → Guided first view creation
5. Polish → Clean, tested feature

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- POC mode: No automated tests required
- Commit after each completed phase
- Test manually at each checkpoint using quickstart.md checklist
