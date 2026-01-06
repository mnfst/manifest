# Tasks: Docker Deployment with GitHub Actions

**Input**: Design documents from `/specs/017-docker-github-actions/`
**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: No automated tests required (POC phase)

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create Docker configuration files

- [ ] T001 [P] Create `.dockerignore` file at repository root
- [ ] T002 Create `Dockerfile` with multi-stage build at repository root
- [ ] T003 [P] Create `.github/workflows/` directory structure

---

## Phase 2: User Story 1 - Local Docker Development (Priority: P1)

**Goal**: Enable developers to build and run the application locally via Docker Compose

**Independent Test**: Run `docker compose up --build` and access the application

### Implementation for User Story 1

- [ ] T004 [US1] Create `docker-compose.yml` at repository root
- [ ] T005 [US1] Verify Dockerfile builds successfully with memory constraints
- [ ] T006 [US1] Test that frontend static files are served correctly
- [ ] T007 [US1] Test that backend API responds correctly
- [ ] T008 [US1] Verify SQLite database persistence with volume mount

**Checkpoint**: Local Docker development fully functional

---

## Phase 3: User Story 2 - Automated DockerHub Push (Priority: P2)

**Goal**: Automatically build and push Docker images to DockerHub on main branch pushes

**Independent Test**: Push to main and verify image appears on DockerHub

### Implementation for User Story 2

- [ ] T009 [US2] Create GitHub Actions workflow at `.github/workflows/docker-publish.yml`
- [ ] T010 [US2] Configure workflow to trigger on push to main branch
- [ ] T011 [US2] Add DockerHub authentication via repository secrets
- [ ] T012 [US2] Configure image tagging (latest + commit SHA)
- [ ] T013 [US2] Add build caching for faster CI builds

**Checkpoint**: CI/CD pipeline ready for DockerHub deployment

---

## Phase 4: User Story 3 - Memory-Efficient Builds (Priority: P1)

**Goal**: Ensure builds complete within GitHub Actions resource constraints

**Independent Test**: Build completes with `--memory=2g` limit

### Implementation for User Story 3 (Embedded in Dockerfile)

- [ ] T014 [US3] Configure npm install with `--maxsockets=2` for reduced memory
- [ ] T015 [US3] Add `NODE_OPTIONS=--max-old-space-size=1536` for TypeScript builds
- [ ] T016 [US3] Use sequential builds: shared → backend → frontend
- [ ] T017 [US3] Verify final image size is under 500MB
- [ ] T018 [US3] Document memory optimization strategies in Dockerfile comments

**Checkpoint**: Memory-efficient build verified

---

## Phase 5: Polish & Documentation

**Purpose**: Final cleanup and documentation

- [ ] T019 Update README with Docker usage instructions (if README exists)
- [ ] T020 Verify all environment variables are documented
- [ ] T021 Final end-to-end test of Docker workflow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **User Story 1 (Phase 2)**: Depends on Dockerfile (T002)
- **User Story 2 (Phase 3)**: Depends on working Dockerfile (Phase 2)
- **User Story 3 (Phase 4)**: Implemented during T002, verified in Phase 2

### Execution Strategy

Since User Story 1 and 3 are both P1 priority and interrelated (memory efficiency is part of the Dockerfile), they will be implemented together:

1. Create .dockerignore (T001)
2. Create Dockerfile with memory optimizations (T002, T014-T018)
3. Create docker-compose.yml (T004)
4. Verify local Docker build (T005-T008)
5. Create GitHub Actions workflow (T009-T013)
6. Polish (T019-T021)

### Parallel Opportunities

- T001 and T003 can run in parallel
- T006 and T007 can run in parallel (different test scenarios)
- T011, T012, T013 are configuration in same file but listed separately for clarity

---

## Notes

- All tasks create new files (no existing code modifications)
- Memory optimization is critical - verify each build stage
- GitHub Actions secrets must be configured in repository settings:
  - `DOCKERHUB_USERNAME`
  - `DOCKERHUB_TOKEN`
