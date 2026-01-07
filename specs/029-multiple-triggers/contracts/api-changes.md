# API Contract Changes: Multiple Triggers per Flow

**Feature**: 029-multiple-triggers
**Date**: 2026-01-06

## Overview

This document describes the API changes required to support multiple triggers per flow.

---

## Flow API Changes

### GET /api/flows/:flowId

**Response Changes**:

| Field | Change | Before | After |
|-------|--------|--------|-------|
| `toolName` | REMOVED | `string` | - |
| `toolDescription` | REMOVED | `string` | - |
| `parameters` | REMOVED | `FlowParameter[]` | - |
| `exposedTools` | ADDED (computed) | - | `string[]` |
| `hasTriggers` | ADDED (computed) | - | `boolean` |

**Before**:
```json
{
  "id": "uuid",
  "appId": "uuid",
  "name": "Get Weather",
  "description": "Fetches weather data",
  "toolName": "get_weather",
  "toolDescription": "Get current weather for a location",
  "isActive": true,
  "parameters": [
    { "name": "location", "type": "string", "description": "City name", "optional": false }
  ],
  "nodes": [...],
  "connections": [...]
}
```

**After**:
```json
{
  "id": "uuid",
  "appId": "uuid",
  "name": "Get Weather",
  "description": "Fetches weather data",
  "isActive": true,
  "nodes": [...],
  "connections": [...],
  "exposedTools": ["get_weather", "lookup_weather"],
  "hasTriggers": true
}
```

---

### POST /api/apps/:appId/flows

**Request Changes**:

| Field | Change | Before | After |
|-------|--------|--------|-------|
| `toolName` | REMOVED | Optional | - |
| `toolDescription` | REMOVED | Optional | - |
| `parameters` | REMOVED | Optional | - |

**Before**:
```json
{
  "name": "Get Weather",
  "description": "Fetches weather data",
  "toolName": "get_weather",
  "toolDescription": "Get current weather"
}
```

**After**:
```json
{
  "name": "Get Weather",
  "description": "Fetches weather data"
}
```

**Note**: Tool properties are now set when creating/updating UserIntent nodes.

---

### PATCH /api/flows/:flowId

**Request Changes**:

| Field | Change | Before | After |
|-------|--------|--------|-------|
| `toolName` | REMOVED | Optional | - |
| `toolDescription` | REMOVED | Optional | - |
| `parameters` | REMOVED | Optional | - |

---

## Node API Changes

### POST /api/flows/:flowId/nodes

**Request for UserIntent Node**:

```json
{
  "type": "UserIntent",
  "name": "Get Weather Intent",
  "position": { "x": 100, "y": 100 },
  "parameters": {
    "whenToUse": "When user asks about weather",
    "whenNotToUse": "When asking about forecasts",
    "toolDescription": "Get current weather for a location",
    "parameters": [
      { "name": "location", "type": "string", "description": "City name", "optional": false }
    ],
    "isActive": true
  }
}
```

**Response** (toolName auto-generated):

```json
{
  "id": "uuid",
  "type": "UserIntent",
  "name": "Get Weather Intent",
  "position": { "x": 100, "y": 100 },
  "parameters": {
    "whenToUse": "When user asks about weather",
    "whenNotToUse": "When asking about forecasts",
    "toolName": "get_weather_intent",
    "toolDescription": "Get current weather for a location",
    "parameters": [
      { "name": "location", "type": "string", "description": "City name", "optional": false }
    ],
    "isActive": true
  }
}
```

---

### PATCH /api/flows/:flowId/nodes/:nodeId

**Request for UserIntent Node**:

```json
{
  "name": "Weather Lookup",
  "parameters": {
    "toolDescription": "Updated description",
    "isActive": false
  }
}
```

**Note**: When `name` changes, `toolName` is regenerated. If conflict occurs, suffix is added.

---

## MCP API Changes

### GET /servers/:appSlug/mcp (tools/list)

**Before** (one tool per flow):
```json
{
  "tools": [
    {
      "name": "get_weather",
      "description": "Get current weather",
      "inputSchema": { ... }
    }
  ]
}
```

**After** (one tool per trigger):
```json
{
  "tools": [
    {
      "name": "get_weather",
      "description": "Get current weather for a city",
      "inputSchema": {
        "type": "object",
        "properties": {
          "location": { "type": "string", "description": "City name" }
        },
        "required": ["location"]
      }
    },
    {
      "name": "lookup_weather",
      "description": "Look up weather by coordinates",
      "inputSchema": {
        "type": "object",
        "properties": {
          "lat": { "type": "number", "description": "Latitude" },
          "lon": { "type": "number", "description": "Longitude" }
        },
        "required": ["lat", "lon"]
      }
    }
  ]
}
```

---

### POST /servers/:appSlug/mcp (tools/call)

**Request** (unchanged format):
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {
      "location": "New York"
    }
  },
  "id": 1
}
```

**Behavior Change**:
- System looks up trigger by `toolName` across all flows in the app
- Execution starts from that specific trigger node
- Only nodes reachable from that trigger are executed

---

## Validation Errors

### Tool Name Conflict

**Status**: 409 Conflict

```json
{
  "statusCode": 409,
  "message": "Tool name 'get_weather' already exists in this app",
  "error": "Conflict"
}
```

**Note**: This should rarely occur since the system auto-generates unique names with suffixes.

### Invalid Tool Description

**Status**: 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "toolDescription is required for UserIntent nodes",
  "error": "Bad Request"
}
```

---

## DTOs

### CreateFlowRequest (Updated)

```typescript
export class CreateFlowRequest {
  @IsString()
  @MaxLength(300)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // REMOVED: toolName, toolDescription, parameters
}
```

### UpdateFlowRequest (Updated)

```typescript
export class UpdateFlowRequest {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // REMOVED: toolName, toolDescription, parameters
}
```

### FlowResponse (Updated)

```typescript
export class FlowResponse {
  id: string;
  appId: string;
  name: string;
  description?: string;
  isActive: boolean;
  nodes: NodeInstance[];
  connections: Connection[];
  createdAt: string;
  updatedAt: string;

  // Computed fields
  exposedTools: string[];
  hasTriggers: boolean;

  // REMOVED: toolName, toolDescription, parameters
}
```

### UserIntentNodeParameters (Updated)

```typescript
export interface UserIntentNodeParameters {
  // Existing
  whenToUse?: string;
  whenNotToUse?: string;

  // New (moved from Flow)
  toolName: string;           // Auto-generated, read-only in response
  toolDescription: string;    // Required
  parameters?: FlowParameter[];
  isActive?: boolean;         // Default: true
}
```
