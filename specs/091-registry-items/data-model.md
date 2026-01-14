# Data Model: Registry-Based UI Nodes

**Feature**: 091-registry-items
**Date**: 2026-01-13

## Overview

This feature introduces registry-based UI components to replace static interface nodes. The data model focuses on three areas:
1. Registry data structures (external API)
2. Node instance storage (database)
3. Frontend state management

## Entities

### External: Registry Response

**Source**: `https://ui.manifest.build/r/registry.json`

```typescript
/**
 * Top-level registry response
 */
interface RegistryResponse {
  $schema: string;
  name: string;
  homepage: string;
  items: RegistryItem[];
}

/**
 * Registry item from the list endpoint
 * Contains metadata only (no file contents)
 */
interface RegistryItem {
  name: string;                    // Unique identifier, e.g., "post-card"
  version: string;                 // Semantic version, e.g., "2.0.2"
  type: string;                    // Registry type, e.g., "registry:block"
  title: string;                   // Display name, e.g., "Post Card"
  description: string;             // Component description
  category: RegistryCategory;      // Category for grouping
  dependencies: string[];          // NPM package dependencies
  registryDependencies: string[];  // Dependencies on other registry items
  files: FileMetadata[];           // File paths only (no content)
}

/**
 * File metadata in list response
 */
interface FileMetadata {
  path: string;   // e.g., "registry/blogging/post-card.tsx"
  type: string;   // e.g., "registry:component"
}
```

### External: Component Detail Response

**Source**: `https://ui.manifest.build/r/{name}.json`

```typescript
/**
 * Full component detail including source code
 */
interface ComponentDetail {
  $schema: string;
  name: string;
  version: string;
  type: string;
  title: string;
  description: string;
  category: RegistryCategory;
  dependencies: string[];
  registryDependencies: string[];
  changelog?: Record<string, string>;  // Version history
  files: ComponentFile[];              // Full file content
}

/**
 * File with full source code
 */
interface ComponentFile {
  path: string;    // e.g., "registry/blogging/post-card.tsx"
  type: string;    // e.g., "registry:component"
  content: string; // Full source code
}
```

### Type: Registry Category

```typescript
/**
 * Known categories from the registry
 * Categories are dynamic and may change over time
 */
type RegistryCategory =
  | 'form'
  | 'payment'
  | 'list'
  | 'blogging'
  | 'messaging'
  | 'events'
  | 'miscellaneous'
  | string;  // Allow unknown categories
```

### Internal: Node Instance (Modified)

**Storage**: JSON in `flows.nodes` column

```typescript
/**
 * Node instance for registry components
 * Stored in Flow.nodes JSON array
 */
interface RegistryNodeInstance {
  id: string;                      // UUID
  slug: string;                    // Auto-generated slug, e.g., "post_card_1"
  type: 'RegistryComponent';       // Fixed type for all registry items
  name: string;                    // User-editable display name
  position: { x: number; y: number };
  parameters: RegistryNodeParameters;
}

/**
 * Parameters for registry component nodes
 * Contains full component data for offline support
 */
interface RegistryNodeParameters {
  // Core identity
  registryName: string;            // e.g., "post-card"
  version: string;                 // e.g., "2.0.2"

  // Display metadata
  title: string;                   // e.g., "Post Card"
  description: string;
  category: RegistryCategory;

  // Dependencies
  dependencies: string[];          // NPM packages
  registryDependencies: string[];  // Other registry items

  // Source code (for rendering)
  files: ComponentFile[];

  // Optional component configuration
  variant?: string;                // Component variant if applicable
  customProps?: Record<string, unknown>; // Component-specific props
}
```

### Internal: Category Info (Extended)

```typescript
/**
 * Extended category info to support registry sub-categories
 */
interface CategoryInfo {
  id: NodeTypeCategory;
  displayName: string;
  order: number;
}

/**
 * Registry category for UI node library
 */
interface RegistryCategoryInfo {
  id: string;                      // e.g., "blogging"
  displayName: string;             // e.g., "Blogging"
  itemCount: number;               // Number of items in category
  order: number;                   // Display order (from registry)
}
```

## Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    External Registry                         │
├─────────────────────────────────────────────────────────────┤
│  RegistryResponse                                           │
│    └── items: RegistryItem[]                                │
│          └── (fetch detail) → ComponentDetail               │
│                                  └── files: ComponentFile[] │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Transform & Store
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Internal Database                         │
├─────────────────────────────────────────────────────────────┤
│  FlowEntity                                                  │
│    └── nodes: NodeInstance[]                                │
│          └── (type: 'RegistryComponent')                    │
│                └── parameters: RegistryNodeParameters       │
│                      └── files: ComponentFile[]             │
└─────────────────────────────────────────────────────────────┘
```

## State Transitions

### Registry Fetch Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Idle      │────▶│   Loading    │────▶│   Loaded     │
│              │     │  (skeleton)  │     │  (items)     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            │ Error              │ Refresh
                            ▼                    │
                     ┌──────────────┐            │
                     │    Error     │────────────┘
                     │  (message)   │   (re-click)
                     └──────────────┘
```

### Component Add Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Selected    │────▶│  Fetching    │────▶│   Added      │
│  (click)     │     │  (detail)    │     │  (to canvas) │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            │ Error
                            ▼
                     ┌──────────────┐
                     │    Error     │
                     │  (toast)     │
                     └──────────────┘
```

## Validation Rules

### Registry Data

| Field | Rule |
|-------|------|
| `name` | Required, non-empty string |
| `version` | Required, semver format |
| `title` | Required, fallback to `name` if missing |
| `description` | Optional, default: "No description" |
| `category` | Required, string |
| `files` | Required for ComponentDetail, array |

### Node Instance

| Field | Rule |
|-------|------|
| `type` | Must be `'RegistryComponent'` |
| `parameters.registryName` | Required, matches original `name` |
| `parameters.version` | Required, preserved from fetch |
| `parameters.files` | Required, at least one file |

## Migration Notes

### Deleted Types

The following node types are removed:

| Type | Replacement |
|------|-------------|
| `StatCard` | `RegistryComponent` with matching registry item |
| `PostList` | `RegistryComponent` with matching registry item |

### Database Migration

```sql
-- Delete flows containing old interface nodes
DELETE FROM flows
WHERE nodes LIKE '%"type":"StatCard"%'
   OR nodes LIKE '%"type":"PostList"%';
```

### Code Cleanup

Files to delete:
- `packages/nodes/src/nodes/interface/StatCardNode.ts`
- `packages/nodes/src/nodes/interface/PostListNode.ts`
- `packages/nodes/src/nodes/interface/index.ts`

Exports to remove from `packages/nodes/src/nodes/index.ts`:
- `StatCard`
- `PostList`
- `interfaceNodes` export
