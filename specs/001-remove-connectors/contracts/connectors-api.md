# API Contract: Connectors (Being Removed)

**Date**: 2026-01-10
**Branch**: 001-remove-connectors
**Purpose**: Document the API endpoints being removed

## Base Path

```
/api/connectors
```

## Endpoints Being Removed

### GET /api/connectors

**Description**: List all connectors

**Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "string",
    "connectorType": "mysql",
    "category": "database",
    "config": {
      "host": "string",
      "port": "number",
      "database": "string",
      "username": "string",
      "password": "********"  // Masked in response
    },
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
]
```

---

### GET /api/connectors/:id

**Description**: Get a connector by ID

**Parameters**:
- `id` (path): UUID of the connector

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "string",
  "connectorType": "mysql",
  "category": "database",
  "config": {
    "host": "string",
    "port": "number",
    "database": "string",
    "username": "string",
    "password": "********"
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors**:
- `404 Not Found`: Connector not found

---

### POST /api/connectors

**Description**: Create a new connector

**Request Body**:
```json
{
  "name": "string (max 100 chars)",
  "connectorType": "mysql",
  "config": {
    "host": "string",
    "port": "number (1-65535)",
    "database": "string",
    "username": "string",
    "password": "string"
  }
}
```

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "name": "string",
  "connectorType": "mysql",
  "category": "database",
  "config": {
    "host": "string",
    "port": "number",
    "database": "string",
    "username": "string",
    "password": "********"
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors**:
- `400 Bad Request`: Validation errors (name too long, missing fields, invalid port)

---

### PUT /api/connectors/:id

**Description**: Update a connector

**Parameters**:
- `id` (path): UUID of the connector

**Request Body** (all fields optional):
```json
{
  "name": "string (max 100 chars)",
  "config": {
    "host": "string",
    "port": "number (1-65535)",
    "database": "string",
    "username": "string",
    "password": "string"
  }
}
```

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "string",
  "connectorType": "mysql",
  "category": "database",
  "config": {
    "host": "string",
    "port": "number",
    "database": "string",
    "username": "string",
    "password": "********"
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors**:
- `400 Bad Request`: Validation errors
- `404 Not Found`: Connector not found

---

### DELETE /api/connectors/:id

**Description**: Delete a connector

**Parameters**:
- `id` (path): UUID of the connector

**Response**: `200 OK`
```json
{
  "success": true,
  "id": "uuid"
}
```

**Errors**:
- `404 Not Found`: Connector not found

---

### POST /api/connectors/:id/test

**Description**: Test connection for an existing connector

**Parameters**:
- `id` (path): UUID of the connector

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Connection successful"
}
```

or

```json
{
  "success": false,
  "message": "Connection failed: [error details]"
}
```

**Errors**:
- `404 Not Found`: Connector not found

---

### POST /api/connectors/test

**Description**: Test connection with raw config (before creating)

**Request Body**:
```json
{
  "host": "string",
  "port": "number (1-65535)",
  "database": "string",
  "username": "string",
  "password": "string"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Connection successful"
}
```

or

```json
{
  "success": false,
  "message": "Connection failed: [error details]"
}
```

---

## Frontend API Client Functions Being Removed

From `packages/frontend/src/lib/api.ts`:

```typescript
// Remove these functions
async listConnectors(): Promise<Connector[]>
async getConnector(id: string): Promise<Connector>
async createConnector(request: CreateConnectorRequest): Promise<Connector>
async updateConnector(id: string, request: UpdateConnectorRequest): Promise<Connector>
async deleteConnector(id: string): Promise<DeleteConnectorResponse>
async testConnectorConnection(id: string): Promise<{ success: boolean; message: string }>
async testConnectionConfig(config: MySQLConnectorConfig): Promise<{ success: boolean; message: string }>
```

---

## Impact

After removal:
- All `/api/connectors*` endpoints will return 404
- Frontend API client will no longer have connector methods
- No breaking changes to other API endpoints
