# Tasks: NPM to pnpm Migration

**Input**: Design documents from `/specs/017-npm-to-pnpm/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: Not requested - this is a configuration/documentation migration with manual verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

This is a monorepo migration affecting:
- Root configuration files (`package.json`, `pnpm-workspace.yaml`)
- Package configuration files (`packages/*/package.json`)
- Documentation (`README.md`, `CLAUDE.md`, `specs/*/quickstart.md`)
- Shell scripts (`.specify/scripts/bash/*.sh`)

---

## Phase 1: Setup (Configuration Files)

**Purpose**: Create pnpm workspace configuration and update package.json files

- [x] T001 Create pnpm-workspace.yaml in repository root with packages/* workspace
- [x] T002 Update root package.json: change packageManager to pnpm@9.15.4 and remove workspaces field
- [x] T003 [P] Update packages/backend/package.json: change @chatgpt-app-builder/shared dependency to workspace:*
- [x] T004 [P] Update packages/frontend/package.json: change @chatgpt-app-builder/shared dependency to workspace:*

---

## Phase 2: Foundational (Lockfile Migration)

**Purpose**: Convert npm lockfile to pnpm lockfile and verify installation

**CRITICAL**: This phase must complete successfully before any verification can occur.

- [x] T005 Run pnpm import to convert package-lock.json to pnpm-lock.yaml
- [x] T006 Remove node_modules directories (root and all packages) and package-lock.json
- [x] T007 Run pnpm install and verify all dependencies install successfully

**Checkpoint**: pnpm-lock.yaml exists, package-lock.json deleted, dependencies installed

---

## Phase 3: User Story 1 - Developer Installs Dependencies (Priority: P1)

**Goal**: Developers can clone the repo and run `pnpm install` to set up their environment

**Independent Test**: Clone repository, run `pnpm install`, verify all packages install without errors

### Verification for User Story 1

- [x] T008 [US1] Verify pnpm install completes without errors for all workspace packages
- [x] T009 [US1] Verify pnpm-lock.yaml exists and package-lock.json is deleted
- [x] T010 [US1] Verify all inter-package dependencies (shared) resolve correctly

**Checkpoint**: Fresh clone + `pnpm install` works correctly

---

## Phase 4: User Story 2 - Developer Runs Development Scripts (Priority: P1)

**Goal**: All development scripts work identically when invoked via pnpm

**Independent Test**: Run each script and verify it executes the expected operation

### Verification for User Story 2

- [x] T011 [US2] Verify pnpm dev starts both backend and frontend development servers
- [x] T012 [US2] Verify pnpm build completes successfully for all packages
- [x] T013 [US2] Verify pnpm lint runs linting across all packages
- [x] T014 [US2] Verify pnpm type-check runs TypeScript type checking successfully
- [x] T015 [US2] Verify pnpm test executes tests for all packages (if tests exist)

**Checkpoint**: All scripts (dev, build, lint, type-check, test) work with pnpm

---

## Phase 5: User Story 3 - Developer Reads Updated Documentation (Priority: P2)

**Goal**: All documentation references pnpm instead of npm

**Independent Test**: Review all documentation files and confirm all npm references are replaced with pnpm

### Implementation for User Story 3

- [x] T016 [US3] Update README.md: replace all npm commands with pnpm equivalents
- [x] T017 [US3] Update CLAUDE.md: replace npm command references with pnpm
- [x] T018 [P] [US3] Update specs/001-tool-params/quickstart.md: replace npm with pnpm commands
- [x] T019 [P] [US3] Update specs/001-flow-creation/quickstart.md: replace npm with pnpm commands
- [x] T020 [P] [US3] Update specs/001-flow-return-value/quickstart.md: replace npm with pnpm commands
- [x] T021 [P] [US3] Update specs/001-chatgpt-app-builder/quickstart.md: replace npm with pnpm commands
- [x] T022 [P] [US3] Update specs/002-mcp-server-flow/quickstart.md: replace npm with pnpm commands
- [x] T023 [P] [US3] Update specs/003-app-list-header/quickstart.md: replace npm with pnpm commands
- [x] T024 [P] [US3] Update specs/004-4-mcp-flow-publication/quickstart.md: replace npm with pnpm commands
- [x] T025 [P] [US3] Update specs/005-app-flow-management/quickstart.md: replace npm with pnpm commands
- [x] T026 [P] [US3] Update specs/006-manifest-ui-blocks/quickstart.md: replace npm with pnpm commands
- [x] T027 [P] [US3] Update specs/007-sidebar/quickstart.md: replace npm with pnpm commands
- [x] T028 [P] [US3] Update specs/008-chat-style-renderer/quickstart.md: replace npm with pnpm commands
- [x] T029 [P] [US3] Update specs/009-manifest-styles/quickstart.md: replace npm with pnpm commands
- [x] T030 [P] [US3] Update specs/012-app-detail-improvements/quickstart.md: replace npm with pnpm commands
- [x] T031 [P] [US3] Update specs/013-flow-preview/quickstart.md: replace npm with pnpm commands
- [x] T032 [P] [US3] Update specs/014-call-flow-action/quickstart.md: replace npm with pnpm commands
- [x] T033 [P] [US3] Update specs/015-ui-actions/quickstart.md: replace npm with pnpm commands
- [x] T034 [P] [US3] Update specs/016-ui-consistency-fixes/quickstart.md: replace npm with pnpm commands

**Note**: specs/017-npm-to-pnpm/quickstart.md already uses pnpm commands (created for this feature)

**Checkpoint**: All documentation files use pnpm command syntax

---

## Phase 6: User Story 4 - Automation Scripts Work with pnpm (Priority: P2)

**Goal**: Shell scripts that invoke package manager commands work with pnpm

**Independent Test**: Run each affected script and confirm it executes successfully

### Implementation for User Story 4

- [x] T035 [US4] Update .specify/scripts/bash/serve-app.sh: replace npm run with pnpm
- [x] T036 [US4] Update .specify/scripts/bash/update-agent-context.sh: replace npm references with pnpm

### Verification for User Story 4

- [x] T037 [US4] Verify serve-app.sh executes correctly with pnpm commands
- [x] T038 [US4] Verify update-agent-context.sh generates correct pnpm references

**Checkpoint**: All shell scripts work with pnpm

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T039 Run full verification: pnpm install from fresh clone
- [x] T040 Run full verification: pnpm dev, pnpm build, pnpm lint, pnpm type-check
- [x] T041 Verify no package-lock.json exists in repository
- [x] T042 Verify no npm command references remain in documentation (grep check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all verification
- **User Story 1 (Phase 3)**: Depends on Phase 2 (lockfile must exist, install must work)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (dependencies must be installed)
- **User Story 3 (Phase 5)**: No dependencies on other stories - documentation only
- **User Story 4 (Phase 6)**: No dependencies on other stories - scripts only
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only - core migration
- **User Story 2 (P1)**: Depends on US1 (dependencies must install first)
- **User Story 3 (P2)**: Independent - can run in parallel with US1/US2
- **User Story 4 (P2)**: Independent - can run in parallel with US1/US2/US3

### Parallel Opportunities

**Phase 1 (Setup):**
```
T001 → T002 (sequential: workspace file before package.json update)
T003 + T004 (parallel: different package.json files)
```

**Phase 5 (US3 - Documentation):**
```
T016 → T017 (sequential: main docs first)
T018 through T034 (parallel: all quickstart.md files are independent)
```

**Phase 6 (US4 - Scripts):**
```
T035 + T036 (parallel: different script files)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (configuration files)
2. Complete Phase 2: Foundational (lockfile migration)
3. Complete Phase 3: User Story 1 (verify install works)
4. Complete Phase 4: User Story 2 (verify scripts work)
5. **STOP and VALIDATE**: Core migration complete and functional

### Full Migration

1. Complete MVP (Phases 1-4)
2. Complete Phase 5: User Story 3 (documentation updates)
3. Complete Phase 6: User Story 4 (script updates)
4. Complete Phase 7: Polish (final verification)

---

## Command Reference

| Before (npm) | After (pnpm) |
|--------------|--------------|
| `npm install` | `pnpm install` |
| `npm run dev` | `pnpm dev` |
| `npm run build` | `pnpm build` |
| `npm run lint` | `pnpm lint` |
| `npm run type-check` | `pnpm type-check` |
| `npm test` | `pnpm test` |
| `npx <cmd>` | `pnpm exec <cmd>` |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This migration has no code changes - only configuration and documentation
- Verify scripts work after documentation updates (scripts may be referenced in docs)
- Commit after each phase or logical group
