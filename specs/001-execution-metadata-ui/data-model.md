# Data Model: Execution Metadata and Usage UI

**Feature**: 001-execution-metadata-ui
**Date**: 2026-01-08

## Entity Overview

This feature primarily modifies existing entities and adds new interfaces. No new database entities are required - the existing `FlowExecution` and `NodeExecutionData` structures remain unchanged.

## New TypeScript Interfaces

### ExecutionMetadata (Base)

The standardized metadata interface that all nodes include in their output.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| success | boolean | Yes | Whether the node execution succeeded |
| error | string | No | Error message if execution failed |
| durationMs | number | No | Execution duration in milliseconds |

**Validation Rules**:
- `success` must be a boolean
- `error` should only be present when `success` is false
- `durationMs` must be non-negative if present

### ApiExecutionMetadata (extends ExecutionMetadata)

Extended metadata for API call nodes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| httpStatus | number | No | HTTP response status code |
| httpStatusText | string | No | HTTP status text (e.g., "OK", "Not Found") |
| requestUrl | string | No | The URL that was called |

**Validation Rules**:
- `httpStatus` must be a valid HTTP status code (100-599)
- `httpStatusText` should correspond to the status code

### TransformExecutionMetadata (extends ExecutionMetadata)

Extended metadata for transform nodes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| durationMs | number | Yes | Execution duration (required for transforms) |

**Validation Rules**:
- `durationMs` is required (not optional as in base)

## Modified Output Structures

### Standard Node Output Format

All nodes now output data in this format:

```
{
  [actual output fields...],
  _execution: ExecutionMetadata
}
```

### Node-Specific Output Changes

#### ApiCallNode

**Before**:
```typescript
{
  type: 'apiCall',
  success: boolean,
  status?: number,
  statusText?: string,
  headers?: Record<string, string>,
  body?: unknown,
  error?: string,
  requestDuration: number
}
```

**After**:
```typescript
{
  // Data at root
  type: 'apiCall',
  status?: number,
  statusText?: string,
  headers?: Record<string, string>,
  body?: unknown,

  // Execution metadata
  _execution: {
    success: boolean,
    error?: string,
    durationMs: number,
    httpStatus?: number,
    httpStatusText?: string,
    requestUrl?: string
  }
}
```

#### UserIntentNode (Trigger)

**Before**:
```typescript
{
  type: 'trigger',
  triggered: boolean,
  toolName: string
}
```

**After**:
```typescript
{
  type: 'trigger',
  triggered: boolean,
  toolName: string,
  _execution: {
    success: true
  }
}
```

#### JavaScriptCodeTransform

**Already Updated** (from earlier fix):
```typescript
{
  // Transformed data spread at root
  ...transformedData,
  _execution: {
    success: boolean,
    error?: string
  }
}
```

**Enhancement** (add duration):
```typescript
{
  ...transformedData,
  _execution: {
    success: boolean,
    error?: string,
    durationMs: number  // NEW
  }
}
```

#### ReturnNode

**Before**:
```typescript
{
  type: 'return',
  value: string
}
```

**After**:
```typescript
{
  type: 'return',
  value: string,
  _execution: {
    success: true
  }
}
```

#### CallFlowNode

**Before**:
```typescript
{
  type: 'callFlow',
  targetFlowId: string,
  result: unknown
}
```

**After**:
```typescript
{
  type: 'callFlow',
  targetFlowId: string,
  result: unknown,
  _execution: {
    success: boolean,
    error?: string
  }
}
```

#### Interface Nodes (StatCard, PostList)

**Before**:
```typescript
{
  type: 'interface',
  layoutTemplate: string
}
```

**After**:
```typescript
{
  type: 'interface',
  layoutTemplate: string,
  _execution: {
    success: true
  }
}
```

## Existing Entities (No Changes Required)

### FlowExecution Entity

The existing `FlowExecution` entity in TypeORM remains unchanged:

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID primary key |
| flowId | string | Reference to flow |
| flowName | string | Flow display name |
| flowToolName | string | Flow tool identifier |
| status | ExecutionStatus | pending/fulfilled/error |
| startedAt | string | ISO timestamp |
| endedAt | string | ISO timestamp |
| nodeExecutions | NodeExecutionData[] | JSON array |
| errorInfo | ExecutionErrorInfo | Flow-level error |
| isPreview | boolean | Preview vs MCP execution |

### NodeExecutionData (JSON in FlowExecution)

Stored as JSON within FlowExecution. The `outputData` field will now contain the new format:

| Field | Type | Description |
|-------|------|-------------|
| nodeId | string | Node identifier |
| nodeName | string | Node display name |
| nodeType | string | Node type identifier |
| executedAt | string | ISO timestamp |
| inputData | Record<string, unknown> | Input received |
| outputData | Record<string, unknown> | **Now includes _execution** |
| status | NodeExecutionStatus | pending/completed/error |
| error | string | Node-level error (legacy) |
| executionTimeMs | number | Execution duration |

**Note**: The `outputData` field now contains the standardized format with `_execution`. The existing `status` and `error` fields at the `NodeExecutionData` level remain for backward compatibility.

## State Transitions

### Node Execution Status

```
pending ─────┬────> completed (success: true)
             │
             └────> error (success: false)
```

### Flow Execution Status

```
pending ─────┬────> fulfilled (all nodes success: true)
             │
             └────> error (any node success: false)
```

## Relationships

```
FlowExecution 1 ──────> * NodeExecutionData
                              │
                              └── outputData contains _execution: ExecutionMetadata
```
