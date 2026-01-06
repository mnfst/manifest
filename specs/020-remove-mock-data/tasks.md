# Tasks: Remove Mock Data and Add Default Test Fixtures

**Input**: Design documents from `/specs/020-remove-mock-data/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested (POC phase - testing deferred per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`, `packages/nodes/src/`
- This is a TypeScript monorepo with pnpm workspaces

---

## Phase 1: Setup

**Purpose**: Ensure clean working environment before making changes

- [x] T001 Ensure all dependencies are installed by running `pnpm install` at repo root
- [x] T002 Verify current build passes by running `pnpm build` at repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove shared types that ALL user stories depend on - MUST complete before any story-specific work

**⚠️ CRITICAL**: All user stories depend on type removal being complete first. TypeScript compilation will fail until dependent packages are updated.

- [x] T003 Remove mock data types from packages/shared/src/types/node.ts (remove TableColumn, TableMockData, PostItem, PostListMockData, MockData union type, isTableMockData, isPostListMockData, DEFAULT_TABLE_MOCK_DATA, DEFAULT_POST_LIST_MOCK_DATA)
- [x] T004 Update InterfaceNodeParameters interface in packages/shared/src/types/node.ts (remove mockData field, keep only layoutTemplate)
- [x] T005 Remove mock data exports from packages/shared/src/index.ts (remove MockData, TableMockData, PostListMockData, TableColumn, PostItem, isTableMockData, isPostListMockData, DEFAULT_TABLE_MOCK_DATA, DEFAULT_POST_LIST_MOCK_DATA)
- [x] T006 Update InterfaceNode in packages/nodes/src/nodes/InterfaceNode.ts (remove DEFAULT_TABLE_MOCK_DATA import, remove mockData from defaultParameters, update execute method to not return mock data)

**Checkpoint**: Foundation ready - shared types removed, expect TypeScript errors in backend/frontend until story phases complete

---

## Phase 3: User Story 1 - Create Interface Node Without Mock Data (Priority: P1) 🎯 MVP

**Goal**: Eliminate automatic coupling between interface nodes and mock data. When creating an Interface node, only the node itself is created without any mock data node or mock data in parameters.

**Independent Test**: Create a new interface node in a flow and verify no mock data node appears, no mock data is stored in parameters, and the interface node functions correctly with just layout configuration.

### Implementation for User Story 1

- [x] T007 [US1] Remove mock data imports from packages/frontend/src/components/flow/NodeEditModal.tsx (remove MockData type, DEFAULT_TABLE_MOCK_DATA, DEFAULT_POST_LIST_MOCK_DATA imports)
- [x] T008 [US1] Remove mockData state and getDefaultMockData helper from packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T009 [US1] Remove mockData from form submission in packages/frontend/src/components/flow/NodeEditModal.tsx (update parameters object to only include layoutTemplate for Interface nodes)
- [x] T010 [US1] Remove mock data info text from Interface node form section in packages/frontend/src/components/flow/NodeEditModal.tsx
- [x] T011 [US1] Update packages/frontend/src/components/editor/LayoutRenderer.tsx to handle undefined mockData prop gracefully (show empty/placeholder state)
- [x] T012 [US1] Update packages/frontend/src/components/editor/VisualDisplay.tsx (remove DEFAULT_TABLE_MOCK_DATA import and fallback, pass through undefined)
- [x] T013 [US1] Run type check for frontend package: `cd packages/frontend && pnpm type-check`

**Checkpoint**: Interface nodes can now be created with only layoutTemplate parameter - User Story 1 complete

---

## Phase 4: User Story 2 - Default Test App and Flow on Startup (Priority: P2)

**Goal**: Automatically seed a default "Test App" with a "Test Flow" when the application starts with an empty database, eliminating manual setup for PR testing.

**Independent Test**: Start a fresh instance of the application with empty database and verify a default app and flow exist without any manual intervention.

### Implementation for User Story 2

- [x] T014 [US2] Add OnModuleInit import to packages/backend/src/app/app.service.ts
- [x] T015 [US2] Implement OnModuleInit interface in AppService class in packages/backend/src/app/app.service.ts
- [x] T016 [US2] Inject FlowService into AppService constructor in packages/backend/src/app/app.service.ts
- [x] T017 [US2] Add seedDefaultFixtures method to packages/backend/src/app/app.service.ts (check if apps exist, create "Test App" with default theme, create "Test Flow" with default tool metadata)
- [x] T018 [US2] Add onModuleInit lifecycle method to packages/backend/src/app/app.service.ts (call seedDefaultFixtures)
- [x] T019 [US2] Add console log for seeding success in packages/backend/src/app/app.service.ts (for visibility during PR testing)
- [x] T020 [US2] Run type check for backend package: `cd packages/backend && pnpm type-check`

**Checkpoint**: Application now seeds default fixtures on startup - User Story 2 complete

**Note**: Implementation was done via a separate SeedService and SeedModule instead of modifying AppService directly. This provides better separation of concerns.

---

## Phase 5: User Story 3 - Clean Codebase Without Mock Data Artifacts (Priority: P3)

**Goal**: Remove ALL remaining mock data related code, types, components, and APIs to ensure a clean, maintainable codebase with no dead code.

**Independent Test**: Search codebase for "mockData" or "mock-data" and confirm no functional code references are found. Application builds successfully without TypeScript errors.

### Backend Cleanup

- [x] T021 [P] [US3] Delete packages/backend/src/agent/tools/mock-data-generator.ts file
- [x] T022 [US3] Remove mockDataGeneratorTool export from packages/backend/src/agent/tools/index.ts
- [x] T023 [US3] Remove mock data imports from packages/backend/src/agent/agent.service.ts (MockData type, isTableMockData, mockDataGeneratorTool)
- [x] T024 [US3] Remove mockData field from GenerateAppResult interface in packages/backend/src/agent/agent.service.ts
- [x] T025 [US3] Remove mockData field from GenerateFlowResult interface in packages/backend/src/agent/agent.service.ts
- [x] T026 [US3] Remove ProcessMockDataChatResult interface from packages/backend/src/agent/agent.service.ts
- [x] T027 [US3] Remove processMockDataChat method from packages/backend/src/agent/agent.service.ts
- [x] T028 [US3] Remove mock data generation from generateApp method in packages/backend/src/agent/agent.service.ts (remove Step 4 mock data generation, remove mockData from return object)
- [x] T029 [US3] Remove mock data regeneration from processChat method in packages/backend/src/agent/agent.service.ts (remove mockData update when layout changes)
- [x] T030 [US3] Remove mock data handling from processInterfaceNodeChat method in packages/backend/src/agent/agent.service.ts (remove mockDataUpdate schema, remove mockData regeneration on layout change, remove mockData updates logic)

### Frontend Component Cleanup

- [x] T031 [P] [US3] Delete packages/frontend/src/components/flow/MockDataModal.tsx file
- [x] T032 [P] [US3] Delete packages/frontend/src/components/flow/MockDataNode.tsx file
- [x] T033 [US3] Remove MockDataNode import from packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T034 [US3] Remove mockDataNode from nodeTypes object in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T035 [US3] Remove mock data node creation logic from computedNodes in packages/frontend/src/components/flow/FlowDiagram.tsx (remove mockdata-* node creation for interface nodes)
- [x] T036 [US3] Remove onMockDataEdit prop from FlowDiagramProps interface in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T037 [US3] Remove onMockDataEdit from FlowDiagramInner props and usages in packages/frontend/src/components/flow/FlowDiagram.tsx
- [x] T038 [US3] Remove MockDataModal import and usage from packages/frontend/src/pages/FlowDetail.tsx
- [x] T039 [US3] Remove onMockDataEdit handler and related state from packages/frontend/src/pages/FlowDetail.tsx
- [x] T040 [US3] Remove onMockDataEdit prop from FlowDiagram component usage in packages/frontend/src/pages/FlowDetail.tsx

### Verification

- [x] T041 [US3] Run full type check for all packages: `pnpm type-check`
- [x] T042 [US3] Run full build for all packages: `pnpm build`
- [x] T043 [US3] Search for remaining mock data references: `grep -r "mockData\|MockData\|mock-data" packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "\.d\.ts" | grep -v specs/`

**Checkpoint**: Codebase is clean with no mock data artifacts - User Story 3 complete

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and application startup

- [x] T044 Run full application build: `pnpm build`
- [ ] T045 Start application and verify default fixtures: `.specify/scripts/bash/serve-app.sh`
- [ ] T046 Manually verify: Open app, confirm "Test App" exists
- [ ] T047 Manually verify: Open "Test App", confirm "Test Flow" exists
- [ ] T048 Manually verify: Create new Interface node, confirm no mock data node appears
- [ ] T049 Manually verify: Save Interface node, confirm only layoutTemplate in parameters

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational phase completion - Can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Foundational phase completion - Can run in parallel with US1/US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- T003-T006 MUST complete before any user story work (type removal is blocking)
- Within US3: Backend cleanup before frontend cleanup (fewer type errors during development)
- File deletions (T021, T031, T032) can be done in parallel

### Parallel Opportunities

- T003-T006 in Phase 2 must be sequential (type dependencies)
- T007-T012 in US1 can run mostly in parallel (different files)
- T014-T019 in US2 are sequential (same file modifications)
- T021, T031, T032 in US3 can run in parallel (file deletions in different packages)
- T023-T030 in US3 are sequential (same agent.service.ts file)
- T033-T040 in US3 are sequential (dependencies between FlowDiagram.tsx and FlowDetail.tsx)

---

## Parallel Example: User Story 3 Initial Tasks

```bash
# Launch file deletions together (different packages):
Task: "Delete packages/backend/src/agent/tools/mock-data-generator.ts file"
Task: "Delete packages/frontend/src/components/flow/MockDataModal.tsx file"
Task: "Delete packages/frontend/src/components/flow/MockDataNode.tsx file"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test creating Interface nodes without mock data
5. Deploy/demo if ready - core behavior change is complete

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Interface nodes work without mock data (MVP!)
3. Add User Story 2 → Test independently → Default fixtures on startup
4. Add User Story 3 → Test independently → Clean codebase
5. Each story adds value without breaking previous stories

### Recommended Sequential Order

Since this is a single-developer task:
1. Phase 1: Setup (T001-T002)
2. Phase 2: Foundational (T003-T006)
3. Phase 3: US1 (T007-T013) - Core behavior change
4. Phase 4: US2 (T014-T020) - Developer experience improvement
5. Phase 5: US3 (T021-T043) - Codebase cleanup
6. Phase 6: Polish (T044-T049) - Final verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Type errors are expected after Phase 2 until dependent packages are updated
- No database migrations required - mock data in existing flows will be silently ignored
