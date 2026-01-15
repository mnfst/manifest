# Tasks: Blank Component

**Input**: Design documents from `/specs/001-blank-component/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md

**Tests**: Tests are NOT included per POC constitution (testing deferred).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`, `packages/nodes/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and template code that all user stories depend on

- [ ] T001 [P] Add 'blank' to NodeTypeCategory type in packages/shared/src/types/node.ts
- [ ] T002 [P] Add 'BlankComponent' to NodeType union in packages/shared/src/types/node.ts
- [ ] T003 [P] Add BlankComponentNodeParameters interface in packages/shared/src/types/node.ts
- [ ] T004 [P] Add BLANK_COMPONENT_DEFAULT_CODE constant with 4-argument pattern template in packages/shared/src/types/templates.ts
- [ ] T005 [P] Add BLANK_COMPONENT_SAMPLE_DATA constant in packages/shared/src/types/templates.ts
- [ ] T006 Add 'blank-component' to LayoutTemplate type and update getTemplateDefaultCode/getTemplateSampleData helpers in packages/shared/src/types/templates.ts
- [ ] T007 [P] Add BlankComponent entry to COMPONENT_APPEARANCE_REGISTRY in packages/shared/src/types/appearance.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend node definition that MUST be complete before frontend integration

**⚠️ CRITICAL**: User story implementation cannot begin until this phase is complete

- [ ] T008 Create interface directory at packages/nodes/src/nodes/interface/
- [ ] T009 Create BlankComponentNode.ts with NodeTypeDefinition (name, displayName, icon, category, execute function) in packages/nodes/src/nodes/interface/BlankComponentNode.ts
- [ ] T010 Import and register BlankComponentNode in builtInNodes map and builtInNodeList array in packages/nodes/src/nodes/index.ts
- [ ] T011 Add 'blank' category with order: 0 to categories array in packages/backend/src/node/node.service.ts

**Checkpoint**: Backend complete - BlankComponent now available via /api/node-types endpoint

---

## Phase 3: User Story 1 - Add Blank Component to Flow (Priority: P1) 🎯 MVP

**Goal**: Users can see "Blank" category at top of node library and add BlankComponent nodes to their flow

**Independent Test**: Open node library → see "Blank" category at top → drag "Blank Component" onto canvas → see "Hello World" preview

### Implementation for User Story 1

- [ ] T012 [US1] Add 'blank' to CATEGORY_CONFIG with amber color scheme (bg-amber-100, text-amber-600) in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [ ] T013 [US1] Ensure CATEGORY_ORDER array places 'blank' first (order: 0) in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [ ] T014 [US1] Add BlankComponent case to node type rendering logic in packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx
- [ ] T015 [US1] Create BlankComponentNode.tsx canvas component following RegistryComponentNode pattern in packages/frontend/src/components/flow/BlankComponentNode.tsx
- [ ] T016 [US1] Register BlankComponentNode component in nodeTypes map in packages/frontend/src/components/flow/FlowCanvas.tsx
- [ ] T017 [US1] Verify BlankComponent renders Hello World preview when added to canvas

**Checkpoint**: User Story 1 complete - Users can add blank component from node library

---

## Phase 4: User Story 2 - View and Understand Component Template (Priority: P2)

**Goal**: Users can open editor and see well-documented template code with 4-argument pattern explanations

**Independent Test**: Click edit on BlankComponent node → see code editor → verify comments explain data, appearance, control, actions parameters

### Implementation for User Story 2

- [ ] T018 [US2] Wire BlankComponent edit action to open InterfaceEditor with initialCode from BLANK_COMPONENT_DEFAULT_CODE in packages/frontend/src/components/flow/BlankComponentNode.tsx
- [ ] T019 [US2] Ensure InterfaceEditor receives componentType='BlankComponent' for proper handling in packages/frontend/src/components/flow/BlankComponentNode.tsx
- [ ] T020 [US2] Verify template code displays with all JSDoc comments visible in Code tab
- [ ] T021 [US2] Verify Preview tab renders Hello World component correctly

**Checkpoint**: User Story 2 complete - Users can view and understand the template

---

## Phase 5: User Story 3 - Customize Blank Component Code (Priority: P3)

**Goal**: Users can modify component code, see live preview updates, and persist changes

**Independent Test**: Edit code in editor → see preview update → save → reload flow → verify customizations persist

### Implementation for User Story 3

- [ ] T022 [US3] Implement onSave handler in BlankComponentNode to update node.parameters.customCode in packages/frontend/src/components/flow/BlankComponentNode.tsx
- [ ] T023 [US3] Ensure appearance options are auto-parsed from user's TypeScript interface and displayed in Appearance tab
- [ ] T024 [US3] Verify flow save persists customCode and appearanceConfig to backend
- [ ] T025 [US3] Verify flow reload restores customized BlankComponent with user's code

**Checkpoint**: User Story 3 complete - Full customization workflow functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [ ] T026 Run pnpm build to verify no TypeScript errors
- [ ] T027 Run pnpm lint to verify code style compliance
- [ ] T028 Manual testing: Complete quickstart.md verification checklist
- [ ] T029 Verify error handling for invalid JSX syntax (shows error without crashing)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories should proceed sequentially (US1 → US2 → US3) as each builds on previous
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2) - Node must be registered before UI can display it
- **User Story 2 (P2)**: Depends on User Story 1 - Cannot edit a node that doesn't exist in library
- **User Story 3 (P3)**: Depends on User Story 2 - Cannot save customizations without editor integration

### Within Each Phase

- Tasks marked [P] can run in parallel (different files)
- Sequential tasks within a story follow dependency order

### Parallel Opportunities

**Phase 1 (Setup)** - All can run in parallel:
```
T001, T002, T003, T004, T005, T007 can all run in parallel (different files)
T006 depends on T004, T005 (same file)
```

**Phase 2 (Foundational)**:
```
T008 must complete before T009
T009 must complete before T010
T011 can run in parallel with T009, T010 (different package)
```

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all type definition tasks together:
Task: "Add 'blank' to NodeTypeCategory type in packages/shared/src/types/node.ts"
Task: "Add 'BlankComponent' to NodeType union in packages/shared/src/types/node.ts"
Task: "Add BlankComponentNodeParameters interface in packages/shared/src/types/node.ts"
Task: "Add BLANK_COMPONENT_DEFAULT_CODE constant in packages/shared/src/types/templates.ts"
Task: "Add BLANK_COMPONENT_SAMPLE_DATA constant in packages/shared/src/types/templates.ts"
Task: "Add BlankComponent entry to COMPONENT_APPEARANCE_REGISTRY in packages/shared/src/types/appearance.ts"

# Then sequential:
Task: "Update LayoutTemplate type and helper functions in packages/shared/src/types/templates.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types and templates)
2. Complete Phase 2: Foundational (backend node definition)
3. Complete Phase 3: User Story 1 (frontend node library integration)
4. **STOP and VALIDATE**: Verify blank component appears in library and can be added to canvas
5. Deploy/demo if ready - basic functionality works

### Incremental Delivery

1. Complete Setup + Foundational → Backend ready
2. Add User Story 1 → Node appears in library (MVP!)
3. Add User Story 2 → Users can view/understand template
4. Add User Story 3 → Full customization workflow
5. Each story adds value without breaking previous stories

### Single Developer Strategy

1. Work through phases sequentially
2. Use parallel opportunities within each phase
3. Commit after each task or logical group
4. Test at each checkpoint before proceeding

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 29 |
| **Setup Phase** | 7 |
| **Foundational Phase** | 4 |
| **User Story 1** | 6 |
| **User Story 2** | 4 |
| **User Story 3** | 4 |
| **Polish Phase** | 4 |
| **Parallelizable Tasks** | 10 |

### MVP Scope

**Minimum Viable Product**: Phases 1-3 (User Story 1)
- 17 tasks to deliver basic "add blank component to flow" functionality
- Users can see Blank category and add nodes with Hello World preview

### Key Files Modified

| Package | Files |
|---------|-------|
| shared | node.ts, templates.ts, appearance.ts |
| nodes | nodes/interface/BlankComponentNode.ts, nodes/index.ts |
| backend | node/node.service.ts |
| frontend | flow/NodeLibrary/NodeLibrary.tsx, flow/BlankComponentNode.tsx, flow/FlowCanvas.tsx |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests are excluded per POC constitution (deferred)
- Each checkpoint validates story independently
- Commit after each task or logical group
- Run `.specify/scripts/bash/serve-app.sh` for manual testing
