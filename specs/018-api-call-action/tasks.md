# Tasks: API Call Action Node

**Input**: Design documents from `/specs/018-api-call-action/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: OPTIONAL - Constitution defines POC phase with manual testing. No automated tests included.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a pnpm monorepo with the following structure:
- `packages/shared/src/` - Shared TypeScript types
- `packages/nodes/src/` - Node type definitions and execution logic
- `packages/frontend/src/` - React frontend components
- `packages/backend/src/` - NestJS backend (no changes needed for this feature)

---

## Phase 1: Setup (Shared Types)

**Purpose**: Add shared type definitions that all packages depend on

- [x] T001 Add 'ApiCall' to NodeType union in packages/shared/src/types/node.ts
- [x] T002 Add HttpMethod type ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') in packages/shared/src/types/node.ts
- [x] T003 Add HeaderEntry interface (key: string, value: string) in packages/shared/src/types/node.ts
- [x] T004 Add ApiCallNodeParameters interface in packages/shared/src/types/node.ts
- [x] T005 Add isApiCallNode type guard function in packages/shared/src/types/node.ts
- [x] T006 Export new types from packages/shared/src/types/index.ts

---

## Phase 2: Foundational (Node Type Definition)

**Purpose**: Create the core ApiCallNode type definition in the nodes package. BLOCKS UI implementation.

**⚠️ CRITICAL**: Frontend work cannot begin until this phase is complete

- [x] T007 Create ApiCallNode.ts file with NodeTypeDefinition structure in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T008 Implement defaultParameters matching ApiCallNodeParameters in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T009 Export ApiCallNode from packages/nodes/src/nodes/index.ts
- [x] T010 Add ApiCallNode to builtInNodes record in packages/nodes/src/nodes/index.ts
- [x] T011 Add ApiCallNode to builtInNodeList array in packages/nodes/src/nodes/index.ts
- [x] T012 Rebuild shared and nodes packages to verify types compile (pnpm build --filter @chatgpt-app-builder/shared --filter @chatgpt-app-builder/nodes)

**Checkpoint**: Node type definition ready - UI and execution implementation can now proceed

---

## Phase 3: User Story 1 - Configure Basic API Call (Priority: P1) 🎯 MVP

**Goal**: Users can add an API Call node from the "+" modal, configure URL/method/headers, and see it in the flow diagram with input/output handles.

**Independent Test**: Add API Call node, configure to call https://jsonplaceholder.typicode.com/posts/1, verify node displays correctly in flow.

### Frontend - Node Picker (AddStepModal)

- [x] T013 [US1] Import Globe icon from lucide-react in packages/frontend/src/components/flow/AddStepModal.tsx
- [x] T014 [US1] Add 'ApiCall' to the stepType union type in AddStepModalProps in packages/frontend/src/components/flow/AddStepModal.tsx
- [x] T015 [US1] Add ApiCall option to stepOptions array with orange theme (text-orange-600, bg-orange-50, border-orange-200) in packages/frontend/src/components/flow/AddStepModal.tsx

### Frontend - Node Configuration (NodeEditModal)

- [x] T016 [US1] Import ApiCallNodeParameters and related types in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T017 [US1] Add state variables for ApiCall fields (method, url, headers, timeout) in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T018 [US1] Add ApiCall initialization in useEffect for edit mode in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T019 [US1] Add ApiCall case in handleSubmit to build parameters in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T020 [US1] Add ApiCall case in getNodeTypeInfo() for icon/title/description in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T021 [US1] Add ApiCall form fields: URL input, method dropdown, timeout input in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T022 [US1] Add headers key-value editor component for ApiCall in packages/frontend/src/components/flow/NodeEditModal.tsx

### Frontend - Node Visualization

- [x] T023 [P] [US1] Create ApiCallNode.tsx visual component following ViewNode pattern in packages/frontend/src/components/flow/ApiCallNode.tsx
- [x] T024 [US1] Add left input Handle (type="target") in ApiCallNode component in packages/frontend/src/components/flow/ApiCallNode.tsx
- [x] T025 [US1] Add right output Handle (type="source") in ApiCallNode component in packages/frontend/src/components/flow/ApiCallNode.tsx
- [x] T026 [US1] Add Globe icon and orange color theme to ApiCallNode display in packages/frontend/src/components/flow/ApiCallNode.tsx
- [x] T027 [US1] Add ViewNodeDropdown for edit/delete actions in ApiCallNode in packages/frontend/src/components/flow/ApiCallNode.tsx
- [x] T028 [US1] Register ApiCallNode in FlowDiagram nodeTypes if needed in packages/frontend/src/components/flow/FlowDiagram.tsx

### Node Execution Logic (US1 scope: basic execution without input mapping)

- [x] T029 [US1] Implement basic execute() function with native fetch in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T030 [US1] Add AbortController timeout handling in execute() in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T031 [US1] Add URL validation (non-empty check) in execute() in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T032 [US1] Return ApiCallOutput structure with status, headers, body in packages/nodes/src/nodes/ApiCallNode.ts

**Checkpoint**: User Story 1 complete - users can add, configure, and execute basic API Call nodes

---

## Phase 4: User Story 2 - Use Previous Node Output as Input (Priority: P2)

**Goal**: Users can map outputs from upstream nodes to dynamically construct URL, headers, or body for the API call.

**Independent Test**: Create a two-node flow where first node outputs data, API Call node uses {{prev.id}} in URL, verify correct URL is called.

### Shared Types for Input Mapping

- [x] T033 [P] [US2] Add InputMapping interface to packages/shared/src/types/node.ts
- [x] T034 [US2] Add inputMappings field to ApiCallNodeParameters in packages/shared/src/types/node.ts

### Frontend - Input Mapping UI

- [ ] T035 [US2] Add inputMappings state variable in NodeEditModal in packages/frontend/src/components/flow/NodeEditModal.tsx
- [ ] T036 [US2] Create input mapping selector component showing available upstream outputs in packages/frontend/src/components/flow/InputMappingEditor.tsx
- [ ] T037 [US2] Integrate InputMappingEditor into ApiCall form section in packages/frontend/src/components/flow/NodeEditModal.tsx
- [ ] T038 [US2] Display template syntax hint ({{nodeId.path}}) in URL/header fields in packages/frontend/src/components/flow/NodeEditModal.tsx

### Execution - Template Resolution

- [x] T039 [US2] Add template resolution helper function to resolve {{nodeId.path}} patterns in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T040 [US2] Integrate template resolution in execute() for URL field in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T041 [US2] Integrate template resolution in execute() for header values in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T042 [US2] Use context.getNodeValue() to fetch upstream node outputs in packages/nodes/src/nodes/ApiCallNode.ts

**Checkpoint**: User Story 2 complete - users can dynamically construct API calls from upstream data

---

## Phase 5: User Story 3 - Handle API Call Errors Gracefully (Priority: P3)

**Goal**: API call failures (network errors, timeouts, HTTP errors) are captured in output without crashing the flow.

**Independent Test**: Configure API Call with invalid URL or unreachable endpoint, execute flow, verify error info in output.

### Error Handling in Execution

- [x] T043 [US3] Add try-catch wrapper around fetch call in execute() in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T044 [US3] Handle AbortError (timeout) with descriptive error message in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T045 [US3] Handle network errors (TypeError from fetch) with descriptive message in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T046 [US3] Ensure HTTP 4xx/5xx responses return success=true with full response data in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T047 [US3] Add requestDuration field to output (measure elapsed time) in packages/nodes/src/nodes/ApiCallNode.ts

### UI - Error Display (Optional Enhancement)

- [ ] T048 [P] [US3] Display error state visually in ApiCallNode component if last execution failed in packages/frontend/src/components/flow/ApiCallNode.tsx

**Checkpoint**: User Story 3 complete - API call errors are gracefully captured and available to downstream nodes

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation

- [x] T049 [P] Add JSDoc comments to ApiCallNode execute() function in packages/nodes/src/nodes/ApiCallNode.ts
- [x] T050 [P] Add JSDoc comments to new shared types in packages/shared/src/types/node.ts
- [x] T051 Verify type exports are correct across all packages (pnpm type-check)
- [x] T052 Run linter and fix any issues (pnpm lint)
- [x] T053 Manual test: Complete flow with API Call node calling real API
- [x] T054 Serve application for user testing (.specify/scripts/bash/serve-app.sh)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Phase 2 completion
  - US1 can proceed first (MVP)
  - US2 can proceed after US1 (builds on US1)
  - US3 can proceed after US1 (builds on US1 execution)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 execution logic being in place
- **User Story 3 (P3)**: Depends on US1 execution logic being in place

### Within Each User Story

- Types before implementation
- Node definition before UI
- Core implementation before enhancements
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T001-T006 are sequential (same file)
- Phase 2: T007-T011 are sequential (same files)
- Phase 3: T023 (ApiCallNode.tsx) can run parallel with T013-T022 (different files)
- Phase 4: T033 can run parallel with other US2 tasks
- Phase 5: T048 can run parallel with T043-T047

---

## Parallel Example: User Story 1

```bash
# These tasks can run in parallel (different files):
Task T023: "Create ApiCallNode.tsx visual component"
# vs
Task T013-T015: "Update AddStepModal.tsx"
# vs
Task T016-T022: "Update NodeEditModal.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (node definition)
3. Complete Phase 3: User Story 1 (basic API call)
4. **STOP and VALIDATE**: Test adding and configuring API Call node
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Core types ready
2. Add User Story 1 → Test independently → MVP deployed!
3. Add User Story 2 → Test input mapping → Enhanced feature
4. Add User Story 3 → Test error handling → Production-ready
5. Polish → Final cleanup

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- POC phase: Manual testing per constitution (no automated tests)
- Native fetch API used (Node.js 18+ required)
- Orange color theme for API Call nodes (distinct from blue/green/purple)
- Commit after each task or logical group
