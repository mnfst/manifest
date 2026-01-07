# API Contracts: Node I/O Schema Validation

**Feature**: 001-io-schemas
**Date**: 2026-01-06

## Overview

This document defines the REST API endpoints for schema validation. All endpoints follow the existing API patterns in the codebase.

**Base URL**: `/api`

## Endpoints

### 1. Get Node Schema

Retrieve the input and output schemas for a specific node instance.

**Endpoint**: `GET /flows/:flowId/nodes/:nodeId/schema`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| flowId | string (UUID) | Flow containing the node |
| nodeId | string (UUID) | Node instance ID |

**Response** (200 OK):
```typescript
interface NodeSchemaResponse {
  nodeId: string;
  nodeType: string;
  inputState: 'defined' | 'unknown' | 'pending';
  inputSchema: JSONSchema | null;
  outputState: 'defined' | 'unknown' | 'pending';
  outputSchema: JSONSchema | null;
}
```

**Example Response**:
```json
{
  "nodeId": "abc123",
  "nodeType": "ApiCall",
  "inputState": "defined",
  "inputSchema": {
    "type": "object",
    "additionalProperties": true
  },
  "outputState": "unknown",
  "outputSchema": null
}
```

**Error Responses**:
- 404: Flow or node not found

---

### 2. Get All Node Schemas in Flow

Retrieve schemas for all nodes in a flow (bulk operation).

**Endpoint**: `GET /flows/:flowId/schemas`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| flowId | string (UUID) | Flow ID |

**Response** (200 OK):
```typescript
interface FlowSchemasResponse {
  flowId: string;
  nodes: NodeSchemaResponse[];
}
```

**Example Response**:
```json
{
  "flowId": "flow-123",
  "nodes": [
    {
      "nodeId": "node-1",
      "nodeType": "UserIntent",
      "inputState": "defined",
      "inputSchema": null,
      "outputState": "defined",
      "outputSchema": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "const": "trigger" },
          "triggered": { "type": "boolean" }
        },
        "required": ["type", "triggered"]
      }
    },
    {
      "nodeId": "node-2",
      "nodeType": "Return",
      "inputState": "defined",
      "inputSchema": {
        "type": "object",
        "additionalProperties": true
      },
      "outputState": "defined",
      "outputSchema": null
    }
  ]
}
```

---

### 3. Validate Connection Compatibility

Check if a connection between two nodes is compatible.

**Endpoint**: `POST /flows/:flowId/connections/validate`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| flowId | string (UUID) | Flow ID |

**Request Body**:
```typescript
interface ValidateConnectionRequest {
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;
}
```

**Response** (200 OK):
```typescript
interface ValidateConnectionResponse {
  status: 'compatible' | 'warning' | 'error' | 'unknown';
  issues: CompatibilityIssue[];
  sourceSchema: JSONSchema | null;
  targetSchema: JSONSchema | null;
}

interface CompatibilityIssue {
  type: 'missing_field' | 'type_mismatch' | 'format_mismatch' | 'constraint_violation';
  severity: 'error' | 'warning';
  path: string;
  message: string;
  sourceValue?: string;
  targetValue?: string;
}
```

**Example Request**:
```json
{
  "sourceNodeId": "node-1",
  "sourceHandle": "main",
  "targetNodeId": "node-2",
  "targetHandle": "main"
}
```

**Example Response (Compatible)**:
```json
{
  "status": "compatible",
  "issues": [],
  "sourceSchema": {
    "type": "object",
    "properties": {
      "userId": { "type": "string" },
      "name": { "type": "string" }
    },
    "required": ["userId"]
  },
  "targetSchema": {
    "type": "object",
    "properties": {
      "userId": { "type": "string" }
    },
    "required": ["userId"]
  }
}
```

**Example Response (Error)**:
```json
{
  "status": "error",
  "issues": [
    {
      "type": "missing_field",
      "severity": "error",
      "path": "email",
      "message": "Required field 'email' is missing from source output"
    },
    {
      "type": "type_mismatch",
      "severity": "warning",
      "path": "count",
      "message": "Type mismatch: source is 'number', target expects 'string'",
      "sourceValue": "number",
      "targetValue": "string"
    }
  ],
  "sourceSchema": { ... },
  "targetSchema": { ... }
}
```

---

### 4. Validate All Connections in Flow

Batch validate all connections in a flow.

**Endpoint**: `GET /flows/:flowId/connections/validate`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| flowId | string (UUID) | Flow ID |

**Response** (200 OK):
```typescript
interface FlowValidationResponse {
  flowId: string;
  status: 'valid' | 'warnings' | 'errors';
  summary: {
    total: number;
    compatible: number;
    warnings: number;
    errors: number;
    unknown: number;
  };
  connections: ConnectionValidationResult[];
}

interface ConnectionValidationResult {
  connectionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: 'compatible' | 'warning' | 'error' | 'unknown';
  issues: CompatibilityIssue[];
}
```

**Example Response**:
```json
{
  "flowId": "flow-123",
  "status": "warnings",
  "summary": {
    "total": 3,
    "compatible": 1,
    "warnings": 1,
    "errors": 0,
    "unknown": 1
  },
  "connections": [
    {
      "connectionId": "conn-1",
      "sourceNodeId": "node-1",
      "targetNodeId": "node-2",
      "status": "compatible",
      "issues": []
    },
    {
      "connectionId": "conn-2",
      "sourceNodeId": "node-2",
      "targetNodeId": "node-3",
      "status": "warning",
      "issues": [
        {
          "type": "type_mismatch",
          "severity": "warning",
          "path": "count",
          "message": "Type coercion: number to string"
        }
      ]
    },
    {
      "connectionId": "conn-3",
      "sourceNodeId": "node-3",
      "targetNodeId": "node-4",
      "status": "unknown",
      "issues": []
    }
  ]
}
```

---

### 5. Resolve Dynamic Schema

Trigger schema resolution for nodes with dynamic/unknown schemas (e.g., API Call).

**Endpoint**: `POST /flows/:flowId/nodes/:nodeId/schema/resolve`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| flowId | string (UUID) | Flow ID |
| nodeId | string (UUID) | Node instance ID |

**Request Body** (optional):
```typescript
interface ResolveSchemaRequest {
  // For API Call nodes: sample request to make for schema discovery
  sampleRequest?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
}
```

**Response** (200 OK):
```typescript
interface ResolveSchemaResponse {
  nodeId: string;
  resolved: boolean;
  outputSchema: JSONSchema | null;
  error?: string;
}
```

**Example Response (Success)**:
```json
{
  "nodeId": "api-node-1",
  "resolved": true,
  "outputSchema": {
    "type": "object",
    "properties": {
      "type": { "type": "string", "const": "apiCall" },
      "success": { "type": "boolean" },
      "status": { "type": "integer" },
      "body": {
        "type": "object",
        "properties": {
          "users": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "name": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

**Example Response (Failed)**:
```json
{
  "nodeId": "api-node-1",
  "resolved": false,
  "outputSchema": null,
  "error": "Unable to resolve schema: URL not configured"
}
```

---

### 6. Get Node Type Schemas

Get default schemas for a node type (not instance-specific).

**Endpoint**: `GET /node-types/:nodeType/schema`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| nodeType | string | Node type name (e.g., "UserIntent", "ApiCall") |

**Response** (200 OK):
```typescript
interface NodeTypeSchemaResponse {
  nodeType: string;
  inputSchema: JSONSchema | null;
  outputSchema: JSONSchema | null;
  hasDynamicInput: boolean;
  hasDynamicOutput: boolean;
}
```

**Example Response**:
```json
{
  "nodeType": "UserIntent",
  "inputSchema": null,
  "outputSchema": {
    "type": "object",
    "properties": {
      "type": { "type": "string", "const": "trigger" },
      "triggered": { "type": "boolean" }
    },
    "required": ["type", "triggered"]
  },
  "hasDynamicInput": false,
  "hasDynamicOutput": false
}
```

---

## Extended Existing Endpoints

### Create Connection (Extended)

The existing `POST /flows/:flowId/connections` endpoint is extended to include validation.

**Existing Endpoint**: `POST /flows/:flowId/connections`

**Extended Response**:
```typescript
interface CreateConnectionResponse {
  // Existing fields
  id: string;
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;

  // NEW: Validation result
  validation: {
    status: 'compatible' | 'warning' | 'error' | 'unknown';
    issues: CompatibilityIssue[];
  };
}
```

**Behavior Change**:
- Connection is still created even if validation fails (per spec: show error, don't block)
- Validation result is returned in response for immediate UI feedback
- For `status: 'error'`, the frontend should highlight the connection in red

---

## Error Responses

All endpoints use standard error format:

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
}
```

**Common Errors**:
| Status | Error | When |
|--------|-------|------|
| 400 | Bad Request | Invalid request body |
| 404 | Not Found | Flow, node, or connection not found |
| 500 | Internal Server Error | Schema validation failure |

---

## WebSocket Events (Future)

For real-time validation updates (not required for initial implementation):

```typescript
// When node schema changes
interface SchemaChangedEvent {
  type: 'schema:changed';
  flowId: string;
  nodeId: string;
  inputSchema: JSONSchema | null;
  outputSchema: JSONSchema | null;
}

// When connection validation changes
interface ConnectionValidationEvent {
  type: 'connection:validated';
  flowId: string;
  connectionId: string;
  status: CompatibilityStatus;
  issues: CompatibilityIssue[];
}
```

---

## Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/flows/:flowId/nodes/:nodeId/schema` | GET | Get node schema |
| `/flows/:flowId/schemas` | GET | Get all node schemas in flow |
| `/flows/:flowId/connections/validate` | POST | Validate single connection |
| `/flows/:flowId/connections/validate` | GET | Validate all connections |
| `/flows/:flowId/nodes/:nodeId/schema/resolve` | POST | Resolve dynamic schema |
| `/node-types/:nodeType/schema` | GET | Get node type default schema |
