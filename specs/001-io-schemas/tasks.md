# Tasks: Node I/O Schema Validation

**Input**: Design documents from `/specs/001-io-schemas/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Testing DEFERRED (POC phase per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Updated**: Accounts for multiple triggers per flow feature (UserIntent nodes with MCP tool parameters)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`, `packages/nodes/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create shared type foundations

- [x] T001 [P] Install ajv and ajv-formats dependencies in packages/shared/package.json
- [x] T002 [P] Create JSONSchema type definition in packages/shared/src/types/schema.ts
- [x] T003 [P] Create CompatibilityStatus and CompatibilityIssue types in packages/shared/src/types/schema.ts
- [x] T004 [P] Create SchemaCompatibilityResult type in packages/shared/src/types/schema.ts
- [x] T005 [P] Create NodeSchemaInfo type in packages/shared/src/types/schema.ts
- [x] T006 Export schema types from packages/shared/src/types/index.ts
- [x] T007 Extend NodeTypeDefinition with inputSchema, outputSchema, getInputSchema, getOutputSchema in packages/nodes/src/types.ts
- [x] T008 Export extended NodeTypeInfo with schema fields in packages/nodes/src/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema validation logic that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create schema validation utility with Ajv in packages/shared/src/utils/schemaValidator.ts
- [x] T010 Implement checkSchemaCompatibility function (required fields, type matching) in packages/shared/src/utils/schemaValidator.ts
- [x] T011 Implement type coercion rules (number->string, boolean->string, etc.) in packages/shared/src/utils/schemaValidator.ts
- [x] T012 Create helper to convert FlowParameter[] to JSONSchema properties in packages/shared/src/utils/schemaValidator.ts
- [x] T013 Create schema module structure in packages/backend/src/node/schema/
- [x] T014 Create SchemaService with getNodeSchema method in packages/backend/src/node/schema/schema.service.ts
- [x] T015 Implement validateConnection method in SchemaService in packages/backend/src/node/schema/schema.service.ts
- [x] T016 Register SchemaService in NodeModule in packages/backend/src/node/node.module.ts
- [x] T017 [P] Add inputSchema (null) and getOutputSchema (dynamic from parameters) to UserIntentNode in packages/nodes/src/nodes/UserIntentNode.ts
- [x] T018 [P] Add inputSchema and outputSchema to ReturnNode (any input, null output) in packages/nodes/src/nodes/ReturnNode.ts
- [x] T019 [P] Add inputSchema and getOutputSchema to InterfaceNode (any input, dynamic output based on layout actions) in packages/nodes/src/nodes/InterfaceNode.ts
- [x] T020 [P] Add inputSchema and getOutputSchema to ApiCallNode (any input, dynamic output) in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T021 [P] Add inputSchema and getOutputSchema to CallFlowNode (any input, dynamic output from target flow) in packages/nodes/src/nodes/CallFlowNode.ts

**Note on UserIntentNode schema (T017)**: Output schema must include:
- Static fields: `type: 'trigger'`, `triggered: boolean`, `toolName: string`
- Dynamic fields from `parameters[]` array (each FlowParameter becomes a property)

**Checkpoint**: Foundation ready - all 5 node types have schemas, validation logic is in place

---

## Phase 3: User Story 1 - View Node Schema Information (Priority: P1)

**Goal**: Users can view input/output schemas for any node on the canvas

**Independent Test**: Select any node on the canvas and view its schema panel showing input/output schemas with field types and required markers

### Implementation for User Story 1

- [ ] T022 [US1] Create SchemaController with GET /flows/:flowId/nodes/:nodeId/schema endpoint in packages/backend/src/node/schema/schema.controller.ts
- [ ] T023 [US1] Implement GET /node-types/:nodeType/schema endpoint in packages/backend/src/node/schema/schema.controller.ts
- [ ] T024 [US1] Register SchemaController in NodeModule in packages/backend/src/node/node.module.ts
- [ ] T025 [P] [US1] Create SchemaViewer component (tree view of JSON Schema) in packages/frontend/src/components/node/SchemaViewer.tsx
- [ ] T026 [P] [US1] Create schema utility functions (formatSchemaForDisplay, getFieldSummary) in packages/frontend/src/lib/schemaUtils.ts
- [ ] T027 [US1] Create NodeSchemaPanel component (displays input/output schemas) in packages/frontend/src/components/node/NodeSchemaPanel.tsx
- [ ] T028 [US1] Add API client method for fetching node schema in packages/frontend/src/lib/api.ts
- [ ] T029 [US1] Integrate NodeSchemaPanel into node details/configuration panel in packages/frontend/src/components/flow/ (existing node config component)
- [ ] T030 [US1] Handle null schemas for trigger nodes (no input) and return nodes (no output) in NodeSchemaPanel
- [ ] T031 [US1] Display dynamic parameter fields from UserIntent nodes in schema view in NodeSchemaPanel

**Checkpoint**: User Story 1 complete - users can view schemas for any node including dynamic UserIntent parameters

---

## Phase 4: User Story 2 - Visual Schema Compatibility in Connectors (Priority: P1)

**Goal**: Connection lines display colors (green/yellow/red/gray) based on schema compatibility

**Independent Test**: Connect two nodes and observe the connection line color matches the compatibility status

### Implementation for User Story 2

- [ ] T032 [US2] Create ConnectionValidationState type in packages/frontend/src/types/schema.ts
- [ ] T033 [US2] Create CustomEdge component with color based on validation status in packages/frontend/src/components/flow/CustomEdge.tsx
- [ ] T034 [US2] Define status colors (green=compatible, yellow=warning, red=error, gray=unknown) in packages/frontend/src/components/flow/CustomEdge.tsx
- [ ] T035 [US2] Create useSchemaValidation hook for caching validation results in packages/frontend/src/hooks/useSchemaValidation.ts
- [ ] T036 [US2] Add API client method for single connection validation (POST /flows/:flowId/connections/validate) in packages/frontend/src/lib/api.ts
- [ ] T037 [US2] Register CustomEdge in edgeTypes prop of ReactFlow in packages/frontend/src/components/flow/FlowCanvas.tsx
- [ ] T038 [US2] Update edge data with validation status on connection create in packages/frontend/src/components/flow/FlowCanvas.tsx
- [ ] T039 [US2] Add tooltip on edge hover showing compatibility summary in packages/frontend/src/components/flow/CustomEdge.tsx

**Checkpoint**: User Story 2 complete - connection lines show visual compatibility feedback

---

## Phase 5: User Story 3 - Design-Time Compatibility Validation (Priority: P1)

**Goal**: System validates schema compatibility when user attempts to connect nodes

**Independent Test**: Attempt to connect incompatible nodes and observe validation feedback with specific error messages

### Implementation for User Story 3

- [ ] T040 [US3] Implement POST /flows/:flowId/connections/validate endpoint in packages/backend/src/node/schema/schema.controller.ts
- [ ] T041 [US3] Extend POST /flows/:flowId/connections response with validation result in packages/backend/src/node/node.controller.ts
- [ ] T042 [US3] Update NodeService.createConnection to include validation in packages/backend/src/node/node.service.ts
- [ ] T043 [US3] Create ConnectionValidator component (shows error/warning panel) in packages/frontend/src/components/flow/ConnectionValidator.tsx
- [ ] T044 [US3] Integrate validation check in onConnect callback in packages/frontend/src/components/flow/FlowCanvas.tsx
- [ ] T045 [US3] Show validation feedback before creating connection in packages/frontend/src/components/flow/FlowCanvas.tsx
- [ ] T046 [US3] Display error messages with field-level details in ConnectionValidator in packages/frontend/src/components/flow/ConnectionValidator.tsx
- [ ] T047 [US3] Handle warning state (allow connection but show warning indicator) in packages/frontend/src/components/flow/FlowCanvas.tsx

**Checkpoint**: User Story 3 complete - users get immediate validation feedback when connecting nodes

---

## Phase 6: User Story 4 - Inspect Schema Compatibility Details (Priority: P2)

**Goal**: Users can see detailed field-by-field compatibility information for connections

**Independent Test**: Select a connection with warnings and see detailed explanation for each issue

### Implementation for User Story 4

- [ ] T048 [US4] Extend ConnectionValidator to show field-by-field comparison in packages/frontend/src/components/flow/ConnectionValidator.tsx
- [ ] T049 [US4] Display source schema and target schema side-by-side in ConnectionValidator
- [ ] T050 [US4] Highlight compatible, warning, and error fields with colors in ConnectionValidator
- [ ] T051 [US4] Show detailed issue messages (type mismatch explanations, missing field info) in ConnectionValidator
- [ ] T052 [US4] Add click handler on edge to open detailed compatibility panel in packages/frontend/src/components/flow/FlowCanvas.tsx
- [ ] T053 [US4] Create CompatibilityDetailModal component for full-screen comparison in packages/frontend/src/components/flow/CompatibilityDetailModal.tsx

**Checkpoint**: User Story 4 complete - users can inspect detailed compatibility information

---

## Phase 7: User Story 5 - Dynamic Schema Resolution (Priority: P2)

**Goal**: Nodes with dynamic schemas (API Call, User Intent) can compute/fetch their actual schemas

**Independent Test**: Configure a UserIntent node with parameters or trigger API schema discovery on ApiCall node

### Implementation for User Story 5

- [ ] T054 [US5] Implement POST /flows/:flowId/nodes/:nodeId/schema/resolve endpoint in packages/backend/src/node/schema/schema.controller.ts
- [ ] T055 [US5] Create resolveSchema method in SchemaService for dynamic schema resolution in packages/backend/src/node/schema/schema.service.ts
- [ ] T056 [US5] Implement schema inference from API response sample for ApiCallNode in packages/backend/src/node/schema/schema.service.ts
- [ ] T057 [US5] Implement schema computation from FlowParameter[] for UserIntentNode in packages/backend/src/node/schema/schema.service.ts
- [ ] T058 [US5] Add "Discover Schema" button to API Call node configuration in packages/frontend/src/components/node/ (ApiCall config component)
- [ ] T059 [US5] Add API client method for schema resolution in packages/frontend/src/lib/api.ts
- [ ] T060 [US5] Update node schema display after resolution completes in packages/frontend/src/components/node/NodeSchemaPanel.tsx
- [ ] T061 [US5] Handle pending state while schema resolution is in progress in NodeSchemaPanel
- [ ] T062 [US5] Re-validate affected connections when UserIntent parameters change in packages/frontend/src/hooks/useSchemaValidation.ts
- [ ] T063 [US5] Re-validate affected connections after API schema resolution in packages/frontend/src/hooks/useSchemaValidation.ts

**Checkpoint**: User Story 5 complete - dynamic schemas (UserIntent parameters, API responses) can be resolved

---

## Phase 8: User Story 6 - Flow-Level Validation Summary (Priority: P3)

**Goal**: Users can see an overall validation status for the entire flow with navigation to issues

**Independent Test**: View flow validation summary showing total count of compatible/warning/error connections with navigation

### Implementation for User Story 6

- [ ] T064 [US6] Implement GET /flows/:flowId/connections/validate endpoint in packages/backend/src/node/schema/schema.controller.ts
- [ ] T065 [US6] Implement GET /flows/:flowId/schemas endpoint in packages/backend/src/node/schema/schema.controller.ts
- [ ] T066 [US6] Add API client method for flow-level validation in packages/frontend/src/lib/api.ts
- [ ] T067 [US6] Create FlowValidationSummary component (shows overall status) in packages/frontend/src/components/flow/FlowValidationSummary.tsx
- [ ] T068 [US6] Display validation counts (compatible, warnings, errors, unknown) in FlowValidationSummary
- [ ] T069 [US6] Add navigation to each connection with issues from summary in FlowValidationSummary
- [ ] T070 [US6] Integrate FlowValidationSummary into flow editor header or sidebar in packages/frontend/src/pages/ (flow editor page)
- [ ] T071 [US6] Add refresh button to re-validate all connections in FlowValidationSummary

**Checkpoint**: User Story 6 complete - users can see flow-level validation status

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, re-validation, and cross-cutting improvements

- [ ] T072 Implement re-validation when node parameters change in packages/frontend/src/hooks/useSchemaValidation.ts
- [ ] T073 Handle unknown schema state gracefully (gray color, "Unknown" label) in all components
- [ ] T074 Add error boundaries for schema parsing failures in SchemaViewer and NodeSchemaPanel
- [ ] T075 Implement schema caching to avoid redundant API calls in useSchemaValidation
- [ ] T076 Handle circular $ref in JSON Schema display (depth limit) in SchemaViewer
- [ ] T077 Add loading states for all async schema operations in NodeSchemaPanel and ConnectionValidator
- [ ] T078 Run quickstart.md validation to verify end-to-end flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1, US2, US3 are all P1 priority - can proceed in parallel or sequentially
  - US4, US5 are P2 priority - can proceed after P1 stories or in parallel
  - US6 is P3 priority - can proceed after foundation
- **Polish (Phase 9)**: Depends on user story phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Independent, but benefits from US1 types
- **User Story 3 (P1)**: Can start after Foundational - Uses validation from US2, but independently testable
- **User Story 4 (P2)**: Benefits from US3 ConnectionValidator, but independently testable
- **User Story 5 (P2)**: Extends schema resolution, no story dependencies
- **User Story 6 (P3)**: Uses components from earlier stories, but independently testable

### Within Each Phase

- Backend endpoints before frontend components
- Utility functions before components that use them
- Parent components before child integrations
- Core implementation before integration tasks

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001-T005)
- All node schema additions marked [P] can run in parallel (T017-T021)
- SchemaViewer and schemaUtils marked [P] can run in parallel (T025-T026)
- All user stories can be worked on in parallel by different team members after Phase 2

---

## Parallel Example: Phase 2 Node Schemas

```bash
# Launch all node schema additions together:
Task: "Add getOutputSchema to UserIntentNode (dynamic from parameters) in packages/nodes/src/nodes/UserIntentNode.ts"
Task: "Add inputSchema and outputSchema to ReturnNode in packages/nodes/src/nodes/ReturnNode.ts"
Task: "Add inputSchema and getOutputSchema to InterfaceNode in packages/nodes/src/nodes/InterfaceNode.ts"
Task: "Add inputSchema and getOutputSchema to ApiCallNode in packages/nodes/src/nodes/ApiCallNode.ts"
Task: "Add inputSchema and getOutputSchema to CallFlowNode in packages/nodes/src/nodes/CallFlowNode.ts"
```

---

## Parallel Example: User Story 1 Components

```bash
# Launch frontend components together (after backend endpoints):
Task: "Create SchemaViewer component in packages/frontend/src/components/node/SchemaViewer.tsx"
Task: "Create schema utility functions in packages/frontend/src/lib/schemaUtils.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 + 3)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T021)
3. Complete Phase 3: User Story 1 - View Schemas (T022-T031)
4. Complete Phase 4: User Story 2 - Visual Connectors (T032-T039)
5. Complete Phase 5: User Story 3 - Validation Feedback (T040-T047)
6. **STOP and VALIDATE**: All P1 stories should be functional
7. Run `.specify/scripts/bash/serve-app.sh` to test

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Users can view node schemas (partial value)
3. Add User Story 2 → Connections show colors (visual feedback)
4. Add User Story 3 → Full validation feedback (core feature complete!)
5. Add User Story 4 → Detailed inspection (enhanced experience)
6. Add User Story 5 → Dynamic schema support (extended coverage)
7. Add User Story 6 → Flow-level summary (comprehensive view)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + 4 (schema display path)
   - Developer B: User Story 2 + 3 (validation path)
   - Developer C: User Story 5 + 6 (extended features)
3. Stories complete and integrate independently

---

## Key Changes from Multiple Triggers Feature

The merge from main introduced **multiple UserIntent triggers per flow**, each with:
- Independent MCP tool identity (`toolName`, `toolDescription`)
- Own parameter definitions (`parameters: FlowParameter[]`)
- Active/inactive state (`isActive`)

**Impact on I/O Schema feature**:
1. **UserIntentNode output schema is now dynamic**: Must include user-defined parameters
2. **Each trigger has different output shape**: Based on its configured parameters
3. **Re-validation needed**: When UserIntent parameters change, downstream connections must re-validate

**Schema structure for UserIntent output**:
```typescript
{
  type: 'object',
  properties: {
    type: { type: 'string', const: 'trigger' },
    triggered: { type: 'boolean' },
    toolName: { type: 'string' },
    // + dynamic properties from parameters[]
    // e.g., if parameters = [{name: 'userId', type: 'string', ...}]
    // then: userId: { type: 'string' }
  },
  required: ['type', 'triggered', 'toolName', ...requiredParams]
}
```

---

## Summary

| Phase | Tasks | Purpose |
|-------|-------|---------|
| Phase 1: Setup | T001-T008 | Types and dependencies |
| Phase 2: Foundational | T009-T021 | Validation logic + node schemas |
| Phase 3: US1 | T022-T031 | View node schemas |
| Phase 4: US2 | T032-T039 | Visual connector feedback |
| Phase 5: US3 | T040-T047 | Design-time validation |
| Phase 6: US4 | T048-T053 | Detailed compatibility inspection |
| Phase 7: US5 | T054-T063 | Dynamic schema resolution |
| Phase 8: US6 | T064-T071 | Flow-level validation summary |
| Phase 9: Polish | T072-T078 | Edge cases and refinements |

**Total Tasks**: 78
**MVP Tasks** (P1 stories): 47 (T001-T047)
**Extended Tasks** (P2/P3 stories): 24 (T048-T071)
**Polish Tasks**: 7 (T072-T078)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Testing DEFERRED per POC phase in constitution
- **NEW**: UserIntent nodes have dynamic output schemas based on their parameters array
