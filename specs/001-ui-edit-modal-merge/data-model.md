# Data Model: UI Node Edit Modal Consolidation

**Feature Branch**: `001-ui-edit-modal-merge`
**Date**: 2026-01-08

## Entity Changes

### UINodeParameters (Modified)

**Location**: `packages/shared/src/types/node.ts`

**Before**:
```typescript
export interface StatCardNodeParameters {
  layoutTemplate: LayoutTemplate;
  customCode?: string;
}
```

**After**:
```typescript
export interface UINodeParameters {
  customCode?: string;
  appearanceConfig?: AppearanceConfig;
}

export type AppearanceConfig = Record<string, AppearanceValue>;
export type AppearanceValue = string | number | boolean;
```

**Changes**:
- Removed `layoutTemplate` field (deprecated)
- Added `appearanceConfig` for storing appearance options
- Renamed from `StatCardNodeParameters` to `UINodeParameters` for clarity

---

## New Types

### AppearanceOptionSchema

**Location**: `packages/shared/src/types/appearance.ts` (new file)

```typescript
/**
 * Defines the schema for a single appearance option
 */
export interface AppearanceOptionSchema {
  /** Option identifier (e.g., 'variant', 'showAuthor') */
  key: string;

  /** Display label for the form */
  label: string;

  /** Type of form control to render */
  type: 'enum' | 'boolean' | 'string' | 'number';

  /** For enum type: available values */
  enumValues?: (string | number)[];

  /** Default value if not configured */
  defaultValue: AppearanceValue;

  /** Optional description/help text */
  description?: string;
}

/**
 * Appearance schema for a component type
 */
export interface ComponentAppearanceSchema {
  /** Component identifier */
  componentType: string;

  /** Available appearance options */
  options: AppearanceOptionSchema[];
}
```

### ComponentAppearanceRegistry

**Location**: `packages/shared/src/types/appearance.ts`

```typescript
/**
 * Registry of appearance schemas by component type
 */
export const COMPONENT_APPEARANCE_REGISTRY: Record<string, ComponentAppearanceSchema> = {
  'PostList': {
    componentType: 'PostList',
    options: [
      {
        key: 'variant',
        label: 'Layout Variant',
        type: 'enum',
        enumValues: ['list', 'grid', 'carousel'],
        defaultValue: 'list',
        description: 'How posts are arranged'
      },
      {
        key: 'columns',
        label: 'Columns',
        type: 'enum',
        enumValues: [2, 3],
        defaultValue: 3,
        description: 'Number of columns in grid/carousel view'
      },
      {
        key: 'showAuthor',
        label: 'Show Author',
        type: 'boolean',
        defaultValue: true,
        description: 'Display author name and avatar'
      },
      {
        key: 'showCategory',
        label: 'Show Category',
        type: 'boolean',
        defaultValue: true,
        description: 'Display post category badge'
      }
    ]
  },

  'ProductList': {
    componentType: 'ProductList',
    options: [
      {
        key: 'variant',
        label: 'Layout Variant',
        type: 'enum',
        enumValues: ['list', 'grid', 'carousel', 'picker'],
        defaultValue: 'grid'
      },
      {
        key: 'columns',
        label: 'Columns',
        type: 'enum',
        enumValues: [2, 3],
        defaultValue: 3
      }
    ]
  },

  'OptionList': {
    componentType: 'OptionList',
    options: [
      {
        key: 'selectable',
        label: 'Selection Mode',
        type: 'enum',
        enumValues: ['single', 'multiple'],
        defaultValue: 'single',
        description: 'Allow single or multiple selections'
      }
    ]
  },

  'TagSelect': {
    componentType: 'TagSelect',
    options: [
      {
        key: 'multiSelect',
        label: 'Multi-Select',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow selecting multiple tags'
      }
    ]
  },

  'ProgressSteps': {
    componentType: 'ProgressSteps',
    options: [
      {
        key: 'layout',
        label: 'Layout',
        type: 'enum',
        enumValues: ['horizontal', 'vertical'],
        defaultValue: 'horizontal'
      }
    ]
  },

  'StatusBadge': {
    componentType: 'StatusBadge',
    options: [
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        enumValues: ['success', 'pending', 'processing', 'error', 'shipped', 'delivered'],
        defaultValue: 'pending'
      }
    ]
  },

  'PostCard': {
    componentType: 'PostCard',
    options: [
      {
        key: 'variant',
        label: 'Variant',
        type: 'enum',
        enumValues: ['default', 'compact', 'horizontal', 'covered'],
        defaultValue: 'default'
      }
    ]
  },

  'Table': {
    componentType: 'Table',
    options: [
      {
        key: 'selectable',
        label: 'Row Selection',
        type: 'enum',
        enumValues: ['none', 'single', 'multi'],
        defaultValue: 'none'
      },
      {
        key: 'compact',
        label: 'Compact Mode',
        type: 'boolean',
        defaultValue: false,
        description: 'Reduce row height'
      },
      {
        key: 'stickyHeader',
        label: 'Sticky Header',
        type: 'boolean',
        defaultValue: false,
        description: 'Keep header visible when scrolling'
      }
    ]
  },

  // Stats component has no configurable appearance options
  'Stats': {
    componentType: 'Stats',
    options: []
  },

  // Default for StatCard (current UI node type)
  'StatCard': {
    componentType: 'StatCard',
    options: []
  }
};
```

---

## State Management

### EditorState (Frontend)

**Location**: `packages/frontend/src/components/editor/InterfaceEditor.tsx`

```typescript
interface EditorState {
  // General tab
  nodeName: string;

  // Appearance tab
  appearanceConfig: AppearanceConfig;

  // Code tab
  customCode: string;

  // Track unsaved changes
  isDirty: boolean;
}
```

---

## Validation Rules

### Appearance Config
- Keys must match defined schema options for the component type
- Values must match the type specified in the schema
- Enum values must be one of the allowed values
- Boolean values must be true or false
- Missing optional values use schema defaults

### Node Name
- Required, non-empty string
- Maximum 100 characters
- No validation on characters (allow any)

---

## Migration Strategy

### Existing Nodes with layoutTemplate

No data migration required. Strategy:

1. Frontend ignores `layoutTemplate` field when reading node parameters
2. Frontend does not include `layoutTemplate` when saving
3. Existing nodes continue to work - the field is simply unused
4. Over time, as nodes are edited and saved, `layoutTemplate` will naturally be removed

### Database Schema

No changes to Flow entity. Nodes are stored as JSON in `simple-json` column, which accepts any structure.

---

## Relationships

```
Flow (1) ──────> (*) NodeInstance
                      │
                      └── parameters: UINodeParameters
                                       │
                                       ├── customCode?: string
                                       └── appearanceConfig?: AppearanceConfig
                                                              │
                                                              └── [key]: AppearanceValue

ComponentAppearanceRegistry ──────> ComponentAppearanceSchema
                                              │
                                              └── options: AppearanceOptionSchema[]
```

---

## Type Exports

**From `packages/shared/src/types/appearance.ts`**:
```typescript
export type { AppearanceOptionSchema, ComponentAppearanceSchema };
export type { AppearanceConfig, AppearanceValue };
export { COMPONENT_APPEARANCE_REGISTRY };
```

**From `packages/shared/src/types/node.ts`**:
```typescript
export type { UINodeParameters };
// Remove: StatCardNodeParameters, LayoutTemplate references
```
