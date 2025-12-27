# Data Model: MCP App and Flow Data Architecture

**Feature Branch**: `002-mcp-server-flow`
**Date**: 2025-12-26

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                              App                                │
│─────────────────────────────────────────────────────────────────│
│ id: UUID (PK)                                                   │
│ name: string (required, max 100)                                │
│ description: string (optional)                                  │
│ slug: string (unique, URL-safe)                                 │
│ themeVariables: ThemeVariables (JSON)                           │
│ status: 'draft' | 'published'                                   │
│ createdAt: timestamp                                            │
│ updatedAt: timestamp                                            │
├─────────────────────────────────────────────────────────────────┤
│                         1:N → flows                             │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ 1:N
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                             Flow                                │
│─────────────────────────────────────────────────────────────────│
│ id: UUID (PK)                                                   │
│ appId: UUID (FK → App.id, required)                             │
│ name: string (required, max 100)                                │
│ description: string (optional)                                  │
│ toolName: string (MCP tool identifier)                          │
│ toolDescription: string (MCP tool description)                  │
│ createdAt: timestamp                                            │
│ updatedAt: timestamp                                            │
├─────────────────────────────────────────────────────────────────┤
│                         1:N → views                             │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ 1:N
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                             View                                │
│─────────────────────────────────────────────────────────────────│
│ id: UUID (PK)                                                   │
│ flowId: UUID (FK → Flow.id, required)                           │
│ name: string (optional, for display)                            │
│ layoutTemplate: 'table' | 'post-list'                           │
│ mockData: MockData (JSON - TableMockData | PostListMockData)    │
│ order: integer (position in flow, default 0)                    │
│ createdAt: timestamp                                            │
│ updatedAt: timestamp                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Entity Definitions

### App Entity

The top-level container representing an MCP server.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| name | string | Required, max 100 chars | Display name for the app |
| description | string | Optional | Description of the app's purpose |
| slug | string | Unique, URL-safe | URL path segment for accessing the app |
| themeVariables | JSON (ThemeVariables) | Required, defaults to system theme | HSL-based CSS variables for theming |
| status | enum | 'draft' \| 'published', default 'draft' | Publication state |
| createdAt | timestamp | Auto-set on create | Creation timestamp |
| updatedAt | timestamp | Auto-set on update | Last modification timestamp |

**Relationships**:
- `flows`: One-to-Many → Flow (cascade delete)

**Validation Rules**:
- `name`: Non-empty, trimmed
- `slug`: Lowercase, alphanumeric + hyphens only, auto-generated from name
- `themeVariables`: Must contain required HSL CSS variables

**State Transitions**:
- `draft` → `published`: Requires at least one flow with at least one view
- `published` → `draft`: Allowed (unpublish)

---

### Flow Entity

Represents an MCP tool belonging to an app.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| appId | UUID | FK → App.id, required | Parent app reference |
| name | string | Required, max 100 chars | Display name for the flow/tool |
| description | string | Optional | Description of what this tool does |
| toolName | string | Required, generated | MCP tool identifier (snake_case) |
| toolDescription | string | Required, generated | MCP tool description for LLM |
| createdAt | timestamp | Auto-set on create | Creation timestamp |
| updatedAt | timestamp | Auto-set on update | Last modification timestamp |

**Relationships**:
- `app`: Many-to-One → App
- `views`: One-to-Many → View (cascade delete)

**Validation Rules**:
- `name`: Non-empty, trimmed
- `toolName`: Valid MCP tool identifier format (lowercase, underscores)
- Must belong to an existing app

**Business Rules**:
- A flow must have at least one view (enforced on view deletion, not creation)
- Deleting a flow deletes all its views (cascade)

---

### View Entity

A display unit within a flow, containing layout and data configuration.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| flowId | UUID | FK → Flow.id, required | Parent flow reference |
| name | string | Optional, max 100 chars | Display name for the view |
| layoutTemplate | enum | 'table' \| 'post-list', required | UI layout type |
| mockData | JSON (MockData) | Required | Sample data matching layoutTemplate |
| order | integer | Default 0 | Position in the flow's view sequence |
| createdAt | timestamp | Auto-set on create | Creation timestamp |
| updatedAt | timestamp | Auto-set on update | Last modification timestamp |

**Relationships**:
- `flow`: Many-to-One → Flow

**Validation Rules**:
- `layoutTemplate`: Must be valid enum value
- `mockData`: Must match the structure for the selected layoutTemplate
- `order`: Non-negative integer

**Business Rules**:
- Cannot delete the last view of a flow (minimum 1 view per flow)
- Order values should be unique within a flow (reordering updates all affected views)

---

## Type Definitions (Shared Package)

### App Types (`shared/src/types/app.ts`)

```typescript
export interface App {
  id: string;
  name: string;
  description?: string;
  slug: string;
  themeVariables: ThemeVariables;
  status: AppStatus;
  createdAt: string;
  updatedAt: string;
}

export type AppStatus = 'draft' | 'published';

export interface CreateAppRequest {
  name: string;
  description?: string;
  themeVariables?: Partial<ThemeVariables>;
}

export interface UpdateAppRequest {
  name?: string;
  description?: string;
  themeVariables?: Partial<ThemeVariables>;
}
```

### Flow Types (`shared/src/types/flow.ts`)

```typescript
export interface Flow {
  id: string;
  appId: string;
  name: string;
  description?: string;
  toolName: string;
  toolDescription: string;
  views?: View[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlowRequest {
  appId: string;
  prompt: string; // Natural language description for AI generation
}

export interface UpdateFlowRequest {
  name?: string;
  description?: string;
  toolName?: string;
  toolDescription?: string;
}

export interface GenerateFlowResponse {
  flow: Flow;
  redirectTo: string; // URL to flow editor
}
```

### View Types (`shared/src/types/view.ts`)

```typescript
import { LayoutTemplate, MockData } from './mock-data';

export interface View {
  id: string;
  flowId: string;
  name?: string;
  layoutTemplate: LayoutTemplate;
  mockData: MockData;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateViewRequest {
  flowId: string;
  name?: string;
  layoutTemplate: LayoutTemplate;
  mockData?: MockData; // Optional - defaults based on layoutTemplate
}

export interface UpdateViewRequest {
  name?: string;
  layoutTemplate?: LayoutTemplate;
  mockData?: MockData;
}

export interface ReorderViewsRequest {
  flowId: string;
  viewIds: string[]; // Ordered array of view IDs
}
```

---

## Migration from Current Model

### Fields Removed from App Entity

The following fields move from App to View:
- `layoutTemplate` → View.layoutTemplate
- `mockData` → View.mockData
- `systemPrompt` → Removed (no longer applicable)
- `toolName` → Flow.toolName
- `toolDescription` → Flow.toolDescription
- `mcpSlug` → Derived from App.slug + Flow.toolName

### Data Migration Strategy (POC)

For POC with fresh sessions, no data migration is needed. The database auto-syncs schema on startup (TypeORM synchronize: true).

If existing data preservation were required:
1. Create new Flow for each existing App
2. Create new View with App's layoutTemplate and mockData
3. Copy toolName/toolDescription to Flow
4. Remove deprecated columns from App

---

## Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| apps | apps_slug_idx | slug | Fast lookup by slug for URL routing |
| flows | flows_app_id_idx | appId | Fast lookup of flows by app |
| views | views_flow_id_order_idx | flowId, order | Fast ordered retrieval of views |
