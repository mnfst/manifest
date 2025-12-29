# Feature Specification: NPM to pnpm Migration

**Feature Branch**: `017-npm-to-pnpm`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "As this monorepo is getting bigger, i want to switch package manager from NPM to pnpm. Please adapt all the files, including the documentations/guides ones."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Installs Dependencies (Priority: P1)

A developer clones the repository and runs the package manager install command to set up their local development environment with all dependencies.

**Why this priority**: This is the foundational workflow - without working dependency installation, no development can occur. Every developer interaction with the codebase starts here.

**Independent Test**: Can be fully tested by cloning the repository, running `pnpm install`, and verifying all packages are installed correctly without errors.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** a developer runs `pnpm install`, **Then** all dependencies for root and all workspace packages (backend, frontend, shared) are installed successfully
2. **Given** a fresh clone of the repository, **When** a developer runs `pnpm install`, **Then** a `pnpm-lock.yaml` file exists and no `package-lock.json` file is present
3. **Given** an existing clone with outdated dependencies, **When** a developer runs `pnpm install`, **Then** dependencies are updated according to the lockfile

---

### User Story 2 - Developer Runs Development Scripts (Priority: P1)

A developer runs common development scripts (dev server, build, lint, type-check, test) using pnpm commands.

**Why this priority**: Running scripts is essential for daily development workflow. Developers need to start the dev server, run tests, and validate code quality.

**Independent Test**: Can be fully tested by running each script command and verifying it executes the expected operation.

**Acceptance Scenarios**:

1. **Given** dependencies are installed, **When** a developer runs `pnpm dev`, **Then** the development servers for backend and frontend start successfully
2. **Given** dependencies are installed, **When** a developer runs `pnpm build`, **Then** the project builds successfully for all packages
3. **Given** dependencies are installed, **When** a developer runs `pnpm lint`, **Then** linting runs across all packages
4. **Given** dependencies are installed, **When** a developer runs `pnpm test`, **Then** tests execute for all packages
5. **Given** dependencies are installed, **When** a developer runs `pnpm type-check`, **Then** TypeScript type checking runs successfully

---

### User Story 3 - Developer Reads Updated Documentation (Priority: P2)

A developer reads the README and other documentation files to understand how to set up and work with the project using pnpm.

**Why this priority**: Documentation guides new and existing developers. Without updated docs, developers may use incorrect commands or face confusion.

**Independent Test**: Can be verified by reviewing all documentation files and confirming all npm references are replaced with pnpm equivalents.

**Acceptance Scenarios**:

1. **Given** the README.md file, **When** a developer reads the prerequisites section, **Then** pnpm is listed as the required package manager (not npm)
2. **Given** the README.md file, **When** a developer reads the quick start section, **Then** all commands use pnpm syntax
3. **Given** any quickstart.md file in specs directories, **When** a developer reads it, **Then** all package manager commands use pnpm syntax

---

### User Story 4 - Automation Scripts Work with pnpm (Priority: P2)

Shell scripts and automation tools that invoke package manager commands work correctly with pnpm.

**Why this priority**: Automated scripts are used for development workflows and CI processes. They must work correctly to maintain development efficiency.

**Independent Test**: Can be verified by running each affected script and confirming it executes successfully with pnpm.

**Acceptance Scenarios**:

1. **Given** any shell script in .specify/scripts/bash/ that references npm, **When** executed, **Then** it uses pnpm commands instead
2. **Given** the update-agent-context.sh script, **When** executed, **Then** any generated content (like CLAUDE.md) references pnpm commands

---

### Edge Cases

- What happens when a developer accidentally runs `npm install` instead of `pnpm install`?
  - The project should still work, but developers should be guided to use pnpm through documentation
- How does the system handle if pnpm is not installed on a developer's machine?
  - Documentation should include pnpm installation instructions
- What happens with workspace protocol references between packages?
  - pnpm workspace protocol (`workspace:*`) should be used for inter-package dependencies

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The root package.json MUST specify pnpm as the package manager in the `packageManager` field
- **FR-002**: The project MUST use `pnpm-lock.yaml` as the lockfile (replacing `package-lock.json`)
- **FR-003**: All workspace packages MUST be installable via a single `pnpm install` command from the root
- **FR-004**: The README.md MUST document pnpm as the required package manager with installation instructions
- **FR-005**: The README.md MUST update all command examples to use pnpm syntax
- **FR-006**: All quickstart.md files in specs directories (17 files) MUST use pnpm command syntax
- **FR-007**: Shell scripts in .specify/scripts/bash/ that reference npm commands MUST be updated to use pnpm commands where applicable
- **FR-008**: The CLAUDE.md agent guidelines MUST reference pnpm commands where applicable
- **FR-009**: The project MUST include a `pnpm-workspace.yaml` file defining the workspace structure
- **FR-010**: Inter-package dependencies MUST use the pnpm workspace protocol where applicable

### Key Entities

- **Package Manager Configuration**: The root-level settings that define pnpm as the project's package manager
- **Workspace Definition**: The configuration that defines which directories are part of the monorepo workspace
- **Lockfile**: The pnpm-lock.yaml file that ensures deterministic dependency installation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can install all dependencies with a single `pnpm install` command in under 60 seconds on a standard development machine
- **SC-002**: All existing npm scripts (dev, build, lint, test, type-check) work identically when invoked via pnpm
- **SC-003**: 100% of documentation files contain zero references to npm commands (replaced with pnpm equivalents)
- **SC-004**: All shell scripts in the repository execute successfully using pnpm commands
- **SC-005**: The project builds and all tests pass after the migration
- **SC-006**: No `package-lock.json` file exists in the repository after migration

## Assumptions

- pnpm version 9.x or later will be used (current stable version)
- Developers will install pnpm globally or use corepack to manage the package manager
- The existing workspace structure (packages/backend, packages/frontend, packages/shared as defined by `packages/*` in package.json) will be preserved
- All existing npm scripts in package.json files are compatible with pnpm without modification
- CI/CD pipelines (if any) will be updated separately or are not in scope for this specification
