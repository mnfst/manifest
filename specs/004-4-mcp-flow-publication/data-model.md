# Data Model: MCP Flow Publication

**Feature**: 004-4-mcp-flow-publication
**Date**: 2025-12-26

## Entity Changes

### Flow (Modified)

Add `isActive` field to control tool visibility on MCP server.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | UUID | auto | Primary key |
| appId | UUID | required | Foreign key to App |
| name | string(100) | required | Display name |
| description | string(500) | null | Optional description |
| toolName | string(100) | required | MCP tool identifier |
| toolDescription | string(500) | required | Tool description for MCP clients |
| **isActive** | **boolean** | **true** | **NEW: Whether tool is visible on MCP server** |
| createdAt | timestamp | auto | Creation timestamp |
| updatedAt | timestamp | auto | Last update timestamp |

**Migration**: Add column `is_active BOOLEAN DEFAULT true NOT NULL`

### App (Existing - No Changes)

Uses existing `status` field for publication control.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | UUID | auto | Primary key |
| name | string(100) | required | App name |
| description | string(500) | null | Optional description |
| slug | string | required, unique | URL-safe identifier |
| themeVariables | JSON | required | Theme configuration |
| status | 'draft' \| 'published' | 'draft' | Publication status |
| createdAt | timestamp | auto | Creation timestamp |
| updatedAt | timestamp | auto | Last update timestamp |

## TypeScript Interfaces

### Flow Interface (shared/src/types/flow.ts)

```typescript
export interface Flow {
  id: string;
  appId: string;
  name: string;
  description?: string;
  toolName: string;
  toolDescription: string;
  isActive: boolean;  // NEW
  views?: View[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateFlowRequest {
  name?: string;
  description?: string;
  toolName?: string;
  toolDescription?: string;
  isActive?: boolean;  // NEW
}
```

## State Transitions

### Flow isActive

```
Created → isActive: true (default)
    ↓ User toggles off
isActive: false
    ↓ User toggles on
isActive: true
```

### App status

```
Created → status: 'draft' (default)
    ↓ User publishes
status: 'published'
    ↓ User unpublishes
status: 'draft'
```

## Validation Rules

1. **isActive**: Must be boolean (true/false)
2. **status**: Must be one of 'draft' or 'published'
3. **slug**: Must be unique across all apps

## Relationships

```
App (1) ←→ (N) Flow
  - App.status controls MCP server visibility
  - Flow.isActive controls individual tool visibility
  - MCP server shows tools where: App.status = 'published' AND Flow.isActive = true
```
