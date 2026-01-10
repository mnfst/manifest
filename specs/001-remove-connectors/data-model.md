# Data Model: Remove Connectors Feature

**Date**: 2026-01-10
**Branch**: 001-remove-connectors
**Purpose**: Document the data model being removed

## Entity Being Removed: Connector

### Database Table

**Table Name**: `connectors`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated unique identifier |
| name | VARCHAR(100) | NOT NULL | User-defined connector name |
| connectorType | VARCHAR(50) | NOT NULL | Type of connector (e.g., 'mysql') |
| category | VARCHAR(50) | NOT NULL | Category (e.g., 'database') |
| config | TEXT | NOT NULL | Encrypted JSON configuration |
| createdAt | DATETIME | NOT NULL | Auto-generated creation timestamp |
| updatedAt | DATETIME | NOT NULL | Auto-updated modification timestamp |

### TypeScript Types Being Removed

```typescript
// Enums
enum ConnectorType {
  MYSQL = 'mysql',
}

enum ConnectorCategory {
  DATABASE = 'database',
  API = 'api',
  FILE = 'file',
  THIRD_PARTY = 'third_party',
}

// Configuration interface (stored encrypted in config column)
interface MySQLConnectorConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

// Main entity interface
interface Connector {
  id: string;
  name: string;
  connectorType: ConnectorType;
  category: ConnectorCategory;
  config: MySQLConnectorConfig;
  createdAt: string;
  updatedAt: string;
}

// Request/Response types
interface CreateConnectorRequest {
  name: string;
  connectorType: ConnectorType;
  config: MySQLConnectorConfig;
}

interface UpdateConnectorRequest {
  name?: string;
  config?: Partial<MySQLConnectorConfig>;
}

interface DeleteConnectorResponse {
  success: boolean;
  id: string;
}
```

### Relationships

The Connector entity has **no relationships** to other entities. It was designed as a standalone feature for storing external database connection credentials.

### Data Migration Considerations

**POC Phase**: Since the project uses `synchronize: true` in TypeORM configuration, no migration is required. The `connectors` table will be orphaned after removing the entity from the TypeORM entities array, but this won't cause errors. The table can be manually dropped if needed.

**Production Migration** (for future reference):
```sql
DROP TABLE IF EXISTS connectors;
```

### Security Note

The `config` column stored AES-256-GCM encrypted credentials. The encryption key (`CONNECTOR_ENCRYPTION_KEY`) will also be removed from configuration files. Any existing encrypted data in the database will be unrecoverable after removing the encryption utility.

## Exports Being Removed

From `packages/shared/src/index.ts`:

```typescript
// Types to remove
export type {
  Connector,
  MySQLConnectorConfig,
  CreateConnectorRequest,
  UpdateConnectorRequest,
  DeleteConnectorResponse,
} from './types/connector.js';

// Values to remove
export { ConnectorType, ConnectorCategory, getCategoryFromType } from './types/connector.js';
```
