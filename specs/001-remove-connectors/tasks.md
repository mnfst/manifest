# Tasks: Remove Connectors Feature

**Input**: Design documents from `/specs/001-remove-connectors/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No tests required for this removal task. Verification is via build/lint/existing test suite.

**Organization**: Tasks are grouped by user story to enable independent verification of each removal phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`
- **Config files**: Repository root (docker-compose.yml, README.md)
- **Specs**: `specs/` directory

---

## Phase 1: Setup (Preparation)

**Purpose**: Verify current state before making changes

- [x] T001 Verify current branch is `001-remove-connectors`
- [x] T002 Run `pnpm build` to confirm baseline build succeeds
- [x] T003 Run `pnpm test` to confirm baseline tests pass

---

## Phase 2: User Story 1 - Clean Codebase (Priority: P1) 🎯 MVP

**Goal**: Remove all connector-related code from backend, frontend, and shared packages

**Independent Test**: `grep -ri "connector" packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules` returns no results

### Backend Removal

- [x] T004 [P] [US1] Delete connector module directory `packages/backend/src/connector/` (contains connector.controller.ts, connector.entity.ts, connector.module.ts, connector.service.ts)
- [x] T005 [P] [US1] Delete encryption utility `packages/backend/src/utils/encryption.ts`
- [x] T006 [US1] Remove ConnectorEntity import and reference from TypeORM entities array in `packages/backend/src/app/app.module.ts`
- [x] T007 [US1] Remove ConnectorModule import and reference from imports array in `packages/backend/src/app/app.module.ts`
- [x] T008 [US1] Remove mysql2 dependency by running `pnpm remove mysql2` in `packages/backend/`

### Frontend Removal

- [x] T009 [P] [US1] Delete connector components directory `packages/frontend/src/components/connector/` (contains ConnectorCard.tsx, ConnectorList.tsx, ConnectorRow.tsx, CreateConnectorModal.tsx, DeleteConnectorDialog.tsx, EditConnectorModal.tsx)
- [x] T010 [P] [US1] Delete ConnectorsPage component `packages/frontend/src/pages/ConnectorsPage.tsx`
- [x] T011 [US1] Remove ConnectorsPage import and `/connectors` route from `packages/frontend/src/App.tsx`
- [x] T012 [US1] Remove ConnectorsIcon component, isConnectorsActive variable, and Connectors SidebarItem from `packages/frontend/src/components/layout/Sidebar.tsx`
- [x] T013 [US1] Remove connector API functions (listConnectors, getConnector, createConnector, updateConnector, deleteConnector, testConnectorConnection, testConnectionConfig) and connector type imports from `packages/frontend/src/lib/api.ts`

**Checkpoint**: Backend and frontend connector code removed. Build may fail until shared types are removed.

---

## Phase 3: User Story 3 - Clean Shared Types (Priority: P1)

**Goal**: Remove connector types from shared package so build succeeds

**Independent Test**: `pnpm build` completes successfully

- [x] T014 [P] [US3] Delete connector types file `packages/shared/src/types/connector.ts`
- [x] T015 [US3] Remove connector type exports (Connector, MySQLConnectorConfig, CreateConnectorRequest, UpdateConnectorRequest, DeleteConnectorResponse) and value exports (ConnectorType, ConnectorCategory, getCategoryFromType) from `packages/shared/src/index.ts`

**Checkpoint**: Build should now succeed. Run `pnpm build` to verify.

---

## Phase 4: User Story 2 - Clean Documentation (Priority: P1)

**Goal**: Remove all connector references from documentation and configuration

**Independent Test**: `grep -i "connector" README.md docker-compose.yml packages/backend/.env.example` returns no results

### Configuration Files

- [x] T016 [P] [US2] Remove CONNECTOR_ENCRYPTION_KEY and its comment from `packages/backend/.env.example`
- [x] T017 [P] [US2] Remove CONNECTOR_ENCRYPTION_KEY environment variable and its comment from `docker-compose.yml`

### Documentation

- [x] T018 [US2] Update `README.md` to remove:
  - "External Connectors" from features list (around line 11)
  - `connector/` from directory structure (around line 40)
  - `CONNECTOR_ENCRYPTION_KEY` from setup instructions (around line 90)
  - `CONNECTOR_ENCRYPTION_KEY` from Docker run example (around line 138)
  - `CONNECTOR_ENCRYPTION_KEY` row from environment variables table (around line 169)

**Checkpoint**: Documentation accurately reflects codebase. No stale connector references.

---

## Phase 5: User Story 4 - Remove Feature Specs (Priority: P2)

**Goal**: Remove connector specification and clean up references in other specs

**Independent Test**: `ls specs/011-connectors` returns "No such file or directory"

- [x] T019 [P] [US4] Delete connector spec directory `specs/011-connectors/` (contains spec.md, tasks.md)
- [x] T020 [US4] Remove "User Story 2 - Visual Schema Compatibility in Connectors" section from `specs/001-io-schemas/spec.md`

**Checkpoint**: Specs directory only contains active/planned features.

---

## Phase 6: Polish & Verification

**Purpose**: Final validation that all removals are complete and nothing is broken

- [x] T021 Run `pnpm build` to verify build succeeds
- [x] T022 Run `pnpm test` to verify all tests pass
- [x] T023 Run `pnpm lint` to verify no lint errors
- [x] T024 Search for remaining connector references: `grep -ri "connector" packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules` (should return nothing)
- [x] T025 Search for connector references in markdown: `grep -ri "connector" *.md README.md CLAUDE.md docker-compose.yml` (should only match this spec and removal spec files)
- [ ] T026 Start application with `pnpm dev` and verify:
  - Sidebar has no "Connectors" menu item
  - Navigating to `/connectors` redirects to home or shows 404

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verify baseline
- **US1 Codebase (Phase 2)**: Depends on Setup - removes source code
- **US3 Shared Types (Phase 3)**: Should run after US1 to avoid build errors during removal
- **US2 Documentation (Phase 4)**: Can run in parallel with Phase 3 (different files)
- **US4 Specs (Phase 5)**: Can run in parallel with Phases 3-4 (different files)
- **Polish (Phase 6)**: Depends on all previous phases - final verification

### User Story Dependencies

- **US1 (Codebase)**: Start first - largest scope
- **US3 (Shared Types)**: Run after US1 - enables build
- **US2 (Documentation)**: Independent - can run after US1
- **US4 (Specs)**: Independent - can run after US1

### Parallel Opportunities

Within Phase 2 (US1):
- T004, T005 can run in parallel (different directories)
- T009, T010 can run in parallel (different directories)

Within Phase 3:
- T014 can run immediately

Within Phase 4:
- T016, T017 can run in parallel (different files)

Within Phase 5:
- T019, T020 can run in parallel (different files)

---

## Parallel Example: Maximum Parallelization

```bash
# After Phase 1 baseline verification:

# Parallel batch 1 - Delete directories:
Task T004: "Delete packages/backend/src/connector/"
Task T005: "Delete packages/backend/src/utils/encryption.ts"
Task T009: "Delete packages/frontend/src/components/connector/"
Task T010: "Delete packages/frontend/src/pages/ConnectorsPage.tsx"
Task T014: "Delete packages/shared/src/types/connector.ts"
Task T019: "Delete specs/011-connectors/"

# Sequential - Update files with import/export changes:
Task T006, T007: "Update app.module.ts"
Task T008: "Remove mysql2 dependency"
Task T011: "Update App.tsx"
Task T012: "Update Sidebar.tsx"
Task T013: "Update api.ts"
Task T015: "Update shared/index.ts"

# Parallel batch 2 - Config and docs:
Task T016: "Update .env.example"
Task T017: "Update docker-compose.yml"
Task T018: "Update README.md"
Task T020: "Update io-schemas spec"
```

---

## Implementation Strategy

### Recommended Sequence (Solo Developer)

1. **Phase 1**: Verify baseline (T001-T003)
2. **Phase 2**: Remove backend code first (T004-T008)
3. **Phase 2 cont.**: Remove frontend code (T009-T013)
4. **Phase 3**: Remove shared types to fix build (T014-T015)
5. **Verify**: Run `pnpm build` - should succeed
6. **Phase 4**: Update docs and config (T016-T018)
7. **Phase 5**: Clean specs (T019-T020)
8. **Phase 6**: Final verification (T021-T026)

### MVP Scope

For quick verification that removal is working:
1. Complete Phases 1-3 (Setup + Codebase + Shared Types)
2. Run `pnpm build` to verify
3. Phases 4-5 can follow as cleanup

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Total deletion: 13 files + 3 directories
- Total modification: 9 files
- This is a destructive operation - git makes it reversible
- The `connectors` table in SQLite will be orphaned (can drop manually if needed)
