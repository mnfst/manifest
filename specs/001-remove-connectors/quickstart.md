# Quickstart: Remove Connectors Feature

**Date**: 2026-01-10
**Branch**: 001-remove-connectors
**Purpose**: Step-by-step guide for implementing the connector removal

## Prerequisites

- Git repository checked out to `001-remove-connectors` branch
- Node.js >= 18.0.0 and pnpm installed
- Understanding of the monorepo structure (packages/backend, packages/frontend, packages/shared)

## Overview

This removal involves:
- **13 files to delete** across 3 packages
- **2 directories to delete** (connector modules)
- **9 files to modify** (imports, routes, configs)
- **1 spec directory to delete**
- **1 npm dependency to remove** (mysql2)

## Step-by-Step Removal

### Phase 1: Remove Backend Code

1. **Delete connector module directory**:
   ```bash
   rm -rf packages/backend/src/connector/
   ```

2. **Delete encryption utility** (only used by connectors):
   ```bash
   rm packages/backend/src/utils/encryption.ts
   ```

3. **Update app.module.ts** - Remove:
   - Import of `ConnectorEntity`
   - Import of `ConnectorModule`
   - `ConnectorEntity` from TypeORM entities array
   - `ConnectorModule` from imports array

4. **Remove mysql2 dependency**:
   ```bash
   cd packages/backend && pnpm remove mysql2
   ```

### Phase 2: Remove Shared Types

1. **Delete connector types file**:
   ```bash
   rm packages/shared/src/types/connector.ts
   ```

2. **Update shared/src/index.ts** - Remove all connector exports:
   - Remove type exports: `Connector`, `MySQLConnectorConfig`, `CreateConnectorRequest`, `UpdateConnectorRequest`, `DeleteConnectorResponse`
   - Remove value exports: `ConnectorType`, `ConnectorCategory`, `getCategoryFromType`

### Phase 3: Remove Frontend Code

1. **Delete connector components directory**:
   ```bash
   rm -rf packages/frontend/src/components/connector/
   ```

2. **Delete ConnectorsPage**:
   ```bash
   rm packages/frontend/src/pages/ConnectorsPage.tsx
   ```

3. **Update App.tsx** - Remove:
   - Import of `ConnectorsPage`
   - Route: `<Route path="/connectors" element={<ConnectorsPage />} />`

4. **Update Sidebar.tsx** - Remove:
   - `ConnectorsIcon` component
   - `isConnectorsActive` state variable
   - `<SidebarItem>` for Connectors

5. **Update api.ts** - Remove connector API functions (lines ~426-503):
   - `listConnectors()`
   - `getConnector()`
   - `createConnector()`
   - `updateConnector()`
   - `deleteConnector()`
   - `testConnectorConnection()`
   - `testConnectionConfig()`
   - Remove imports of connector types at top of file

### Phase 4: Update Configuration

1. **Update .env.example**:
   - Remove `CONNECTOR_ENCRYPTION_KEY` and its comment

2. **Update docker-compose.yml**:
   - Remove `CONNECTOR_ENCRYPTION_KEY` environment variable
   - Remove comment about "Database connector encryption key"

3. **Update README.md** - Remove:
   - "External Connectors" from features list
   - `connector/` from directory structure
   - `CONNECTOR_ENCRYPTION_KEY` from setup instructions
   - `CONNECTOR_ENCRYPTION_KEY` from Docker run example
   - `CONNECTOR_ENCRYPTION_KEY` row from environment variables table

### Phase 5: Clean Up Specs

1. **Delete connector spec directory**:
   ```bash
   rm -rf specs/011-connectors/
   ```

2. **Update specs/001-io-schemas/spec.md**:
   - Remove "User Story 2 - Visual Schema Compatibility in Connectors" section

## Verification

After completing all steps:

1. **Build the project**:
   ```bash
   pnpm build
   ```

2. **Run tests**:
   ```bash
   pnpm test
   ```

3. **Run linter**:
   ```bash
   pnpm lint
   ```

4. **Search for remaining references**:
   ```bash
   grep -ri "connector" packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules
   ```
   Should return no results.

5. **Start the application**:
   ```bash
   pnpm dev
   ```
   - Verify sidebar has no "Connectors" menu item
   - Verify navigating to `/connectors` shows 404 or redirects

## Rollback

If needed, revert all changes:
```bash
git checkout main -- packages/backend packages/frontend packages/shared README.md docker-compose.yml specs/
```

## Notes

- The `connectors` table in SQLite will be orphaned but won't cause errors (POC uses `synchronize: true`)
- To fully clean the database, manually drop the table: `DROP TABLE IF EXISTS connectors;`
- The CONNECTOR_ENCRYPTION_KEY in existing .env files can be removed manually
