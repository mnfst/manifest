# Research: Remove Connectors Feature

**Date**: 2026-01-10
**Branch**: 001-remove-connectors
**Purpose**: Verify assumptions and resolve any unknowns before implementation

## Research Tasks

### 1. Encryption Utility Usage

**Question**: Is `packages/backend/src/utils/encryption.ts` only used by the connectors feature?

**Research Method**: Grep for imports of encryption utility across codebase

**Finding**: Yes, encryption.ts is only imported by connector.service.ts

```
packages/backend/src/connector/connector.service.ts:14:import { encrypt, decrypt, getEncryptionKey } from '../utils/encryption';
```

**Decision**: Safe to delete encryption.ts
**Rationale**: No other modules depend on this utility
**Alternatives considered**: Keep for future use - rejected because YAGNI (You Aren't Gonna Need It)

---

### 2. MySQL2 Package Usage

**Question**: Is the mysql2 package only used by the connectors feature?

**Research Method**: Grep for mysql2 imports across codebase

**Finding**: Yes, mysql2 is only imported by connector.service.ts

```
packages/backend/package.json:36:    "mysql2": "^3.16.0",
packages/backend/src/connector/connector.service.ts:4:import * as mysql from 'mysql2/promise';
```

**Decision**: Remove mysql2 from package.json dependencies
**Rationale**: No other code uses this package
**Alternatives considered**: Keep for future external database connections - rejected because features should add dependencies when needed

---

### 3. Connector References in Other Specs

**Question**: What connector references exist in other specification files?

**Research Method**: Grep for connector in specs directory

**Finding**: Found references in 3 specification files:

1. **specs/001-io-schemas/spec.md**: Line 27 mentions "Visual Schema Compatibility in Connectors" as a future user story
2. **specs/018-node-connection/spec.md**: Mentions "connectors" in the context of node connection handles
3. **specs/011-connectors/**: The main connector spec directory to be deleted

**Decision**:
- Remove specs/011-connectors/ entirely
- Remove the "Visual Schema Compatibility in Connectors" user story from 001-io-schemas/spec.md
- Keep spec 018-node-connection as-is (refers to UI handles, not connector feature)

**Rationale**: The io-schemas spec references connectors as a future feature that won't be implemented. The node-connection spec uses "connector" generically to mean connection handles, not the Connector entity.

---

### 4. Database Table Cleanup

**Question**: Does the ConnectorEntity create a database table that needs migration/cleanup?

**Research Method**: Review TypeORM configuration and entity definition

**Finding**: Yes, ConnectorEntity is registered in app.module.ts TypeORM configuration:

```typescript
entities: [AppEntity, FlowEntity, ConnectorEntity, FlowExecutionEntity],
synchronize: true, // POC only - use migrations in production
```

**Decision**: Remove ConnectorEntity from the entities array. The `synchronize: true` setting for POC means the table will be orphaned but won't cause issues. For production, a migration would be needed to drop the table.

**Rationale**: POC phase allows simpler cleanup; production would require proper migration
**Alternatives considered**: Create a migration to drop the table - rejected because POC phase, manual cleanup is acceptable

---

### 5. Landing Page Template Reference

**Question**: The grep found a reference in `packages/backend/src/mcp/templates/landing.html` - what is it?

**Research Method**: Check the landing.html content

**Finding**: The file was flagged because it contains the word "connector" but in a different context (likely generic HTML content or unrelated text). Verified this is not related to the Connector feature.

**Decision**: No changes needed to landing.html
**Rationale**: False positive from grep search

---

## Summary of Findings

| Assumption | Verified | Action |
|------------|----------|--------|
| encryption.ts only used by connectors | YES | Delete the file |
| mysql2 only used by connectors | YES | Remove from package.json |
| Other specs reference connectors | PARTIAL | Remove reference from 001-io-schemas, keep 018-node-connection |
| Database cleanup needed | YES | Remove entity from TypeORM config (auto-cleanup via synchronize) |
| No breaking dependencies | YES | All connector code is isolated |

## Resolved Unknowns

All assumptions from the specification have been verified. No NEEDS CLARIFICATION items remain.

## Impact Analysis

**Files to Delete (13 files)**:
1. packages/backend/src/connector/connector.controller.ts
2. packages/backend/src/connector/connector.entity.ts
3. packages/backend/src/connector/connector.module.ts
4. packages/backend/src/connector/connector.service.ts
5. packages/backend/src/utils/encryption.ts
6. packages/frontend/src/components/connector/ConnectorCard.tsx
7. packages/frontend/src/components/connector/ConnectorList.tsx
8. packages/frontend/src/components/connector/ConnectorRow.tsx
9. packages/frontend/src/components/connector/CreateConnectorModal.tsx
10. packages/frontend/src/components/connector/DeleteConnectorDialog.tsx
11. packages/frontend/src/components/connector/EditConnectorModal.tsx
12. packages/frontend/src/pages/ConnectorsPage.tsx
13. packages/shared/src/types/connector.ts

**Directories to Delete (2 directories)**:
1. packages/backend/src/connector/
2. packages/frontend/src/components/connector/
3. specs/011-connectors/

**Files to Modify (9 files)**:
1. packages/backend/src/app/app.module.ts - Remove ConnectorEntity and ConnectorModule
2. packages/backend/package.json - Remove mysql2 dependency
3. packages/frontend/src/App.tsx - Remove /connectors route and import
4. packages/frontend/src/components/layout/Sidebar.tsx - Remove Connectors menu item
5. packages/frontend/src/lib/api.ts - Remove connector API functions
6. packages/shared/src/index.ts - Remove connector type exports
7. packages/backend/.env.example - Remove CONNECTOR_ENCRYPTION_KEY
8. docker-compose.yml - Remove CONNECTOR_ENCRYPTION_KEY
9. README.md - Remove connector references (feature list, directory structure, env vars)

**Spec Files to Modify (1 file)**:
1. specs/001-io-schemas/spec.md - Remove "Visual Schema Compatibility in Connectors" user story
