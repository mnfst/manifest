# API Contract: Node Types

**Feature**: 088-dynamic-node-library
**Date**: 2026-01-06

## Endpoint

```
GET /api/node-types
```

## Description

Returns all available node types with their metadata, grouped by category.

**No changes to this endpoint** - the contract remains the same. Only the data returned changes (CallFlow moves from 'action' to 'return' category).

## Response Schema

```typescript
interface NodeTypesResponse {
  nodeTypes: NodeTypeInfo[];
  categories: CategoryInfo[];
}

interface NodeTypeInfo {
  name: string;           // e.g., 'CallFlow'
  displayName: string;    // e.g., 'Call Flow'
  icon: string;           // e.g., 'git-branch'
  group: string[];        // e.g., ['flow', 'logic']
  category: NodeTypeCategory;  // 'trigger' | 'interface' | 'action' | 'return'
  description: string;
  inputs: string[];
  outputs: string[];
  defaultParameters: Record<string, unknown>;
}

interface CategoryInfo {
  id: NodeTypeCategory;
  displayName: string;
  order: number;
}
```

## Expected Response After Change

```json
{
  "nodeTypes": [
    {
      "name": "UserIntent",
      "displayName": "User Intent",
      "category": "trigger",
      "..."
    },
    {
      "name": "Interface",
      "displayName": "Agentic Interface",
      "category": "interface",
      "..."
    },
    {
      "name": "ApiCall",
      "displayName": "API Call",
      "category": "action",
      "..."
    },
    {
      "name": "Return",
      "displayName": "Return Value",
      "category": "return",
      "..."
    },
    {
      "name": "CallFlow",
      "displayName": "Call Flow",
      "category": "return",  // CHANGED from "action"
      "..."
    }
  ],
  "categories": [
    { "id": "trigger", "displayName": "Triggers", "order": 1 },
    { "id": "interface", "displayName": "Agentic Interfaces", "order": 2 },
    { "id": "action", "displayName": "Actions", "order": 3 },
    { "id": "return", "displayName": "Return Values", "order": 4 }
  ]
}
```

## Breaking Changes

**None** - The API contract structure is unchanged. Only the `category` value for CallFlow changes, which affects UI grouping only.
