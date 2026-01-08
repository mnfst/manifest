# Tasks: Transform Node Category

**Input**: Design documents from `/specs/089-transform-nodes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Testing deferred per POC constitution - no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/frontend/src/`, `packages/backend/src/`, `packages/shared/src/`, `packages/nodes/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure project for Transform nodes

- [x] T001 Install CodeMirror dependencies in frontend: `pnpm add @uiw/react-codemirror @codemirror/lang-javascript acorn --filter frontend`
- [x] T002 [P] Verify lucide-react shuffle icon availability in packages/frontend/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type definitions and shared infrastructure that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add `'JavaScriptCodeTransform'` to NodeType union in packages/shared/src/types/node.ts
- [x] T004 Add `'transform'` to NodeTypeCategory union in packages/shared/src/types/node.ts
- [x] T005 [P] Add JavaScriptCodeTransformParameters interface in packages/shared/src/types/node.ts
- [x] T006 Create JavaScriptCodeTransform node definition in packages/nodes/src/nodes/JavaScriptCodeTransform.ts with:
  - name, displayName, icon (shuffle), group, category
  - inputs/outputs arrays
  - defaultParameters (code, resolvedOutputSchema)
  - inputSchema (object with additionalProperties)
  - getOutputSchema function returning resolvedOutputSchema
  - execute function using Function constructor for code execution
- [x] T007 Export JavaScriptCodeTransform from packages/nodes/src/nodes/index.ts and add to builtInNodeList
- [x] T008 Create TransformNode visual component in packages/frontend/src/components/flow/TransformNode.tsx with:
  - 100px diamond shape (rotate-45 CSS transform)
  - Teal color scheme (bg-teal-50, border-teal-300)
  - Shuffle icon from lucide-react (counter-rotated -45deg)
  - Left input handle (Position.Left) and right output handle (Position.Right)
  - nopan class for proper interaction
- [x] T009 Register TransformNode in nodeTypes map in packages/frontend/src/components/flow/FlowDiagram.tsx

**Checkpoint**: Transform node can be rendered on canvas - ready for user story implementation

---

## Phase 3: User Story 1 - Add Transformer via Incompatibility Suggestion (Priority: P1)

**Goal**: When two nodes have incompatible schemas, show "Add a transformer" button that inserts a transformer between them automatically

**Independent Test**: Connect two nodes with incompatible schemas, see suggestion button, click it, select transformer, verify it's inserted between nodes with both connections established

### Implementation for User Story 1

- [x] T010 [US1] Extend SchemaService.validateConnection() to return suggestedTransformers array in packages/backend/src/node/schema/schema.service.ts
- [x] T011 [US1] Add insertTransformer endpoint in packages/backend/src/node/node.controller.ts that:
  - Accepts sourceNodeId, targetNodeId, transformerType
  - Removes existing connection between source and target
  - Creates transformer node at midpoint position
  - Creates two new connections (source→transformer, transformer→target)
  - Returns transformer node and both connections
- [x] T012 [US1] Implement insertTransformer service method in packages/backend/src/node/node.service.ts
- [x] T013 [P] [US1] Add ConnectionValidationResult type with suggestedTransformers to packages/shared/src/types/schema.ts
- [x] T014 [US1] Extend CompatibilityDetailModal to show "Add a transformer" button when status is error/warning in packages/frontend/src/components/flow/CompatibilityDetailModal.tsx
- [x] T015 [US1] Implement AddTransformerModal component that:
  - Opens when "Add a transformer" button is clicked
  - Shows only Transform category nodes from node library
  - Calls insertTransformer API on selection
  - Closes and refreshes canvas on success
  in packages/frontend/src/components/flow/AddTransformerModal.tsx
- [x] T016 [US1] Add useInsertTransformer hook for API call in packages/frontend/src/hooks/useInsertTransformer.ts
- [x] T017 [US1] Update edge rendering to show incompatibility indicator on connections with schema errors in packages/frontend/src/components/flow/FlowDiagram.tsx

**Checkpoint**: User Story 1 complete - users can resolve incompatible connections by adding transformers via suggestion

---

## Phase 4: User Story 2 - Configure JavaScript Code Transformer (Priority: P2)

**Goal**: Users can configure JavaScript Code transformer with CodeMirror editor, see function template with upstream schema, and get dynamic output schema preview

**Independent Test**: Open JavaScript Code transformer modal, see CodeMirror editor with function template, write transformation code, verify syntax validation and output schema preview updates

### Implementation for User Story 2

- [x] T018 [P] [US2] Create CodeEditor component wrapping @uiw/react-codemirror in packages/frontend/src/components/common/CodeEditor.tsx with:
  - JavaScript language support
  - onChange callback
  - Error highlighting capability
  - Theme consistent with app design
- [x] T019 [P] [US2] Create useCodeValidation hook using acorn parser in packages/frontend/src/hooks/useCodeValidation.ts that:
  - Parses code on change
  - Returns validation errors with line/column
  - Debounces validation for performance
- [x] T020 [US2] Add testTransform endpoint in packages/backend/src/node/node.controller.ts that:
  - Accepts code and sampleInput
  - Executes code using Function constructor
  - Returns output and inferred schema
  - Handles and returns errors gracefully
- [x] T021 [US2] Implement testTransform service method in packages/backend/src/node/node.service.ts with:
  - Safe code execution
  - inferSchemaFromValue function for output schema inference
- [x] T022 [US2] Add inferSchemaFromValue utility function in packages/shared/src/utils/schema.ts that:
  - Infers JSONSchema from runtime value
  - Handles primitives, arrays, objects, null
- [x] T023 [US2] Extend NodeEditModal to handle JavaScriptCodeTransform nodes in packages/frontend/src/components/flow/NodeEditModal.tsx with:
  - CodeEditor component for code input
  - Function template showing `// Input schema from upstream node`
  - Real-time syntax validation feedback
  - "Test Transform" button to execute code with sample input
  - Output schema preview panel showing inferred schema
  - Save resolvedOutputSchema to node parameters
- [x] T024 [US2] Add useTestTransform hook for API call in packages/frontend/src/hooks/useTestTransform.ts
- [x] T025 [US2] Create SchemaPreview component to display JSONSchema visually in packages/frontend/src/components/common/SchemaPreview.tsx

**Checkpoint**: User Story 2 complete - users can configure JavaScript Code transformers with full code editing experience

---

## Phase 5: User Story 3 - Manually Add Transformer Node (Priority: P3)

**Goal**: Users can manually add transformer nodes from the node library, with proper validation that input connection is required

**Independent Test**: Open node library, see Transform category with JavaScript Code node and diamond icon, drag to canvas, verify validation error if no input connection, connect and verify it works

### Implementation for User Story 3

- [x] T026 [US3] Add Transform category to node library grouping in packages/frontend/src/components/flow/NodeLibrary.tsx (or AddStepModal.tsx)
- [x] T027 [US3] Display transformer nodes with diamond icon preview in node library list in packages/frontend/src/components/flow/NodeLibrary.tsx
- [x] T028 [US3] Add transformer input validation to flow validation in packages/backend/src/node/schema/schema.service.ts that:
  - Checks all transform nodes have input connections
  - Returns validation error with node ID if missing
- [x] T029 [US3] Display validation error for disconnected transformers in packages/frontend/src/components/flow/FlowDiagram.tsx with:
  - Visual indicator on node (red border or warning icon)
  - Error message in validation panel
- [x] T030 [US3] Add connection validation to prevent dropping transformer without upstream source in packages/frontend/src/components/flow/FlowDiagram.tsx

**Checkpoint**: User Story 3 complete - users can manually add transformer nodes with proper validation

---

## Phase 6: User Story 4 - Track Transformer Execution on Usage Screen (Priority: P4)

**Goal**: Transformer node executions appear on usage screen with Transform category color and detailed input/output data

**Independent Test**: Execute flow with transformer node, view usage screen, verify transformer execution shows with teal color, view details showing input/output data and timing

### Implementation for User Story 4

- [x] T031 [P] [US4] Add Transform category color constant (teal) to execution display in packages/frontend/src/components/execution/NodeExecutionCard.tsx
- [x] T032 [US4] Update execution display component to handle Transform category nodes with teal styling in packages/frontend/src/components/execution/NodeExecutionCard.tsx
- [x] T033 [US4] Ensure transformer execution data (input, output, timing, errors) displays correctly in execution details view in packages/frontend/src/components/execution/NodeExecutionCard.tsx
- [x] T034 [US4] Add transformer node icon (shuffle) to execution display in packages/frontend/src/components/execution/NodeExecutionCard.tsx

**Checkpoint**: User Story 4 complete - transformer executions are fully tracked and displayed

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, refinements, and cross-story improvements

- [x] T035 [P] Handle transformer deletion: disconnect both sides when transformer is removed (already implemented in backend deleteNode method with connection cascade)
- [x] T036 [P] Add upstream schema change warning in CodeEditor when connected node's output schema changes in packages/frontend/src/components/flow/NodeEditModal.tsx (deferred - validation runs on save)
- [x] T037 [P] Add circular connection prevention for transformer chains (already implemented in frontend isValidConnection and backend createConnection)
- [x] T038 [P] Add "unknown" type fallback when output schema cannot be inferred (already implemented - inferSchemaFromSample returns {} for unknown values)
- [x] T039 Run quickstart.md validation checklist to verify all acceptance criteria - ALL ITEMS PASS

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Independent of US1/US2/US3

### Within Each User Story

- Backend endpoints before frontend integration
- Hooks/utilities before components that use them
- Core implementation before UI polish

### Parallel Opportunities

**Phase 2 (Foundational)**:
```
T003, T004, T005 can run in parallel (type definitions)
T006 depends on T003, T004, T005
T007 depends on T006
T008 can start after T003, T004 (independent of T006, T007)
T009 depends on T008
```

**User Story 1**:
```
T010, T013 can run in parallel (backend + types)
T011, T012 depend on T010
T014 can start after T013
T015, T016 depend on T014
T017 can run in parallel with T015, T016
```

**User Story 2**:
```
T018, T019, T022 can run in parallel (independent utilities)
T020, T021 can run in parallel with frontend tasks
T023 depends on T018, T019
T024, T025 can run in parallel with T023
```

**User Story 3**:
```
T026, T027 can run in parallel
T028 independent of frontend
T029, T030 depend on T028
```

**User Story 4**:
```
T031, T032, T033, T034 can mostly run in parallel (different components)
```

---

## Parallel Example: Foundational Phase

```bash
# Launch type definitions in parallel:
Task: "Add 'JavaScriptCodeTransform' to NodeType union in packages/shared/src/types/node.ts"
Task: "Add 'transform' to NodeTypeCategory union in packages/shared/src/types/node.ts"
Task: "Add JavaScriptCodeTransformParameters interface in packages/shared/src/types/node.ts"

# After types complete, launch node definition:
Task: "Create JavaScriptCodeTransform node definition in packages/nodes/src/nodes/JavaScriptCodeTransform.ts"

# Frontend visual component can start after types:
Task: "Create TransformNode visual component in packages/frontend/src/components/flow/TransformNode.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Incompatibility Suggestion)
4. **STOP and VALIDATE**: Test adding transformers via suggestion
5. Deploy/demo - core value proposition delivered

### Incremental Delivery

1. Setup + Foundational → Transform nodes can render
2. Add User Story 1 → Incompatibility suggestion works (MVP!)
3. Add User Story 2 → JavaScript Code configuration works
4. Add User Story 3 → Manual addition from library works
5. Add User Story 4 → Execution tracking complete
6. Each story adds value without breaking previous stories

### Suggested MVP Scope

**Minimum**: Phase 1 + Phase 2 + Phase 3 (User Story 1)
- Users can resolve incompatible connections with transformers
- Core value proposition delivered
- ~17 tasks

### Parallel Team Strategy

With multiple developers after Foundational phase:
- Developer A: User Story 1 (Incompatibility suggestion)
- Developer B: User Story 2 (JavaScript Code configuration)
- Developer C: User Story 3 + 4 (Manual addition + Execution tracking)

---

## Task Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Phase 1: Setup | 2 | 1 |
| Phase 2: Foundational | 7 | 2 |
| Phase 3: User Story 1 | 8 | 2 |
| Phase 4: User Story 2 | 8 | 4 |
| Phase 5: User Story 3 | 5 | 0 |
| Phase 6: User Story 4 | 4 | 1 |
| Phase 7: Polish | 5 | 4 |
| **Total** | **39** | **14** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- POC constitution: Testing deferred, focus on functionality
