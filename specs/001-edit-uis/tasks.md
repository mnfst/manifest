# Tasks: Editable UI Interfaces

**Input**: Design documents from `/specs/001-edit-uis/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Testing is DEFERRED per POC constitution. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**:
  - `packages/frontend/src/` - React frontend
  - `packages/backend/src/` - NestJS backend
  - `packages/shared/src/` - Shared types
  - `packages/nodes/src/` - Node definitions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and shared types

- [x] T001 Install CodeMirror dependencies in packages/frontend: `pnpm add @uiw/react-codemirror @codemirror/lang-javascript @codemirror/lint @lezer/highlight @babel/parser`
- [x] T002 [P] Create ValidationError and ValidationResult types in packages/shared/src/types/validation.ts
- [x] T003 [P] Create EditorState type in packages/frontend/src/types/editor.ts
- [x] T004 [P] Extend InterfaceNodeParameters with customCode field in packages/shared/src/types/node.ts
- [x] T005 Create template registry with defaultCode and sampleData in packages/shared/src/types/templates.ts
- [x] T006 Extend LayoutTemplateConfig with defaultCode and sampleData in packages/shared/src/types/app.ts
- [x] T007 Export new types from packages/shared/src/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Create Manifest theme for CodeMirror (EditorView.theme + HighlightStyle) in packages/frontend/src/components/editor/manifestTheme.ts
- [x] T009 Create code validator utility with Babel parser in packages/frontend/src/lib/codeValidator.ts
- [x] T010 Create CodeEditor component (CodeMirror wrapper with TSX support) in packages/frontend/src/components/editor/CodeEditor.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Edit UI Component Code (Priority: P1) MVP

**Goal**: Enable users to click Edit on an Interface node, open a full-screen code editor with Manifest theme, modify code, save, and have changes persist.

**Independent Test**: Create an Interface node, click Edit, modify code, save, reload page, verify custom code persists.

### Implementation for User Story 1

- [x] T011 [US1] Create InterfaceEditor component shell (full-screen view, header with close/save buttons) in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T012 [US1] Integrate CodeEditor into InterfaceEditor with code state management in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T013 [US1] Add Edit button to ViewNode component (only for Interface type) in packages/frontend/src/components/flow/ViewNode.tsx
- [x] T014 [US1] Add editingNodeId state and conditional rendering in packages/frontend/src/pages/FlowDetail.tsx
- [x] T015 [US1] Implement save functionality using existing PATCH /api/flows/:flowId/nodes/:nodeId with customCode in parameters via packages/frontend/src/lib/api.ts
- [x] T016 [US1] Load node's customCode or default template code when editor opens in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T017 [US1] Add unsaved changes tracking (isDirty state) in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T018 [US1] Add confirmation dialog when closing with unsaved changes in packages/frontend/src/components/editor/InterfaceEditor.tsx

**Checkpoint**: User Story 1 complete - users can edit and save custom code for Interface nodes

---

## Phase 4: User Story 2 - Preview Component with Sample Data (Priority: P2)

**Goal**: Enable users to toggle between code view and preview view, rendering the component with sample data.

**Independent Test**: Open edit view, toggle to preview, verify component renders with sample data, toggle back to code.

### Implementation for User Story 2

- [x] T019 [P] [US2] Create ComponentPreview component with Error Boundary in packages/frontend/src/components/editor/ComponentPreview.tsx
- [x] T020 [P] [US2] Create PreviewErrorBoundary component for graceful error handling in packages/frontend/src/components/editor/PreviewErrorBoundary.tsx
- [x] T021 [US2] Add viewMode state (preview/code) and toggle UI to InterfaceEditor in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T022 [US2] Implement dynamic component rendering from code string in ComponentPreview in packages/frontend/src/components/editor/ComponentPreview.tsx
- [x] T023 [US2] Pass sample data from template registry to ComponentPreview in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T024 [US2] Set preview as default view when entering editor (FR-010) in packages/frontend/src/components/editor/InterfaceEditor.tsx

**Checkpoint**: User Story 2 complete - users can preview their component with sample data

---

## Phase 5: User Story 3 - Code Validation Before Save (Priority: P3)

**Goal**: Validate code for syntax errors before allowing save, display inline error messages with line numbers.

**Independent Test**: Introduce syntax error, attempt save, verify blocked with error message showing line number, fix error, save succeeds.

### Implementation for User Story 3

- [x] T025 [US3] Integrate CodeMirror linter extension with codeValidator in packages/frontend/src/components/editor/CodeEditor.tsx
- [x] T026 [US3] Display validation errors inline in editor gutter in packages/frontend/src/components/editor/CodeEditor.tsx
- [x] T027 [US3] Block save when validation errors exist in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T028 [US3] Display error summary panel below editor when errors exist in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T029 [US3] Add empty code validation (cannot save empty code) in packages/frontend/src/lib/codeValidator.ts

**Checkpoint**: User Story 3 complete - invalid code cannot be saved

---

## Phase 6: User Story 4 - View Default Component Code (Priority: P4)

**Goal**: Show appropriate default template code when editing a new/unmodified Interface node based on its layoutTemplate.

**Independent Test**: Create Interface node with 'table' template, open editor, verify default table code shows. Create node with 'post-list' template, verify post-list code shows.

### Implementation for User Story 4

- [x] T030 [US4] Add default code for 'table' layout template in packages/shared/src/types/templates.ts
- [x] T031 [US4] Add default code for 'post-list' layout template in packages/shared/src/types/templates.ts
- [x] T032 [US4] Implement getDefaultCode helper that returns code based on layoutTemplate in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T033 [US4] Use default code when node.parameters.customCode is undefined in packages/frontend/src/components/editor/InterfaceEditor.tsx

**Checkpoint**: User Story 4 complete - all layout templates have editable default code

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T034 [P] Add keyboard shortcuts (Cmd/Ctrl+S for save, Escape for close) in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T035 [P] Add loading state during save operation in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T036 Style editor to match application theme (Tailwind CSS) in packages/frontend/src/components/editor/InterfaceEditor.tsx
- [x] T037 Add visual indicator on ViewNode when it has custom code in packages/frontend/src/components/flow/ViewNode.tsx
- [x] T038 Run quickstart.md manual validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion
  - User stories should be done sequentially in priority order (P1 → P2 → P3 → P4)
  - US2-US4 build on InterfaceEditor created in US1
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Creates InterfaceEditor base
- **User Story 2 (P2)**: Depends on US1 (InterfaceEditor must exist) - Adds preview toggle
- **User Story 3 (P3)**: Depends on US1 (InterfaceEditor must exist) - Adds validation
- **User Story 4 (P4)**: Depends on US1 (InterfaceEditor must exist) - Adds template defaults

### Within Each Phase

- Setup: T001 first (dependencies), then T002-T007 in parallel
- Foundational: T008 first (theme), then T009 and T010 can be parallel
- US1: Sequential T011 → T018 (building InterfaceEditor incrementally)
- US2: T019-T020 parallel (Preview + ErrorBoundary), then T021-T024 sequential
- US3: T025 → T029 sequential (validation integration)
- US4: T030-T031 parallel (templates), then T032-T033 sequential

### Parallel Opportunities

**Phase 1 (Setup):**
```
Parallel: T002, T003, T004, T006
Sequential: T001 → T005 → T007
```

**Phase 2 (Foundational):**
```
Sequential: T008 → [T009, T010 parallel]
```

**User Stories - Best done sequentially due to shared InterfaceEditor component**

---

## Parallel Example: Phase 1 Setup

```bash
# After T001 completes, launch these in parallel:
Task: "Create ValidationError types in packages/shared/src/types/validation.ts"
Task: "Create EditorState type in packages/frontend/src/types/editor.ts"
Task: "Extend InterfaceNodeParameters in packages/shared/src/types/node.ts"
Task: "Extend LayoutTemplateConfig in packages/shared/src/types/app.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (dependencies + types)
2. Complete Phase 2: Foundational (theme, validator, CodeEditor)
3. Complete Phase 3: User Story 1 (edit + save)
4. **STOP and VALIDATE**: Test editing and saving custom code
5. Deploy/demo if ready - users can now edit UI code!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test → Deploy (MVP! Users can edit code)
3. Add User Story 2 → Test → Deploy (Users can preview)
4. Add User Story 3 → Test → Deploy (Validation prevents errors)
5. Add User Story 4 → Test → Deploy (Templates have good defaults)
6. Polish → Final release

### Estimated Task Distribution

| Phase | Tasks | Parallel Tasks |
|-------|-------|----------------|
| Setup | 7 | 4 |
| Foundational | 3 | 2 |
| US1 (MVP) | 8 | 0 |
| US2 (Preview) | 6 | 2 |
| US3 (Validation) | 5 | 0 |
| US4 (Defaults) | 4 | 2 |
| Polish | 5 | 2 |
| **Total** | **38** | **12** |

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- Testing deferred per POC constitution - manual testing acceptable
- Each user story should be independently demonstrable after completion
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts in parallel tasks
