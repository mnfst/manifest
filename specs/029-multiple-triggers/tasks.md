# Tasks: Multiple Triggers per Flow

**Input**: Design documents from `/specs/029-multiple-triggers/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: POC phase - no automated tests required per constitution

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/nodes/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Update shared types that all other changes depend on

- [x] T001 [P] Update UserIntentNodeParameters interface to add toolName, toolDescription, parameters, isActive fields in `packages/shared/src/types/node.ts`
- [x] T002 [P] Update Flow interface to remove toolName, toolDescription, parameters fields in `packages/shared/src/types/flow.ts`
- [x] T003 [P] Add FlowWithMeta helper interface with exposedTools and hasTriggers computed properties in `packages/shared/src/types/flow.ts`
- [x] T004 [P] Create toSnakeCase utility function in `packages/shared/src/utils/tool-name.ts` (already exists in packages/shared/src/utils/string.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend changes that MUST be complete before user story features work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Update FlowEntity to remove toolName, toolDescription, parameters columns in `packages/backend/src/flow/flow.entity.ts`
- [x] T006 Update CreateFlowRequest DTO to remove tool fields in `packages/backend/src/flow/flow.controller.ts`
- [x] T007 Update UpdateFlowRequest DTO to remove tool fields in `packages/backend/src/flow/flow.controller.ts`
- [x] T008 Update flow.service.ts to remove tool property handling from createFlow in `packages/backend/src/flow/flow.service.ts`
- [x] T009 Update flow.service.ts to remove tool property handling from updateFlow in `packages/backend/src/flow/flow.service.ts`
- [x] T010 Update UserIntentNode defaultParameters to include toolName, toolDescription, parameters, isActive in `packages/nodes/src/nodes/UserIntentNode.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Create Flow with Multiple Triggers (Priority: P1) 🎯 MVP

**Goal**: Allow multiple UserIntent trigger nodes per flow, each with its own tool identity

**Independent Test**: Create a flow, add 2+ trigger nodes with different names, verify each has unique toolName

### Implementation for User Story 1

- [x] T011 [US1] Create generateUniqueToolName utility function in `packages/backend/src/utils/tool-name.ts`
- [x] T012 [US1] Update node.service.ts addNode to auto-generate toolName for UserIntent nodes in `packages/backend/src/node/node.service.ts`
- [x] T013 [US1] Update node.service.ts updateNode to regenerate toolName when node name changes in `packages/backend/src/node/node.service.ts`
- [x] T014 [US1] Add tool name uniqueness validation across app in `packages/backend/src/node/node.service.ts`
- [x] T015 [P] [US1] Update NodeEditModal to show toolName (read-only), toolDescription, parameters fields for UserIntent nodes in `packages/frontend/src/components/flow/NodeEditModal.tsx`
- [x] T016 [P] [US1] Update UserIntentNode canvas component to display toolName on the node in `packages/frontend/src/components/flow/UserIntentNode.tsx`

**Checkpoint**: Flow can have multiple triggers, each with unique tool identity

---

## Phase 4: User Story 2 - MCP Tool Generation from Trigger Nodes (Priority: P1)

**Goal**: MCP server derives tools from UserIntent nodes instead of flows

**Independent Test**: Create flow with 2 triggers, call MCP list_tools, verify both tools appear

### Implementation for User Story 2

- [x] T017 [US2] Refactor listTools in mcp.tool.ts to iterate over flows and extract tools from UserIntent nodes in `packages/backend/src/mcp/mcp.tool.ts`
- [x] T018 [US2] Update listTools to filter by trigger isActive property in `packages/backend/src/mcp/mcp.tool.ts`
- [x] T019 [US2] Update buildInputSchema to use trigger parameters instead of flow parameters in `packages/backend/src/mcp/mcp.tool.ts`

**Checkpoint**: MCP tools are now derived from triggers, not flows

---

## Phase 5: User Story 3 - Execute Flow via Specific Trigger (Priority: P1)

**Goal**: Tool execution starts from the specific trigger that was invoked

**Independent Test**: Create flow with 2 triggers with different params, call each tool, verify correct params used

### Implementation for User Story 3

- [x] T020 [US3] Create findTriggerByToolName helper function in `packages/backend/src/mcp/mcp.tool.ts`
- [x] T021 [US3] Update executeTool to find trigger by toolName and use its parameters in `packages/backend/src/mcp/mcp.tool.ts`
- [x] T022 [US3] Update getNodesReachableFrom to start from specific trigger node ID in `packages/backend/src/mcp/mcp.tool.ts`
- [x] T023 [US3] Add parameter validation using trigger's parameter schema in `packages/backend/src/mcp/mcp.tool.ts`

**Checkpoint**: Tool execution is now trigger-aware with correct parameter handling

---

## Phase 6: User Story 4 - Multiple Triggers to Same Action (Priority: P2)

**Goal**: Multiple trigger nodes can connect to the same downstream action/return node

**Independent Test**: Create 2 triggers both connecting to same Return node, verify both work

### Implementation for User Story 4

- [x] T024 [US4] Verify connection validation allows multiple sources to same target in `packages/backend/src/node/node.service.ts`
- [x] T025 [US4] Update getNodesReachableFrom to handle multiple paths correctly in `packages/backend/src/mcp/mcp.tool.ts`
- [x] T026 [P] [US4] Update FlowDiagram to render multiple connections to same node correctly in `packages/frontend/src/components/flow/FlowDiagram.tsx`

**Checkpoint**: Multiple triggers can share downstream nodes

---

## Phase 7: User Story 5 - Migration from Flow-Level Tool Properties (Priority: P2)

**Goal**: Migrate existing flows to move tool properties from flow to first trigger node

**Independent Test**: Run migration on existing flows, verify trigger nodes have tool properties

### Implementation for User Story 5

- [x] T027 [US5] Create migration script to move tool properties from flows to first UserIntent node in `packages/backend/src/seed/seed.service.ts`
- [x] T028 [US5] Add logic to create UserIntent node if flow has none in `packages/backend/src/seed/seed.service.ts`
- [x] T029 [US5] Integrate migration into app startup (run once) in `packages/backend/src/seed/seed.service.ts`

**Checkpoint**: All existing flows are migrated to new trigger-based model

---

## Phase 8: User Story 6 - Distinct Tool Identity Display (Priority: P2)

**Goal**: UI clearly shows that each trigger = one MCP tool

**Independent Test**: Visual inspection of trigger nodes and flow summary showing tool names

### Implementation for User Story 6

- [x] T030 [P] [US6] Add "MCP Tool" section header to UserIntent config panel in `packages/frontend/src/components/flow/NodeEditModal.tsx`
- [x] T031 [P] [US6] Add warning icon for flows without triggers on FlowCard in `packages/frontend/src/components/flow/FlowCard.tsx`
- [x] T032 [P] [US6] Add warning icon on canvas header for flows without triggers in `packages/frontend/src/pages/FlowDetail.tsx`
- [x] T033 [P] [US6] Add tooltip component for warning icon with message in `packages/frontend/src/components/flow/FlowCard.tsx`
- [x] T034 [US6] Add exposed tools summary (MCP Tools: tool1, tool2) to flow detail header in `packages/frontend/src/pages/FlowDetail.tsx`

**Checkpoint**: Users clearly understand trigger-to-tool relationship

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation

- [x] T035 Verify all TypeScript types are correctly exported from shared package in `packages/shared/src/index.ts`
- [x] T036 Run full application and validate all user stories work end-to-end
- [x] T037 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1, US2, US3 (P1) should complete before US4, US5, US6 (P2)
  - Within same priority, stories can proceed in parallel
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Priority | Dependencies | Can Parallelize With |
|-------|----------|--------------|---------------------|
| US1 | P1 | Foundational only | US2, US3 (after Foundational) |
| US2 | P1 | Foundational only | US1, US3 (after Foundational) |
| US3 | P1 | US2 (needs tool list to work) | - |
| US4 | P2 | US1, US2, US3 (needs basic multi-trigger working) | US5, US6 |
| US5 | P2 | Foundational only | US4, US6 |
| US6 | P2 | US1 (needs trigger UI to exist) | US4, US5 |

### Within Each User Story

- Models/types before services
- Services before controllers/UI
- Backend before frontend (for same feature)
- Core implementation before edge cases

### Parallel Opportunities

- **Phase 1**: All tasks (T001-T004) can run in parallel
- **Phase 3**: T015 and T016 can run in parallel (different files)
- **Phase 6**: T026 can run in parallel with T024-T025
- **Phase 8**: T030, T031, T032, T033 can all run in parallel

---

## Parallel Example: Phase 1 (Setup)

```bash
# Launch all setup tasks together:
Task: "Update UserIntentNodeParameters in packages/shared/src/types/node.ts"
Task: "Update Flow interface in packages/shared/src/types/flow.ts"
Task: "Add FlowWithMeta helper in packages/shared/src/types/flow.ts"
Task: "Create toSnakeCase utility in packages/shared/src/utils/tool-name.ts"
```

## Parallel Example: Phase 8 (UI Polish)

```bash
# Launch all UI tasks together:
Task: "Add MCP Tool section to NodeEditModal"
Task: "Add warning icon to FlowCard"
Task: "Add warning icon to canvas header"
Task: "Add tooltip component"
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup (shared types)
2. Complete Phase 2: Foundational (entity + DTO changes)
3. Complete Phase 3: US1 - Multiple Triggers
4. Complete Phase 4: US2 - MCP Tool Generation
5. Complete Phase 5: US3 - Trigger-Specific Execution
6. **STOP and VALIDATE**: Core feature fully functional
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 → Test → Multiple triggers work
3. Add US2 → Test → MCP exposes all triggers as tools
4. Add US3 → Test → Each tool executes correctly (MVP Complete!)
5. Add US4, US5, US6 (P2) → Enhanced UX and migration

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- POC phase: No automated tests required
- Each user story should be independently testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
