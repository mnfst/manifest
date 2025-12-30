# Tasks: Nodes Package Refactor

**Input**: Design documents from `/specs/017-nodes-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Deferred per POC constitution - no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`, `packages/nodes/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new nodes package and update shared types

- [x] T001 [P] Create packages/nodes/ directory structure with package.json and tsconfig.json
- [x] T002 [P] Define NodeTypeDefinition interface in packages/nodes/src/types.ts
- [x] T003 [P] Add NodeInstance and Connection types to packages/shared/src/types/node.ts
- [x] T004 [P] Add Position type and node parameter interfaces (InterfaceNodeParameters, ReturnNodeParameters, CallFlowNodeParameters) to packages/shared/src/types/node.ts
- [x] T005 Update packages/shared/src/types/index.ts to export new node types
- [x] T006 Update root package.json workspaces to include packages/nodes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update FlowEntity with JSON columns and remove old entity relations - BLOCKS all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Add nodes column (simple-json, default '[]') to packages/backend/src/flow/flow.entity.ts
- [x] T008 Add connections column (simple-json, default '[]') to packages/backend/src/flow/flow.entity.ts
- [x] T009 Remove OneToMany relations (views, returnValues, callFlows) from packages/backend/src/flow/flow.entity.ts
- [x] T010 Update Flow type in packages/shared/src/types/flow.ts to include nodes and connections arrays
- [x] T011 Remove old entity imports from packages/backend/src/app/app.module.ts (ViewEntity, ReturnValueEntity, CallFlowEntity, ActionConnectionEntity, MockDataEntity)
- [x] T012 Remove old module imports from packages/backend/src/app/app.module.ts (ViewModule, ReturnValueModule, CallFlowModule, ActionConnectionModule, MockDataModule)
- [x] T013 Delete packages/backend/src/view/ directory (entire module)
- [x] T014 Delete packages/backend/src/return-value/ directory (entire module)
- [x] T015 Delete packages/backend/src/call-flow/ directory (entire module)
- [x] T016 Delete packages/backend/src/action-connection/ directory (entire module)
- [x] T017 Delete packages/backend/src/mock-data/ directory (entire module)
- [x] T018 Remove old type exports from packages/shared/src/types/index.ts (view.ts, return-value.ts, call-flow.ts, action-connection.ts)
- [x] T019 Delete packages/shared/src/types/view.ts
- [x] T020 Delete packages/shared/src/types/return-value.ts
- [x] T021 Delete packages/shared/src/types/call-flow.ts
- [x] T022 Delete packages/shared/src/types/action-connection.ts
- [x] T023 Move MockData types from packages/shared/src/types/mock-data.ts to packages/shared/src/types/node.ts and delete mock-data.ts
- [x] T024 Build shared package to verify types compile: npm run build -w @chatgpt-app-builder/shared

**Checkpoint**: Foundation ready - old entities removed, new JSON columns added

---

## Phase 3: User Story 1 - Flow Designer Edits Nodes on Canvas (Priority: P1) 🎯 MVP

**Goal**: Users can view, drag, add, and connect nodes on the canvas with positions persisting

**Independent Test**: Open a flow, drag a node, reload page, verify position persisted

### Backend Implementation for User Story 1

- [x] T025 [US1] Create NodeService class in packages/backend/src/node/node.service.ts with CRUD operations for nodes array
- [x] T026 [US1] Implement addNode method in NodeService (validates unique name, appends to nodes array)
- [x] T027 [US1] Implement updateNode method in NodeService (find by id, merge updates)
- [x] T028 [US1] Implement updateNodePosition method in NodeService (optimized position-only update)
- [x] T029 [US1] Implement deleteNode method in NodeService (removes node AND cascades to remove connections)
- [x] T030 [US1] Implement getNodes method in NodeService (returns flow.nodes array)
- [x] T031 [US1] Implement addConnection method in NodeService (validates source/target nodes exist)
- [x] T032 [US1] Implement deleteConnection method in NodeService (removes from connections array)
- [x] T033 [US1] Implement getConnections method in NodeService (returns flow.connections array)
- [x] T034 [US1] Create NodeController in packages/backend/src/node/node.controller.ts with REST endpoints
- [x] T035 [US1] Add GET /flows/:flowId/nodes endpoint to NodeController
- [x] T036 [US1] Add POST /flows/:flowId/nodes endpoint to NodeController
- [x] T037 [US1] Add PATCH /flows/:flowId/nodes/:nodeId endpoint to NodeController
- [x] T038 [US1] Add PATCH /flows/:flowId/nodes/:nodeId/position endpoint to NodeController
- [x] T039 [US1] Add DELETE /flows/:flowId/nodes/:nodeId endpoint to NodeController
- [x] T040 [US1] Add GET /flows/:flowId/connections endpoint to NodeController
- [x] T041 [US1] Add POST /flows/:flowId/connections endpoint to NodeController
- [x] T042 [US1] Add DELETE /flows/:flowId/connections/:connectionId endpoint to NodeController
- [x] T043 [US1] Create NodeModule in packages/backend/src/node/node.module.ts importing FlowModule
- [x] T044 [US1] Register NodeModule in packages/backend/src/app/app.module.ts

### Frontend Implementation for User Story 1

- [x] T045 [US1] Create node API service functions in packages/frontend/src/lib/api.ts (getNodes, createNode, updateNode, updateNodePosition, deleteNode)
- [x] T046 [US1] Create connection API service functions in packages/frontend/src/lib/api.ts (getConnections, createConnection, deleteConnection)
- [ ] T047 [US1] Create InterfaceNode component in packages/frontend/src/components/flow/nodes/InterfaceNode.tsx (rename from ViewNode)
- [ ] T048 [US1] Create ReturnNode component in packages/frontend/src/components/flow/nodes/ReturnNode.tsx (rename from ReturnValueNode)
- [ ] T049 [US1] Create CallFlowNode component in packages/frontend/src/components/flow/nodes/CallFlowNode.tsx (update existing)
- [ ] T050 [US1] Update FlowCanvas in packages/frontend/src/components/flow/FlowCanvas.tsx to load nodes from JSON via API
- [ ] T051 [US1] Update FlowCanvas onNodesChange handler to sync position changes to backend
- [ ] T052 [US1] Update FlowCanvas onConnect handler to create connections via API
- [ ] T053 [US1] Update FlowCanvas onEdgesDelete handler to delete connections via API
- [ ] T054 [US1] Update node type registration in FlowCanvas to use InterfaceNode, ReturnNode, CallFlowNode
- [ ] T055 [US1] Add onNodeDragStop handler to FlowCanvas to persist position on drag end
- [ ] T056 [US1] Remove old view/returnValue/callFlow/actionConnection service imports from frontend

**Checkpoint**: User Story 1 complete - canvas editing with position persistence works

---

## Phase 4: User Story 4 - Migration of Existing Flows (Priority: P1)

**Goal**: Existing flows with old entities are migrated to new JSON structure (handled by TypeORM auto-sync in POC mode)

**Independent Test**: Existing flows show empty nodes/connections arrays, app still loads without errors

**Note**: In POC mode with TypeORM synchronize:true, old tables are dropped automatically when entities are removed. No explicit migration script needed - new flows will use the JSON structure.

### Implementation for User Story 4

- [ ] T057 [US4] Verify database file can be deleted for fresh start in POC mode (document in quickstart.md)
- [ ] T058 [US4] Update FlowService.create in packages/backend/src/flow/flow.service.ts to initialize empty nodes and connections arrays
- [ ] T059 [US4] Update FlowService.findOne to ensure nodes/connections default to empty arrays if null
- [ ] T060 [US4] Run application and verify old tables are dropped, new columns created

**Checkpoint**: User Story 4 complete - clean schema transition works

---

## Phase 5: User Story 2 - System Executes Flow Nodes (Priority: P1)

**Goal**: Flow execution traverses nodes using connections and calls each node's execute function

**Independent Test**: Trigger a flow with Interface→Return nodes, verify Interface renders and Return outputs text

### Nodes Package Implementation for User Story 2

- [ ] T061 [P] [US2] Implement Interface node definition in packages/nodes/src/definitions/interface.node.ts with execute function
- [ ] T062 [P] [US2] Implement Return node definition in packages/nodes/src/definitions/return.node.ts with execute function
- [ ] T063 [P] [US2] Implement CallFlow node definition in packages/nodes/src/definitions/call-flow.node.ts with execute function
- [ ] T064 [US2] Create node registry in packages/nodes/src/registry.ts exporting nodeRegistry, getNodeType, getAllNodeTypes
- [ ] T065 [US2] Create packages/nodes/src/index.ts exporting registry and types
- [ ] T066 [US2] Build nodes package: npm run build -w @chatgpt-app-builder/nodes

### Backend Execution Implementation for User Story 2

- [ ] T067 [US2] Add @chatgpt-app-builder/nodes dependency to packages/backend/package.json
- [ ] T068 [US2] Create FlowExecutionService in packages/backend/src/flow/flow-execution.service.ts
- [ ] T069 [US2] Implement traverseNodes method in FlowExecutionService (follows connections in order)
- [ ] T070 [US2] Implement executeNode method in FlowExecutionService (looks up node type, calls execute function)
- [ ] T071 [US2] Implement executeFlow method in FlowExecutionService (entry point for flow execution)
- [ ] T072 [US2] Add GET /node-types endpoint to return available node types from registry
- [ ] T073 [US2] Wire FlowExecutionService into existing MCP tool execution path

**Checkpoint**: User Story 2 complete - flow execution with node types works

---

## Phase 6: User Story 3 - Developer Adds New Node Type (Priority: P2)

**Goal**: Developers can add new node types by creating definition files in the nodes package

**Independent Test**: Create a new node definition file, register it, verify it appears in /node-types endpoint

### Implementation for User Story 3

- [ ] T074 [US3] Add documentation comments to packages/nodes/src/types.ts explaining NodeTypeDefinition interface
- [ ] T075 [US3] Add example/template node definition in packages/nodes/src/definitions/_template.node.ts (commented out)
- [ ] T076 [US3] Document node registration process in packages/nodes/README.md
- [ ] T077 [US3] Add @chatgpt-app-builder/nodes dependency to packages/frontend/package.json for node type info
- [ ] T078 [US3] Create useNodeTypes hook in packages/frontend/src/hooks/useNodeTypes.ts to fetch available node types
- [ ] T079 [US3] Update AddNodePanel (or create) to display available node types from registry

**Checkpoint**: User Story 3 complete - extensibility pattern documented and working

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation

- [ ] T080 Remove any remaining references to old View/ReturnValue/CallFlow naming in frontend
- [ ] T081 Update any remaining API service files to remove old endpoint calls
- [ ] T082 Run full build: npm run build
- [ ] T083 Run lint: npm run lint
- [ ] T084 Run application with serve-app.sh and manually test canvas operations
- [ ] T085 Verify node positions persist after page reload
- [ ] T086 Verify connections are removed when source/target node is deleted
- [ ] T087 Verify unique node name validation works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 - Core canvas functionality
- **User Story 4 (Phase 4)**: Depends on Phase 2 - Can run parallel to US1
- **User Story 2 (Phase 5)**: Depends on Phase 3 (needs node CRUD) - Adds execution
- **User Story 3 (Phase 6)**: Depends on Phase 5 (needs node registry) - Adds extensibility
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Can Start After | Notes |
|-------|-----------------|-------|
| US1 (Canvas) | Phase 2 | MVP - core editing experience |
| US4 (Migration) | Phase 2 | Can parallelize with US1 |
| US2 (Execution) | US1 complete | Needs node service |
| US3 (Extensibility) | US2 complete | Needs registry |

### Parallel Opportunities

**Within Phase 1** (all [P]):
```
T001, T002, T003, T004 can run in parallel
```

**Within Phase 5** (US2 node definitions):
```
T061, T062, T063 can run in parallel (different files)
```

---

## Parallel Example: User Story 2 Node Definitions

```bash
# Launch all node definitions in parallel:
Task: "Implement Interface node definition in packages/nodes/src/definitions/interface.node.ts"
Task: "Implement Return node definition in packages/nodes/src/definitions/return.node.ts"
Task: "Implement CallFlow node definition in packages/nodes/src/definitions/call-flow.node.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types and package structure)
2. Complete Phase 2: Foundational (remove old entities, add JSON columns)
3. Complete Phase 3: User Story 1 (canvas editing)
4. **STOP and VALIDATE**: Open app, add nodes, drag, connect, reload - verify persistence
5. Can demo basic flow editing

### Incremental Delivery

1. Setup + Foundational → Schema ready
2. Add US1 (Canvas) → Test independently → Basic editing works (MVP!)
3. Add US4 (Migration) → Clean database transition
4. Add US2 (Execution) → Flows actually run
5. Add US3 (Extensibility) → Developers can add nodes
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Testing deferred per POC constitution
- Commit after each task or logical group
- TypeORM synchronize:true handles schema changes automatically
- Delete data/app.db for fresh start if needed during development
