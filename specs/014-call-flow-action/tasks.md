# Tasks: Call Flow End Action

**Input**: Design documents from `/specs/014-call-flow-action/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/call-flow-api.yaml, research.md

**Tests**: Not required (POC phase per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `packages/backend/src/`
- **Frontend**: `packages/frontend/src/`
- **Shared**: `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared type definitions that all packages depend on

- [x] T001 [P] Create CallFlow type interfaces in packages/shared/src/types/call-flow.ts
- [x] T002 [P] Add callFlows field to Flow interface in packages/shared/src/types/flow.ts
- [x] T003 Export CallFlow types from packages/shared/src/types/index.ts

---

## Phase 2: Foundational (Backend Module)

**Purpose**: Backend entity, service, and controller that MUST be complete before frontend work

**⚠️ CRITICAL**: Frontend cannot function until backend API is ready

- [x] T004 Create CallFlowEntity with TypeORM decorators in packages/backend/src/call-flow/call-flow.entity.ts
- [x] T005 Add callFlows OneToMany relation to FlowEntity in packages/backend/src/flow/flow.entity.ts
- [x] T006 Create CallFlowModule with TypeORM repository in packages/backend/src/call-flow/call-flow.module.ts
- [x] T007 Implement CallFlowService with CRUD operations and validation in packages/backend/src/call-flow/call-flow.service.ts
- [x] T008 Implement CallFlowController with REST endpoints in packages/backend/src/call-flow/call-flow.controller.ts
- [x] T009 Register CallFlowModule and CallFlowEntity in packages/backend/src/app/app.module.ts
- [x] T010 Add mutual exclusivity check for callFlows in packages/backend/src/return-value/return-value.service.ts
- [x] T011 Add mutual exclusivity check for callFlows in packages/backend/src/view/view.service.ts

**Checkpoint**: Backend API ready - frontend implementation can begin

---

## Phase 3: User Story 1 - Add Call Flow Action to Flow (Priority: P1) 🎯 MVP

**Goal**: Users can add Call Flow actions to flows and select target flows from the same app

**Independent Test**: Create a flow in an app with multiple flows, add a Call Flow action, select a target flow, verify it saves and displays correctly in the flow diagram

### Implementation for User Story 1

- [x] T012 [P] [US1] Add CallFlow API methods (list, create, get, update, delete, reorder) in packages/frontend/src/lib/api.ts
- [x] T013 [P] [US1] Create CallFlowNode component with purple theme and left-only handle in packages/frontend/src/components/flow/CallFlowNode.tsx
- [x] T014 [P] [US1] Create CallFlowEditor modal for target flow selection in packages/frontend/src/components/flow/CallFlowEditor.tsx
- [x] T015 [US1] Register callFlowNode type and add callFlow node rendering logic in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T016 [US1] Add CallFlow state management and CRUD handlers in packages/frontend/src/pages/FlowDetail.tsx
- [x] T017 [US1] Add "Call Flow" option to StepTypeDrawer in packages/frontend/src/components/flow/StepTypeDrawer.tsx

**Checkpoint**: User Story 1 complete - users can add and configure Call Flow actions

---

## Phase 4: User Story 2 - Call Flow Execution in ChatGPT (Priority: P2)

**Goal**: When a flow with Call Flow actions executes, it triggers target flows via callTool API

**Independent Test**: Execute a flow with a Call Flow action in preview mode and verify window.openai.callTool is invoked with correct toolName

### Implementation for User Story 2

- [x] T018 [US2] Add callFlows branch to executeTool method in packages/backend/src/mcp/mcp.tool.ts
- [x] T019 [US2] Implement executeCallFlowFlow method that generates HTML with callTool invocation in packages/backend/src/mcp/mcp.tool.ts
- [x] T020 [US2] Ensure callFlows are loaded with targetFlow relation when fetching flow for execution in packages/backend/src/mcp/mcp.tool.ts

**Checkpoint**: User Story 2 complete - Call Flow actions trigger target flows at runtime

---

## Phase 5: User Story 3 - Visual End Action Distinction (Priority: P3)

**Goal**: End actions (Call Flow, Return Value) visually indicate they are terminal points by having no right-side handler

**Independent Test**: Compare a View node (should have right handler) with a Call Flow node (no right handler) and a Return Value node (no right handler)

### Implementation for User Story 3

- [x] T021 [US3] Remove right-side Handle from ReturnValueNode in packages/frontend/src/components/flow/ReturnValueNode.tsx
- [x] T022 [US3] Verify CallFlowNode has no right-side Handle (already done in T013) in packages/frontend/src/components/flow/CallFlowNode.tsx
- [x] T023 [US3] Update edge connection logic to not expect source from end action nodes in packages/frontend/src/components/flow/FlowDiagram.tsx

**Checkpoint**: User Story 3 complete - end actions visually distinct from intermediate actions

---

## Phase 6: Polish & Edge Cases

**Purpose**: Handle edge cases and ensure robustness

- [x] T024 [P] Add error state display when targetFlow is null/deleted in CallFlowNode in packages/frontend/src/components/flow/CallFlowNode.tsx
- [x] T025 [P] Add empty state message when no other flows available in CallFlowEditor in packages/frontend/src/components/flow/CallFlowEditor.tsx
- [x] T026 Ensure current flow is excluded from target selection list in CallFlowEditor in packages/frontend/src/components/flow/CallFlowEditor.tsx
- [x] T027 Run serve-app.sh and manually test all acceptance scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 2 (can run in parallel with US1)
- **Phase 5 (US3)**: Depends on T013 from US1 (CallFlowNode must exist)
- **Phase 6 (Polish)**: Depends on all user stories

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (Backend) ──────────────────┐
    ↓                                              ↓
Phase 3: US1 (Add Call Flow)     Phase 4: US2 (Execution)
    ↓                                              ↓
Phase 5: US3 (Visual Distinction) ←────────────────┘
    ↓
Phase 6: Polish
```

### Within Each Phase

- Tasks marked [P] can run in parallel
- Sequential tasks depend on previous task completion

### Parallel Opportunities

**Phase 1** (all parallel):
- T001, T002 can run simultaneously

**Phase 2** (sequential due to dependencies):
- T004 → T005 → T006 → T007 → T008 → T009
- T010, T011 can run after T009 in parallel

**Phase 3** (partial parallel):
- T012, T013, T014 can run in parallel
- T015, T016, T017 depend on T013

**Phase 4** (sequential):
- T018 → T019 → T020

**Phase 5** (partial parallel):
- T021, T022 can run in parallel
- T023 depends on T021

**Phase 6** (partial parallel):
- T024, T025 can run in parallel
- T026 depends on T025

---

## Parallel Example: Phase 1 + Phase 3

```bash
# Phase 1 - Launch in parallel:
Task: "Create CallFlow type interfaces in packages/shared/src/types/call-flow.ts"
Task: "Add callFlows field to Flow interface in packages/shared/src/types/flow.ts"

# Phase 3 - After Phase 2, launch in parallel:
Task: "Add CallFlow API methods in packages/frontend/src/lib/api.ts"
Task: "Create CallFlowNode component in packages/frontend/src/components/flow/CallFlowNode.tsx"
Task: "Create CallFlowEditor modal in packages/frontend/src/components/flow/CallFlowEditor.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (shared types)
2. Complete Phase 2: Foundational (backend API)
3. Complete Phase 3: User Story 1 (add/configure Call Flow)
4. **STOP and VALIDATE**: Test adding Call Flow actions manually
5. Deploy/demo if ready - users can configure flows with Call Flow actions

### Incremental Delivery

1. Setup + Foundational → Backend API ready
2. Add User Story 1 → Can add Call Flow actions (MVP!)
3. Add User Story 2 → Call Flow actions execute at runtime
4. Add User Story 3 → Visual polish for end actions
5. Each story adds value without breaking previous stories

### File Change Summary

**New Files (7)**:
- `packages/shared/src/types/call-flow.ts`
- `packages/backend/src/call-flow/call-flow.entity.ts`
- `packages/backend/src/call-flow/call-flow.module.ts`
- `packages/backend/src/call-flow/call-flow.service.ts`
- `packages/backend/src/call-flow/call-flow.controller.ts`
- `packages/frontend/src/components/flow/CallFlowNode.tsx`
- `packages/frontend/src/components/flow/CallFlowEditor.tsx`

**Modified Files (10)**:
- `packages/shared/src/types/flow.ts`
- `packages/shared/src/types/index.ts`
- `packages/backend/src/flow/flow.entity.ts`
- `packages/backend/src/app/app.module.ts`
- `packages/backend/src/return-value/return-value.service.ts`
- `packages/backend/src/view/view.service.ts`
- `packages/backend/src/mcp/mcp.tool.ts`
- `packages/frontend/src/lib/api.ts`
- `packages/frontend/src/components/flow/FlowDiagram.tsx`
- `packages/frontend/src/components/flow/ReturnValueNode.tsx`
- `packages/frontend/src/components/flow/AddStepNode.tsx`
- `packages/frontend/src/pages/FlowDetail.tsx`

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Testing deferred per POC constitution - manual testing via serve-app.sh
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
