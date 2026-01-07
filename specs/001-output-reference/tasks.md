# Tasks: Output Reference & Trigger Node UX Improvements

**Input**: Design documents from `/specs/001-output-reference/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Testing DEFERRED (POC phase per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`, `packages/nodes/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add slug field to NodeInstance and create shared slug utilities

- [x] T001 [P] Add `slug` field to NodeInstance interface in packages/shared/src/types/node.ts
- [x] T002 [P] Create slug utility functions (toSlug, generateUniqueSlug, isValidSlug) in packages/shared/src/utils/slug.ts
- [x] T003 [P] Add FlattenedSchemaField type to packages/shared/src/types/schema.ts
- [x] T004 Export new types and utilities from packages/shared/src/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend slug generation and template resolution that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Import slug utilities in packages/backend/src/node/node.service.ts
- [x] T006 Generate slug when creating node (addNode method) in packages/backend/src/node/node.service.ts
- [x] T007 Update slug when renaming node (updateNode method) in packages/backend/src/node/node.service.ts
- [x] T008 Add migration logic to generate slugs for existing nodes without them in packages/backend/src/node/node.service.ts
- [x] T009 Implement slug-based template variable resolution in packages/backend/src/mcp/mcp.tool.ts
- [x] T010 Add backward-compatible UUID fallback resolution in packages/backend/src/mcp/mcp.tool.ts
- [x] T011 [P] Add x-field-source metadata to UserIntentNode output schema in packages/shared/src/utils/schemaValidator.ts
- [x] T012 [P] Add x-field-source metadata to ApiCallNode output schema in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T013 [P] Add x-field-source metadata to InterfaceNode output schema in packages/nodes/src/nodes/InterfaceNode.ts
- [x] T014 [P] Add x-field-source metadata to CallFlowNode output schema in packages/nodes/src/nodes/CallFlowNode.ts
- [x] T015 [P] Add x-field-source metadata to ReturnNode (documented) in packages/nodes/src/nodes/ReturnNode.ts

**Checkpoint**: Foundation ready - all nodes have slugs and x-field-source metadata, template resolution works

---

## Phase 3: User Story 1 - Use Previous Node Outputs in Configuration (Priority: P1)

**Goal**: Users can easily reference outputs from upstream nodes via dropdown + copy button

**Independent Test**: Open any node config modal, use "Use Previous Outputs" component to select a node and field, copy reference to clipboard

### Implementation for User Story 1

- [x] T016 [P] [US1] Create flattenSchemaProperties() function in packages/frontend/src/lib/schemaUtils.ts
- [x] T017 [P] [US1] Create UpstreamNodeInfo type in packages/frontend/src/types/schema.ts
- [x] T018 [US1] Create useUpstreamNodes hook (graph traversal + schema fetching) in packages/frontend/src/hooks/useUpstreamNodes.ts
- [x] T019 [US1] Create UsePreviousOutputs component with source node dropdown in packages/frontend/src/components/common/UsePreviousOutputs.tsx
- [x] T020 [US1] Add output field dropdown to UsePreviousOutputs with field descriptions in packages/frontend/src/components/common/UsePreviousOutputs.tsx
- [x] T021 [US1] Add copy-to-clipboard button generating {{ slug.path }} format in packages/frontend/src/components/common/UsePreviousOutputs.tsx
- [x] T022 [US1] Integrate UsePreviousOutputs into NodeEditModal configuration tab in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T023 [US1] Handle edge case: no upstream nodes (hide component or show message) in packages/frontend/src/components/common/UsePreviousOutputs.tsx
- [x] T024 [US1] Handle edge case: node with no outputs or unknown schema in packages/frontend/src/components/common/UsePreviousOutputs.tsx

**Checkpoint**: User Story 1 complete - users can select and copy output references from dropdowns

---

## Phase 4: User Story 2 - Clear Trigger Node Schema Display (Priority: P1)

**Goal**: Trigger nodes clearly show "no input" and distinguish static vs dynamic output fields

**Independent Test**: Select a UserIntent trigger, view schema panel showing "No input" and static/dynamic badges on output fields

### Implementation for User Story 2

- [x] T025 [US2] Update NodeSchemaPanel to show "No input - triggers start the flow" for null inputSchema in packages/frontend/src/components/node/NodeSchemaPanel.tsx
- [x] T026 [US2] Add static/dynamic badge rendering based on x-field-source in SchemaViewer in packages/frontend/src/components/node/SchemaViewer.tsx
- [x] T027 [US2] Style static fields with muted badge (e.g., gray "Static" label) in packages/frontend/src/components/node/SchemaViewer.tsx
- [x] T028 [US2] Style dynamic fields with highlighted badge (e.g., blue "From Parameters" label) in packages/frontend/src/components/node/SchemaViewer.tsx
- [x] T029 [US2] Add helper text in NodeEditModal explaining parameters become trigger outputs in packages/frontend/src/components/flow/NodeEditModal.tsx

**Checkpoint**: User Story 2 complete - trigger schema display is clear and informative

---

## Phase 5: User Story 3 - Active/Inactive Toggle for MCP Tool Exposure (Priority: P2)

**Goal**: Replace "Expose as MCP tool" checkbox with an "Active" toggle switch

**Independent Test**: Open Edit User Intent modal, verify toggle switch instead of checkbox, toggle state changes isActive

### Implementation for User Story 3

- [x] T030 [US3] Replace isActive checkbox with toggle switch component in NodeEditModal in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T031 [US3] Update toggle label to "Active" with clear on/off state indication in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T032 [US3] Add tooltip explaining "Active triggers are exposed as MCP tools" in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T033 [US3] Ensure toggle state correctly maps to isActive parameter on save in packages/frontend/src/components/flow/NodeEditModal.tsx

**Checkpoint**: User Story 3 complete - toggle switch is clear and intuitive

---

## Phase 6: User Story 4 - Slug-Based Node References (Priority: P2)

**Goal**: All node references use human-readable slugs instead of UUIDs

**Independent Test**: Create nodes, verify slugs are assigned and displayed, output references use slugs

### Implementation for User Story 4

- [x] T034 [US4] Display node slug in node component tooltips or labels in packages/frontend/src/components/flow/
- [x] T035 [US4] Show slug in NodeEditModal header or info section in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T036 [US4] Update reference migration: find UUID patterns in ApiCall configs, replace with slugs in packages/backend/src/node/node.service.ts (done in T008)
- [x] T037 [US4] Handle slug uniqueness collision (append _2, _3 suffix) in packages/shared/src/utils/slug.ts (done in T002)
- [x] T038 [US4] Update downstream node references when a node is renamed in packages/backend/src/node/node.service.ts (done in T007)

**Checkpoint**: User Story 4 complete - all references are human-readable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, error handling, and cross-cutting improvements

- [x] T039 Handle unknown/pending schema state in UsePreviousOutputs (show refresh option) in packages/frontend/src/components/common/UsePreviousOutputs.tsx
- [x] T040 Add loading state while fetching upstream node schemas in packages/frontend/src/hooks/useUpstreamNodes.ts (done in T018)
- [x] T041 Handle deleted node references - graceful empty string resolution in backend (acceptable for POC)
- [x] T042 Add reserved slug validation (flow, trigger, output, input, node, connection) in packages/shared/src/utils/slug.ts (done in T002)
- [x] T043 Run quickstart.md validation - all 5 scenarios covered by implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority - can proceed in parallel
  - US3 and US4 are both P2 priority - can proceed after P1 or in parallel
- **Polish (Phase 7)**: Depends on user story phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Needs slug field and schema metadata
- **User Story 2 (P1)**: Can start after Foundational - Needs x-field-source metadata
- **User Story 3 (P2)**: Can start after Foundational - Independent UI change
- **User Story 4 (P2)**: Can start after Foundational - Needs slug generation working

### Within Each Phase

- Shared types before utilities
- Utilities before components that use them
- Backend changes before frontend integration
- Core implementation before edge case handling

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001-T003)
- All node schema metadata tasks marked [P] can run in parallel (T011-T015)
- Schema utilities T016-T017 can run in parallel
- US1 and US2 can be worked on in parallel after Foundational
- US3 and US4 can be worked on in parallel after Foundational

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all setup tasks together:
Task: "Add slug field to NodeInstance interface in packages/shared/src/types/node.ts"
Task: "Create slug utility functions in packages/shared/src/utils/slug.ts"
Task: "Add FlattenedSchemaField type to packages/shared/src/types/schema.ts"
```

---

## Parallel Example: Phase 2 Node Schema Metadata

```bash
# Launch all node schema updates together:
Task: "Add x-field-source metadata to UserIntentNode in packages/nodes/src/nodes/UserIntentNode.ts"
Task: "Add x-field-source metadata to ApiCallNode in packages/nodes/src/nodes/ApiCallNode.ts"
Task: "Add x-field-source metadata to InterfaceNode in packages/nodes/src/nodes/InterfaceNode.ts"
Task: "Add x-field-source metadata to CallFlowNode in packages/nodes/src/nodes/CallFlowNode.ts"
Task: "Add x-field-source metadata to ReturnNode in packages/nodes/src/nodes/ReturnNode.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T015)
3. Complete Phase 3: User Story 1 - Use Previous Outputs (T016-T024)
4. Complete Phase 4: User Story 2 - Schema Display (T025-T029)
5. **STOP and VALIDATE**: Both P1 stories should be functional
6. Run `.specify/scripts/bash/serve-app.sh` to test

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Users can copy output references (partial value)
3. Add User Story 2 → Clear trigger schema display (core UX improvement)
4. Add User Story 3 → Active toggle (enhanced clarity)
5. Add User Story 4 → Full slug-based references (complete feature)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Use Previous Outputs)
   - Developer B: User Story 2 (Schema Display)
3. After P1 stories:
   - Developer A: User Story 3 (Active Toggle)
   - Developer B: User Story 4 (Slug References)
4. Team: Polish phase together

---

## Summary

| Phase | Tasks | Purpose |
|-------|-------|---------|
| Phase 1: Setup | T001-T004 | Types and utilities |
| Phase 2: Foundational | T005-T015 | Backend slug generation, schema metadata |
| Phase 3: US1 | T016-T024 | Use Previous Outputs component |
| Phase 4: US2 | T025-T029 | Trigger schema display |
| Phase 5: US3 | T030-T033 | Active toggle switch |
| Phase 6: US4 | T034-T038 | Slug-based references |
| Phase 7: Polish | T039-T043 | Edge cases and validation |

**Total Tasks**: 43
**MVP Tasks** (P1 stories): 29 (T001-T029)
**Extended Tasks** (P2 stories): 9 (T030-T038)
**Polish Tasks**: 5 (T039-T043)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Testing DEFERRED per POC phase in constitution
