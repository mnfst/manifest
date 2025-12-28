// Connector type enums
export enum ConnectorType {
  MYSQL = 'mysql',
}

export enum ConnectorCategory {
  DATABASE = 'database',
  API = 'api',
  FILE = 'file',
  THIRD_PARTY = 'third_party',
}

// MySQL-specific configuration
export interface MySQLConnectorConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

// Connector entity
export interface Connector {
  id: string;
  name: string;
  connectorType: ConnectorType;
  category: ConnectorCategory;
  config: MySQLConnectorConfig;
  createdAt: string;
  updatedAt: string;
}

// Request/Response types
export interface CreateConnectorRequest {
  name: string;
  connectorType: ConnectorType;
  config: MySQLConnectorConfig;
}

export interface UpdateConnectorRequest {
  name?: string;
  config?: Partial<MySQLConnectorConfig>;
}

export interface DeleteConnectorResponse {
  success: boolean;
  id: string;
}

// Helper to derive category from connector type
export function getCategoryFromType(type: ConnectorType): ConnectorCategory {
  switch (type) {
    case ConnectorType.MYSQL:
      return ConnectorCategory.DATABASE;
    default:
      return ConnectorCategory.DATABASE;
  }
}
