# Tasks: App Theme Editor

**Input**: Design documents from `/specs/001-app-theme-editor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Testing deferred per POC constitution - no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`
- **Shared types**: `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create project structure

- [x] T001 Install react-colorful and @codemirror/lang-css dependencies via `pnpm add react-colorful @codemirror/lang-css -F frontend`
- [x] T002 [P] Create theme-editor directory structure at `packages/frontend/src/components/theme-editor/`
- [x] T003 [P] Create hooks directory at `packages/frontend/src/components/theme-editor/hooks/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities and types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create HslObject interface and HSL conversion utilities in `packages/frontend/src/lib/hsl-utils.ts`
- [x] T005 [P] Create ThemeVariableGroup interface and THEME_VARIABLE_GROUPS constant in `packages/frontend/src/components/theme-editor/types.ts`
- [x] T006 [P] Create ThemeEditorState interface in `packages/frontend/src/components/theme-editor/types.ts`
- [x] T007 Implement useThemeEditor hook with state management, dirty tracking, and validation in `packages/frontend/src/components/theme-editor/hooks/useThemeEditor.ts`
- [x] T008 Create barrel export file at `packages/frontend/src/components/theme-editor/index.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Edit Theme Colors Visually (Priority: P1) 🎯 MVP

**Goal**: Users can customize app theme through visual color pickers with real-time preview and persistence

**Independent Test**: Open Theme tab, change a color with picker, verify preview updates, save, refresh page, verify color persisted

### Implementation for User Story 1

- [x] T009 [P] [US1] Create ColorPickerControl component with react-colorful HslColorPicker in `packages/frontend/src/components/theme-editor/ColorPickerControl.tsx`
- [x] T010 [P] [US1] Create RadiusControl component for --radius variable in `packages/frontend/src/components/theme-editor/RadiusControl.tsx`
- [x] T011 [US1] Create VariableControlGroup component that renders grouped color pickers in `packages/frontend/src/components/theme-editor/VariableControlGroup.tsx`
- [x] T012 [US1] Create ThemePreview component with sample shadcn components (Button, Input, Card, Switch) wrapped in ThemeProvider in `packages/frontend/src/components/theme-editor/ThemePreview.tsx`
- [x] T013 [US1] Create main ThemeEditor component that composes pickers, preview, Save button, and dirty state indicator in `packages/frontend/src/components/theme-editor/ThemeEditor.tsx`
- [x] T014 [US1] Add "Theme" tab to AppDetail page navigation in `packages/frontend/src/pages/AppDetail.tsx`
- [x] T015 [US1] Integrate ThemeEditor component into AppDetail Theme tab with app.themeVariables data in `packages/frontend/src/pages/AppDetail.tsx`
- [x] T016 [US1] Implement Save functionality using existing api.updateApp() in ThemeEditor component

**Checkpoint**: User Story 1 complete - visual theme editing with persistence works independently

---

## Phase 4: User Story 2 - Edit Theme via Code Editor (Priority: P2)

**Goal**: Power users can edit theme as CSS code with bidirectional sync to visual controls

**Independent Test**: View code editor, manually edit a CSS value, verify preview updates and visual pickers sync, save and verify persistence

### Implementation for User Story 2

- [x] T017 [P] [US2] Create CSS parsing utility functions (parseCssVariables, formatCssVariables) in `packages/frontend/src/lib/hsl-utils.ts`
- [x] T018 [US2] Create ThemeCodeEditor component with CodeMirror and CSS language support in `packages/frontend/src/components/theme-editor/ThemeCodeEditor.tsx`
- [x] T019 [US2] Add bidirectional sync between ThemeCodeEditor and useThemeEditor state in `packages/frontend/src/components/theme-editor/ThemeEditor.tsx`
- [x] T020 [US2] Add code editor panel to ThemeEditor layout alongside visual controls in `packages/frontend/src/components/theme-editor/ThemeEditor.tsx`
- [x] T021 [US2] Implement CSS syntax validation with error highlighting in ThemeCodeEditor component

**Checkpoint**: User Story 2 complete - code editing works bidirectionally with visual controls

---

## Phase 5: User Story 3 - Preview Theme Changes (Priority: P3)

**Goal**: Preview component is modular and replaceable without modifying theme editor logic

**Independent Test**: Verify preview updates in real-time (<200ms), create a custom preview component and swap it in

### Implementation for User Story 3

- [x] T022 [P] [US3] Extract ThemePreviewProps interface to types.ts for external use in `packages/frontend/src/components/theme-editor/types.ts`
- [x] T023 [US3] Refactor ThemeEditor to accept optional PreviewComponent prop with render props pattern in `packages/frontend/src/components/theme-editor/ThemeEditor.tsx`
- [x] T024 [US3] Add preview panel toggle/expand functionality to ThemeEditor layout in `packages/frontend/src/components/theme-editor/ThemeEditor.tsx`
- [x] T025 [US3] Enhance DefaultThemePreview with additional shadcn components (Select, Checkbox, Alert) in `packages/frontend/src/components/theme-editor/ThemePreview.tsx`

**Checkpoint**: User Story 3 complete - preview is modular and can be replaced in <30 minutes

---

## Phase 6: User Story 4 - Reset to Default Theme (Priority: P4)

**Goal**: Users can safely reset theme to defaults with confirmation

**Independent Test**: Make changes, click Reset, confirm dialog, verify all values return to defaults

### Implementation for User Story 4

- [x] T026 [P] [US4] Create ResetConfirmDialog component using existing dialog patterns in `packages/frontend/src/components/theme-editor/ResetConfirmDialog.tsx`
- [x] T027 [US4] Add resetToDefaults function to useThemeEditor hook using DEFAULT_THEME_VARIABLES in `packages/frontend/src/components/theme-editor/hooks/useThemeEditor.ts`
- [x] T028 [US4] Add Reset to Default button to ThemeEditor with confirmation dialog integration in `packages/frontend/src/components/theme-editor/ThemeEditor.tsx`

**Checkpoint**: User Story 4 complete - reset functionality works with confirmation

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, UX improvements, and validation that affect multiple user stories

- [x] T029 [P] Add unsaved changes warning using beforeunload event in `packages/frontend/src/components/theme-editor/hooks/useThemeEditor.ts`
- [x] T030 [P] ~~Add React Router navigation blocking using useBlocker hook~~ - Skipped: App uses BrowserRouter which doesn't support useBlocker (requires data router). beforeunload warning (T029) provides coverage.
- [x] T031 Implement comprehensive HSL validation with inline error messages in ColorPickerControl
- [x] T032 Add loading state and error handling for save operations in ThemeEditor
- [x] T033 Update barrel export with all new components in `packages/frontend/src/components/theme-editor/index.ts`
- [x] T034 Run serve-app.sh and perform manual validation per quickstart.md test scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in priority order (P1 → P2 → P3 → P4)
  - US2 builds on US1 layout, US3 refines US1 preview, US4 adds reset to existing UI
- **Polish (Phase 7)**: Depends on User Story 1 minimum, ideally all stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 (adds code editor to existing ThemeEditor)
- **User Story 3 (P3)**: Can start after US1 (refactors existing ThemePreview for modularity)
- **User Story 4 (P4)**: Can start after US1 (adds reset button to existing ThemeEditor)

### Within Each User Story

- Components before integration
- Independent functionality before connections
- Core implementation before enhancements
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (T005, T006 same file - should be combined)
- T009 and T010 can run in parallel (different component files)
- T017 can run in parallel with T018 (utility vs component)
- T022 can run in parallel with other US3 tasks (types file)
- T026 can run in parallel with T027 (different files)
- T029 and T030 can run in parallel (different integration points)

---

## Parallel Example: User Story 1

```bash
# Launch T009 and T010 in parallel (different component files):
Task: "Create ColorPickerControl component in packages/frontend/src/components/theme-editor/ColorPickerControl.tsx"
Task: "Create RadiusControl component in packages/frontend/src/components/theme-editor/RadiusControl.tsx"

# Then T011 (depends on T009, T010):
Task: "Create VariableControlGroup component in packages/frontend/src/components/theme-editor/VariableControlGroup.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (2 tasks)
2. Complete Phase 2: Foundational (5 tasks)
3. Complete Phase 3: User Story 1 (8 tasks)
4. **STOP and VALIDATE**: Test visual theme editing independently
5. Deploy/demo if ready - core feature is functional

### Incremental Delivery

1. Setup + Foundational → Foundation ready (7 tasks)
2. Add User Story 1 → Visual editing works (15 tasks total) **MVP!**
3. Add User Story 2 → Code editing works (20 tasks total)
4. Add User Story 3 → Preview is modular (24 tasks total)
5. Add User Story 4 → Reset works (27 tasks total)
6. Add Polish → Production ready (34 tasks total)

### Critical Path

```
T001 → T004 → T007 → T009/T010 → T011 → T012 → T013 → T014 → T015 → T016
(Setup) (Utils) (Hook) (Pickers)  (Groups) (Preview) (Editor) (Tab) (Integrate) (Save)
```

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Constitution: Testing deferred for POC, run serve-app.sh after implementation
- Existing backend API (PATCH /apps/:id) already supports themeVariables - no backend tasks needed
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
