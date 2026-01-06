# API Contract Changes: Remove Mock Data

**Date**: 2026-01-06
**Feature**: 020-remove-mock-data

## Overview

This feature **removes** API functionality rather than adding new endpoints. No new API contracts are required.

---

## Removed API Methods (Agent Service)

### `processMockDataChat` - REMOVED

**Previous Signature**:
```typescript
async processMockDataChat(
  message: string,
  layoutTemplate: LayoutTemplate
): Promise<ProcessMockDataChatResult>
```

**Status**: Method will be deleted. Any frontend code calling this method must be removed.

---

## Modified Response Types

### Node Creation/Update Responses

When creating or updating an Interface node, the `parameters` field no longer includes `mockData`.

**Before**:
```json
{
  "id": "node-123",
  "type": "Interface",
  "name": "My Interface",
  "position": { "x": 100, "y": 100 },
  "parameters": {
    "layoutTemplate": "table",
    "mockData": {
      "type": "table",
      "columns": [...],
      "rows": [...]
    }
  }
}
```

**After**:
```json
{
  "id": "node-123",
  "type": "Interface",
  "name": "My Interface",
  "position": { "x": 100, "y": 100 },
  "parameters": {
    "layoutTemplate": "table"
  }
}
```

---

## App Generation Response

### `POST /api/agent/generate`

**Before**:
```json
{
  "name": "Generated App",
  "description": "...",
  "layoutTemplate": "table",
  "themeVariables": {...},
  "mockData": {...},
  "toolName": "...",
  "toolDescription": "..."
}
```

**After**:
```json
{
  "name": "Generated App",
  "description": "...",
  "layoutTemplate": "table",
  "themeVariables": {...},
  "toolName": "...",
  "toolDescription": "..."
}
```

---

## Backward Compatibility

### Existing Stored Data

- Flows with `mockData` in node parameters will continue to load
- The `mockData` field will be silently ignored at runtime
- When flows are re-saved, `mockData` will not be included

### Frontend Requests

- Any frontend code sending `mockData` in node creation requests should be updated
- Backend will accept but ignore `mockData` in parameters (no validation error)

---

## No New Endpoints

This feature does not introduce any new API endpoints. The default test fixtures are seeded at application startup through internal service methods, not through API calls.
