# Feature Specification: Remove Connectors Feature

**Feature Branch**: `001-remove-connectors`
**Created**: 2026-01-10
**Status**: Draft
**Input**: User description: "Remove everything about connectors. This feature will not be implemented soon. Make sure to remove everything related to it: frontend, backend, readmes, claude.md, etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Codebase (Priority: P1)

As a developer, I want the connectors feature completely removed from the codebase so that the project remains lean and maintainable without unused code.

**Why this priority**: Removing unused code is essential for maintainability. Dead code creates confusion, increases cognitive load, and can lead to accidental dependencies.

**Independent Test**: Can be fully tested by verifying no connector-related code, routes, UI elements, or documentation exists in the codebase.

**Acceptance Scenarios**:

1. **Given** the codebase contains connector-related code, **When** the removal is complete, **Then** no files with "connector" in the name exist in the codebase
2. **Given** the frontend has a Connectors page and sidebar link, **When** the removal is complete, **Then** the route `/connectors` returns a 404 and the sidebar has no connector menu item
3. **Given** the backend has connector API endpoints, **When** the removal is complete, **Then** all `/api/connectors` endpoints return 404

---

### User Story 2 - Clean Documentation (Priority: P1)

As a developer, I want all connector references removed from documentation so that the README, CLAUDE.md, and other docs accurately reflect the current codebase.

**Why this priority**: Documentation should accurately reflect the codebase. Stale documentation about non-existent features causes confusion.

**Independent Test**: Can be tested by searching all markdown files for "connector" and finding zero matches (except this spec).

**Acceptance Scenarios**:

1. **Given** README.md references connector encryption keys and directories, **When** the removal is complete, **Then** README.md contains no connector references
2. **Given** .env.example contains CONNECTOR_ENCRYPTION_KEY, **When** the removal is complete, **Then** .env.example contains no connector-related environment variables
3. **Given** docker-compose.yml includes connector environment variables, **When** the removal is complete, **Then** docker-compose.yml contains no connector references

---

### User Story 3 - Clean Shared Types (Priority: P1)

As a developer, I want all connector types and exports removed from the shared package so that the type system doesn't reference non-existent entities.

**Why this priority**: TypeScript types for non-existent features cause build errors and confusion. The shared package must only export valid types.

**Independent Test**: Can be tested by checking shared package exports contain no connector types and the project builds successfully.

**Acceptance Scenarios**:

1. **Given** shared/src/types/connector.ts exists, **When** the removal is complete, **Then** the file no longer exists
2. **Given** shared/src/index.ts exports connector types, **When** the removal is complete, **Then** index.ts has no connector exports
3. **Given** the project depends on connector types, **When** the removal is complete, **Then** `pnpm build` succeeds without errors

---

### User Story 4 - Remove Feature Specs (Priority: P2)

As a developer, I want the connectors feature specification removed so that the specs directory only contains active or planned features.

**Why this priority**: Spec files for removed features should be deleted to avoid confusion about what features are planned vs removed.

**Independent Test**: Can be tested by verifying specs/011-connectors directory no longer exists.

**Acceptance Scenarios**:

1. **Given** specs/011-connectors/ directory exists with spec.md and tasks.md, **When** the removal is complete, **Then** the specs/011-connectors/ directory no longer exists

---

### Edge Cases

- What happens if other features reference connectors? They must be updated to remove those references.
- What happens to the encryption utility used by connectors? If only used by connectors, remove it; if used elsewhere, keep it.
- What happens to database migrations? Any connector-related tables or migrations should be removed or noted for cleanup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove the entire `packages/backend/src/connector/` directory including connector.controller.ts, connector.entity.ts, connector.module.ts, and connector.service.ts
- **FR-002**: System MUST remove ConnectorModule from the backend app module imports
- **FR-003**: System MUST remove the `packages/backend/src/utils/encryption.ts` file (only used for connectors)
- **FR-004**: System MUST remove all files in `packages/frontend/src/components/connector/` directory
- **FR-005**: System MUST remove `packages/frontend/src/pages/ConnectorsPage.tsx`
- **FR-006**: System MUST remove the `/connectors` route from App.tsx
- **FR-007**: System MUST remove the Connectors sidebar menu item from Sidebar.tsx
- **FR-008**: System MUST remove all connector-related API functions from `packages/frontend/src/lib/api.ts`
- **FR-009**: System MUST remove `packages/shared/src/types/connector.ts`
- **FR-010**: System MUST remove connector type exports from `packages/shared/src/index.ts`
- **FR-011**: System MUST remove the `specs/011-connectors/` directory
- **FR-012**: System MUST remove CONNECTOR_ENCRYPTION_KEY from `.env.example` and `docker-compose.yml`
- **FR-013**: System MUST update README.md to remove all connector references (directory listing, environment variables)
- **FR-014**: System MUST remove any connector references from other specs that mention connectors (001-io-schemas, 018-node-connection)
- **FR-015**: System MUST ensure the project builds successfully after all removals (`pnpm build`)
- **FR-016**: System MUST ensure all tests pass after all removals (`pnpm test`)

### Key Entities

- **Connector**: Entity being removed - represented MySQL database connection configurations with encrypted credentials. All database tables, types, and references must be deleted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero files in the codebase contain "connector" in their filename (excluding this spec)
- **SC-002**: Zero occurrences of connector-related code patterns (ConnectorModule, ConnectorService, ConnectorEntity, etc.) in source files
- **SC-003**: `pnpm build` completes successfully with zero errors
- **SC-004**: `pnpm test` completes successfully with zero failures
- **SC-005**: `pnpm lint` completes successfully with zero errors
- **SC-006**: Searching markdown files (README.md, CLAUDE.md) for "connector" returns zero matches (except this removal spec)
- **SC-007**: The sidebar navigation has exactly the same items minus the Connectors entry
- **SC-008**: The application starts and functions correctly without any connector-related errors in console

## Assumptions

- The encryption.ts utility is only used by the connectors feature and can be safely removed
- No database migrations need to be created for removal (the connector table can simply be deleted)
- Other features referencing "connectors" (like visual schema compatibility) are referring to a future feature that hasn't been implemented, so those references can simply be removed
- The mysql2 package dependency may have been added solely for connectors; if so, it can be removed from package.json
