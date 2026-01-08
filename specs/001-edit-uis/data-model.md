# Data Model: Editable UI Interfaces

**Branch**: `001-edit-uis` | **Date**: 2026-01-07

## Overview

This feature extends the existing Interface node to support custom component code. The primary data change is adding a `customCode` field to the Interface node parameters.

---

## Entity Changes

### InterfaceNodeParameters (Extended)

**Location**: `packages/shared/src/types/node.ts`

```typescript
export interface InterfaceNodeParameters {
  /** The base layout template type */
  layoutTemplate: LayoutTemplate;

  /** Custom component code (TSX). If present, overrides the default template rendering */
  customCode?: string;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| layoutTemplate | `'table' \| 'post-list'` | Yes | Base template type |
| customCode | `string` | No | User-customized TSX component code |

**Behavior**:
- If `customCode` is undefined or empty: Use default template code from registry
- If `customCode` has a value: Use the custom code for rendering

**Validation Rules**:
- `customCode` must be valid TSX syntax (validated client-side before save)
- `customCode` must not be empty string (either undefined or has content)
- `customCode` max length: 50,000 characters (reasonable limit for component code)

---

### LayoutTemplateConfig (Extended)

**Location**: `packages/shared/src/types/app.ts`

```typescript
export interface LayoutTemplateConfig {
  manifestBlock: string;
  installCommand: string;
  useCase: string;
  actions: LayoutAction[];

  /** Default component code for this template (TSX) */
  defaultCode: string;

  /** Sample data for preview rendering */
  sampleData: unknown;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| defaultCode | `string` | Yes | Default TSX component code |
| sampleData | `unknown` | Yes | Sample data for preview |

---

## New Types

### ValidationError

**Location**: `packages/shared/src/types/validation.ts` (new file)

```typescript
export interface ValidationError {
  /** Line number (1-indexed) */
  line: number;

  /** Column number (1-indexed) */
  column: number;

  /** Error message */
  message: string;

  /** Error severity */
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  /** Whether the code is valid */
  isValid: boolean;

  /** List of errors/warnings found */
  errors: ValidationError[];
}
```

---

### EditorState (Frontend Only)

**Location**: `packages/frontend/src/types/editor.ts` (new file)

```typescript
export interface EditorState {
  /** The node being edited */
  nodeId: string;

  /** Flow ID the node belongs to */
  flowId: string;

  /** Current code in editor (may differ from saved) */
  code: string;

  /** Whether there are unsaved changes */
  isDirty: boolean;

  /** Current validation errors */
  errors: ValidationError[];

  /** Active view mode */
  viewMode: 'preview' | 'code';
}
```

---

## Data Flow

### Storage Path
```
Database (SQLite)
  └── flows table
        └── nodes column (JSON array)
              └── NodeInstance
                    └── parameters: InterfaceNodeParameters
                          └── customCode: string
```

### Update Flow
1. User edits code in CodeMirror editor
2. Code validated on every change (debounced)
3. User clicks Save
4. Final validation performed
5. If valid: PATCH `/api/flows/:flowId/nodes/:nodeId` with updated parameters
6. Backend updates node in flow's JSON nodes array
7. Flow entity saved to database

---

## Sample Data Definitions

### Table Template Sample Data
```typescript
const tableSampleData = [
  { id: 1, name: 'Product A', price: 29.99, status: 'Active' },
  { id: 2, name: 'Product B', price: 49.99, status: 'Pending' },
  { id: 3, name: 'Product C', price: 19.99, status: 'Active' },
  { id: 4, name: 'Service X', price: 99.99, status: 'Inactive' },
  { id: 5, name: 'Service Y', price: 149.99, status: 'Active' },
];
```

### Post-List Template Sample Data
```typescript
const postListSampleData = [
  {
    id: '1',
    title: 'Getting Started Guide',
    excerpt: 'Learn the basics of using our platform with this comprehensive guide.',
    coverImage: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    author: { name: 'Jane Smith', avatar: 'https://i.pravatar.cc/150?u=jane' },
    publishedAt: '2024-01-15',
    readTime: '5 min read',
    tags: ['Tutorial', 'Beginner'],
    category: 'Tutorial'
  },
  {
    id: '2',
    title: 'Advanced Features',
    excerpt: 'Discover advanced capabilities to supercharge your workflow.',
    coverImage: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800',
    author: { name: 'John Doe', avatar: 'https://i.pravatar.cc/150?u=john' },
    publishedAt: '2024-01-12',
    readTime: '8 min read',
    tags: ['Advanced', 'Features'],
    category: 'Guide'
  },
  {
    id: '3',
    title: 'Best Practices',
    excerpt: 'Follow these best practices to get the most out of the platform.',
    coverImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    author: { name: 'Alex Chen', avatar: 'https://i.pravatar.cc/150?u=alex' },
    publishedAt: '2024-01-10',
    readTime: '6 min read',
    tags: ['Tips', 'Productivity'],
    category: 'Tips'
  }
];
```

---

## Migration Notes

### Backward Compatibility
- Existing Interface nodes without `customCode` continue to work (use default template)
- No database migration required (JSON column accepts new fields)
- Frontend gracefully handles nodes without `customCode`

### Default Behavior
- New Interface nodes: `customCode` is undefined
- Opening editor: Shows default template code from registry
- First edit: `customCode` gets populated on save
- Resetting to default: Set `customCode` to undefined (future enhancement)
