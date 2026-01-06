# Data Model: API Call Action Node

**Feature**: 018-api-call-action
**Date**: 2026-01-06

## Overview

This document defines the data structures for the API Call node feature. The API Call node follows the existing node storage pattern where nodes are stored as JSON within the Flow entity.

---

## Entities

### 1. ApiCallNodeParameters

Parameters stored in `NodeInstance.parameters` for nodes of type 'ApiCall'.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| method | HttpMethod | Yes | 'GET' | HTTP method for the request |
| url | string | Yes | '' | Target URL (may contain template variables) |
| headers | HeaderEntry[] | No | [] | HTTP headers as key-value pairs |
| timeout | number | No | 30000 | Request timeout in milliseconds |
| inputMappings | InputMapping[] | No | [] | Mappings from upstream node outputs |

**Type Definitions**:

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface HeaderEntry {
  key: string;
  value: string;
}

interface InputMapping {
  sourceNodeId: string;
  sourcePath: string;      // Path to extract from source output (e.g., 'data.id')
  targetField: 'url' | 'header' | 'body';
  targetKey?: string;      // For headers/body: which key to set
}
```

**Validation Rules**:
- `method` must be one of: GET, POST, PUT, DELETE, PATCH
- `url` must not be empty (may be empty during configuration, validated at execution)
- `timeout` must be positive integer, max 300000 (5 minutes)
- `headers` keys must be valid HTTP header names

---

### 2. ApiCallOutput

Output structure produced by the ApiCallNode.execute() function.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | 'apiCall' | Yes | Discriminator for output type |
| success | boolean | Yes | true if request completed (even 4xx/5xx) |
| status | number | Conditional | HTTP status code (present when success=true or HTTP error) |
| statusText | string | Conditional | HTTP status text |
| headers | Record<string, string> | Conditional | Response headers |
| body | unknown | Conditional | Parsed response body (JSON or text) |
| error | string | Conditional | Error message when success=false |
| requestDuration | number | Yes | Time taken for request in milliseconds |

**State Transitions**:
- Request initiated → success=true (any HTTP status) OR success=false (network/timeout error)
- No intermediate states; execution is atomic

---

### 3. NodeType Extension

The existing `NodeType` union type will be extended:

```typescript
// Current (packages/shared/src/types/node.ts)
type NodeType = 'Interface' | 'Return' | 'CallFlow';

// Extended
type NodeType = 'Interface' | 'Return' | 'CallFlow' | 'ApiCall';
```

---

### 4. NodeTypeDefinition (ApiCallNode)

The node type definition following the existing pattern:

| Property | Value |
|----------|-------|
| name | 'ApiCall' |
| displayName | 'API Call' |
| icon | 'globe' |
| group | ['action', 'integration'] |
| description | 'Make HTTP requests to external APIs' |
| inputs | ['main'] |
| outputs | ['main'] |
| defaultParameters | See ApiCallNodeParameters defaults |

---

## Relationships

```
Flow (existing)
├── nodes: NodeInstance[]
│   └── NodeInstance (type: 'ApiCall')
│       └── parameters: ApiCallNodeParameters
└── connections: Connection[]
    └── sourceHandle: 'main' | 'output'
    └── targetHandle: 'input' | 'main'
```

**Node Connection Rules**:
- ApiCallNode has one input handle ('main' or 'input') on the left
- ApiCallNode has one output handle ('main' or 'output') on the right
- Can connect from any node's output to ApiCallNode's input
- Can connect from ApiCallNode's output to any node's input

---

## Storage

No database schema changes required. The API Call node parameters are stored within the existing JSON structure:

```json
{
  "id": "uuid",
  "type": "ApiCall",
  "name": "Fetch User Data",
  "position": { "x": 300, "y": 200 },
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/users/{{prev.userId}}",
    "headers": [
      { "key": "Authorization", "value": "Bearer {{env.API_KEY}}" }
    ],
    "timeout": 30000,
    "inputMappings": [
      {
        "sourceNodeId": "prev-node-id",
        "sourcePath": "userId",
        "targetField": "url"
      }
    ]
  }
}
```

---

## Type Guards

```typescript
/**
 * Check if a node is an ApiCall node.
 */
function isApiCallNode(
  node: NodeInstance
): node is NodeInstance & { parameters: ApiCallNodeParameters } {
  return node.type === 'ApiCall';
}
```

---

## Migration

No migration required - this is a new node type. Existing flows are unaffected.
