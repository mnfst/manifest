# API Contracts: Output Reference & Trigger Node UX Improvements

**Feature Branch**: `001-output-reference`
**Date**: 2026-01-07

---

## Summary

This feature is primarily **frontend-focused** with minimal backend changes. No new API endpoints are required. Changes are limited to:

1. **Node entity schema change** (add `slug` field)
2. **Existing endpoint response modifications**
3. **Execution engine change** (resolve slug-based references)

---

## Modified Endpoints

### 1. POST /flows/:flowId/nodes

**Change**: Response includes new `slug` field

**Request** (unchanged):
```json
{
  "type": "UserIntent",
  "name": "Weather Trigger",
  "position": { "x": 100, "y": 100 }
}
```

**Response** (modified):
```json
{
  "id": "uuid-123-abc",
  "slug": "weather_trigger",      // NEW FIELD
  "type": "UserIntent",
  "name": "Weather Trigger",
  "position": { "x": 100, "y": 100 },
  "parameters": {
    "toolName": "weather_trigger",
    "toolDescription": "",
    "parameters": [],
    "isActive": true
  }
}
```

**Slug Generation Logic**:
1. Convert name to snake_case
2. Check uniqueness within flow
3. If collision, append `_2`, `_3`, etc.

---

### 2. PUT /flows/:flowId/nodes/:nodeId

**Change**: Slug is regenerated when name changes

**Request**:
```json
{
  "name": "Get Weather Data",
  "parameters": { ... }
}
```

**Response**:
```json
{
  "id": "uuid-123-abc",
  "slug": "get_weather_data",      // UPDATED based on new name
  "type": "UserIntent",
  "name": "Get Weather Data",
  ...
}
```

**Side Effect**: If slug changes, references in downstream nodes are automatically updated.

---

### 3. GET /flows/:flowId

**Change**: All nodes include `slug` field

**Response** (nodes array):
```json
{
  "nodes": [
    {
      "id": "uuid-123",
      "slug": "weather_trigger",
      "type": "UserIntent",
      "name": "Weather Trigger",
      ...
    },
    {
      "id": "uuid-456",
      "slug": "api_call_1",
      "type": "ApiCall",
      "name": "Fetch Weather",
      ...
    }
  ],
  "connections": [ ... ]
}
```

---

### 4. GET /flows/:flowId/nodes/:nodeId/schema

**Change**: Schema properties include `x-field-source` metadata

**Response** (for UserIntent node):
```json
{
  "inputSchema": null,
  "outputSchema": {
    "type": "object",
    "properties": {
      "type": {
        "type": "string",
        "const": "trigger",
        "x-field-source": "static"
      },
      "triggered": {
        "type": "boolean",
        "x-field-source": "static"
      },
      "toolName": {
        "type": "string",
        "x-field-source": "static"
      },
      "city": {
        "type": "string",
        "description": "Target city for weather lookup",
        "x-field-source": "dynamic"
      }
    },
    "required": ["type", "triggered", "toolName", "city"]
  }
}
```

---

## Execution Engine Changes

### Template Variable Resolution

**Location**: `packages/backend/src/mcp/mcp.tool.ts`

**Current Behavior**:
- Resolves `{{nodeId.path}}` using UUID lookup

**New Behavior**:
- Resolves `{{nodeSlug.path}}` using slug lookup
- Falls back to UUID lookup for backward compatibility during migration

**Resolution Algorithm**:
```typescript
function resolveReference(reference: string, nodes: NodeInstance[], nodeOutputs: Map<string, any>) {
  const match = reference.match(/\{\{\s*([a-z][a-z0-9_]*)\.([\w.]+)\s*\}\}/);
  if (!match) return reference;

  const [, slugOrId, path] = match;

  // Try slug first
  const nodeBySlug = nodes.find(n => n.slug === slugOrId);
  if (nodeBySlug) {
    return getValueAtPath(nodeOutputs.get(nodeBySlug.id), path);
  }

  // Fall back to ID (backward compatibility)
  const nodeById = nodes.find(n => n.id === slugOrId);
  if (nodeById) {
    return getValueAtPath(nodeOutputs.get(nodeById.id), path);
  }

  throw new Error(`Unknown node reference: ${slugOrId}`);
}
```

---

## No New Endpoints Required

The following functionality is handled **client-side**:

| Feature | Implementation |
|---------|----------------|
| Upstream node discovery | Client traverses connections array |
| Output field listing | Client flattens schema from existing endpoint |
| Reference string generation | Client concatenates slug + path |
| Copy to clipboard | Browser Clipboard API |

---

## Database Migration

### Migration Script

```sql
-- Add slug column to nodes JSON
-- Note: SQLite stores nodes as JSON, migration is handled in application layer

-- Application-level migration pseudo-code:
-- 1. Load all flows
-- 2. For each flow:
--    a. For each node without slug:
--       - Generate slug from name
--       - Ensure uniqueness
--    b. For each node with template variables (ApiCall):
--       - Find {{uuid.path}} patterns
--       - Replace uuid with corresponding slug
-- 3. Save flows
```

### Migration Safety

- Migration runs on first access to flow
- Original data preserved in case of rollback
- Dual-resolution (slug + ID) during transition period
