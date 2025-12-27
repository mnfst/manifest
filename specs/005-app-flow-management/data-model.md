# Data Model: App & Flow Management

**Feature**: 005-app-flow-management
**Date**: 2025-12-26

## Overview

This feature uses existing entities (App, Flow, View) with minimal additions. The primary change is adding a `flowCount` computed field to the App response for efficient display in the app list.

## Entities

### App (Existing - No Schema Changes)

Represents an MCP server.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| name | string | Required, max 100 chars | Display name |
| description | string | Optional, max 500 chars | App description |
| slug | string | Unique, immutable | URL-friendly identifier |
| themeVariables | JSON | Required | Theme configuration |
| status | enum | 'draft' \| 'published' | Publication state |
| createdAt | datetime | Auto-generated | Creation timestamp |
| updatedAt | datetime | Auto-updated | Last modification |

**Relationships**:
- `flows`: One-to-Many → Flow (cascade delete)

**Validation Rules for Edit**:
- Name: Required, 1-100 characters
- Description: Optional, 0-500 characters
- Slug: Immutable (not editable)

### Flow (Existing - No Schema Changes)

Represents an MCP tool within an app.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| appId | UUID | FK → App.id | Parent app reference |
| name | string | Required, max 100 chars | Display name |
| description | string | Optional, max 500 chars | Flow description |
| toolName | string | Required, max 100 chars | MCP tool identifier |
| toolDescription | string | Required, max 500 chars | MCP tool description |
| isActive | boolean | Default: true | Tool visibility on MCP |
| createdAt | datetime | Auto-generated | Creation timestamp |
| updatedAt | datetime | Auto-updated | Last modification |

**Relationships**:
- `app`: Many-to-One → App (ON DELETE CASCADE)
- `views`: One-to-Many → View (cascade delete)

**Validation Rules for Edit**:
- Name: Required, 1-100 characters
- Description: Optional, 0-500 characters
- Tool Name: Required, 1-100 characters
- Tool Description: Required, 1-500 characters

### View (Existing - No Changes)

Display component within a flow. Cascade-deleted when parent flow is deleted.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| flowId | UUID | FK → Flow.id | Parent flow reference |
| name | string | Optional | View name |
| layoutTemplate | enum | 'table' \| 'post-list' | Display template |
| mockData | JSON | Required | UI component data |
| order | int | Default: 0 | Display order |
| createdAt | datetime | Auto-generated | Creation timestamp |
| updatedAt | datetime | Auto-updated | Last modification |

## Type Additions

### AppWithFlowCount (New Interface)

Extension of App interface for list views.

```typescript
export interface AppWithFlowCount extends App {
  flowCount: number;
}
```

**Usage**: Response type for `GET /api/apps` endpoint to include flow count.

### DeleteAppResponse (New Interface)

Response for app deletion confirmation.

```typescript
export interface DeleteAppResponse {
  success: boolean;
  deletedFlowCount: number;
}
```

**Usage**: Response type for `DELETE /api/apps/:appId` to inform user of cascade effects.

### FlowDeletionCheck (New Interface)

Pre-deletion validation response.

```typescript
export interface FlowDeletionCheck {
  canDelete: boolean;
  isLastFlow: boolean;
  appIsPublished: boolean;
  warningMessage?: string;
}
```

**Usage**: Optional endpoint or computed client-side to warn about last-flow deletion.

## State Transitions

### App Status

```
draft ──[publish]--> published
  ↑                      │
  └──[delete last flow]──┘ (auto-unpublish or warning)
```

**Transition Rules**:
- `draft → published`: Requires at least 1 flow
- `published → draft`: When last flow deleted (optional: auto-unpublish)

### Flow Lifecycle

```
created ──[edit]--> updated
    │                  │
    └───[delete]───────┘
           │
    [cascade delete views]
```

## Cascade Delete Behavior

### Delete App
1. All flows belonging to the app are deleted
2. All views belonging to each flow are deleted
3. If app was published, MCP endpoint becomes unavailable

### Delete Flow
1. All views belonging to the flow are deleted
2. If app was published, MCP tool becomes unavailable
3. If this was the last flow and app is published:
   - Option A: Auto-unpublish the app
   - Option B: Warn user but require manual unpublish

**Selected Approach**: Option B (warn user) - more explicit user control.

## Query Patterns

### Get Apps with Flow Count

```sql
SELECT
  a.*,
  COUNT(f.id) as flowCount
FROM apps a
LEFT JOIN flows f ON f.appId = a.id
GROUP BY a.id
ORDER BY a.createdAt DESC
```

**TypeORM Implementation**:
```typescript
this.appRepository
  .createQueryBuilder('app')
  .loadRelationCountAndMap('app.flowCount', 'app.flows')
  .orderBy('app.createdAt', 'DESC')
  .getMany();
```

### Check Last Flow Before Delete

```sql
SELECT COUNT(*) as flowCount
FROM flows
WHERE appId = :appId
```

If `flowCount === 1`, this is the last flow.

## Validation Summary

| Entity | Field | Rule | Error Message |
|--------|-------|------|---------------|
| App | name | Required | "App name is required" |
| App | name | Max 100 | "App name must be 100 characters or less" |
| App | description | Max 500 | "Description must be 500 characters or less" |
| Flow | name | Required | "Flow name is required" |
| Flow | name | Max 100 | "Flow name must be 100 characters or less" |
| Flow | toolName | Required | "Tool name is required" |
| Flow | toolName | Max 100 | "Tool name must be 100 characters or less" |
| Flow | toolDescription | Required | "Tool description is required" |
| Flow | toolDescription | Max 500 | "Tool description must be 500 characters or less" |

## Migration Notes

No database migrations required. Changes are:
1. TypeORM query to include flow count (no schema change)
2. New TypeScript interfaces in shared package
3. Backend service method additions

The existing `cascade: true` on relationships already handles cascade deletes.
