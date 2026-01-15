# Data Model: Blank Component

**Feature**: 001-blank-component
**Date**: 2026-01-14

## Overview

This document defines the data structures for the Blank Component feature. The design extends existing types rather than introducing new entities.

---

## Type Extensions

### NodeType Enum

**Location**: `packages/shared/src/types/node.ts`

```typescript
export type NodeType =
  | 'BlankComponent'  // NEW
  | 'StatCard'
  | 'PostList'
  | 'Return'
  | 'CallFlow'
  | 'UserIntent'
  | 'ApiCall'
  | 'JavaScriptCodeTransform'
  | 'Link'
  | 'RegistryComponent';
```

### NodeTypeCategory Enum

**Location**: `packages/shared/src/types/node.ts`

```typescript
export type NodeTypeCategory =
  | 'blank'      // NEW - order: 0
  | 'trigger'    // order: 1
  | 'interface'  // order: 2
  | 'action'     // order: 3
  | 'return'     // order: 4
  | 'transform'; // order: 5
```

---

## Node Parameters

### BlankComponentNodeParameters

**Location**: `packages/shared/src/types/node.ts`

```typescript
/**
 * Parameters for BlankComponent nodes.
 * Follows the same structure as UINodeParameters for consistency.
 */
export interface BlankComponentNodeParameters {
  /**
   * User-customized TSX source code.
   * If undefined, BLANK_COMPONENT_DEFAULT_CODE is used.
   */
  customCode?: string;

  /**
   * Visual configuration derived from the component's
   * appearance prop interface. Auto-populated when user
   * modifies appearance options in the editor.
   */
  appearanceConfig?: AppearanceConfig;
}
```

### Storage in Flow Entity

BlankComponent nodes are stored in the `Flow.nodes` JSON array using the existing `NodeInstance` structure:

```typescript
interface NodeInstance {
  id: string;                              // UUID
  slug: string;                            // Auto-generated from name
  type: 'BlankComponent';                  // Node type discriminator
  name: string;                            // User-provided display name
  position: { x: number; y: number };      // Canvas position
  parameters: BlankComponentNodeParameters; // Type-specific data
}
```

---

## Template Data

### BLANK_COMPONENT_DEFAULT_CODE

**Location**: `packages/shared/src/types/templates.ts`

The default template code stored as a constant string. Contains:
- TypeScript interface with 4-argument pattern (data, appearance, control, actions)
- Comprehensive JSDoc comments explaining each argument
- "Hello World" default implementation
- Example usage patterns in comments

### BLANK_COMPONENT_SAMPLE_DATA

**Location**: `packages/shared/src/types/templates.ts`

Sample data object for preview rendering:

```typescript
export const BLANK_COMPONENT_SAMPLE_DATA = {
  message: 'Sample data from flow',
  items: ['Item 1', 'Item 2', 'Item 3'],
  count: 42,
};
```

---

## Category Configuration

### CategoryInfo

**Location**: `packages/backend/src/node/node.service.ts`

```typescript
interface CategoryInfo {
  id: NodeTypeCategory;
  displayName: string;
  order: number;
}

// New entry:
{ id: 'blank', displayName: 'Blank', order: 0 }
```

### Frontend Category Config

**Location**: `packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx`

```typescript
const CATEGORY_CONFIG: Record<NodeTypeCategory, {
  displayName: string;
  color: { bg: string; bgHover: string; text: string };
}> = {
  blank: {
    displayName: 'Blank',
    color: {
      bg: 'bg-amber-100',
      bgHover: 'bg-amber-200',
      text: 'text-amber-600'
    }
  },
  // ... existing categories
};
```

---

## Appearance Schema

### COMPONENT_APPEARANCE_REGISTRY Entry

**Location**: `packages/shared/src/types/appearance.ts`

```typescript
BlankComponent: {
  options: []  // Empty by default - auto-populated from code
}
```

Note: Appearance options are dynamically parsed from the user's TypeScript interface using `parseAppearanceOptions()` rather than statically defined.

---

## Execution Result

### BlankComponent Execute Output

```typescript
interface BlankComponentExecutionOutput {
  component: 'BlankComponent';
  code: string;           // Compiled/customized code
  appearance: AppearanceConfig;
  data: unknown;          // Input from previous node
}
```

---

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| name | Required, non-empty | "Node name is required" |
| name | Unique within flow | "A node with this name already exists" |
| customCode | Valid TSX syntax | Syntax error displayed in preview |
| customCode | Must export default function | "Component must have a default export" |

---

## State Transitions

BlankComponent nodes don't have explicit state transitions. They follow the standard node lifecycle:

1. **Created**: Added to flow with default template
2. **Edited**: User modifies code/appearance in InterfaceEditor
3. **Executed**: Renders component with flow data during execution
4. **Deleted**: Removed from flow (with connection cleanup)

---

## Relationships

```
Flow (1) ──────────────── (N) NodeInstance
                              └── type: 'BlankComponent'
                              └── parameters: BlankComponentNodeParameters

BlankComponent ─────────────── InterfaceEditor (UI)
     │                              └── Code tab
     │                              └── Appearance tab
     │                              └── Preview tab
     │
     └──────────────────── ComponentPreview (Rendering)
                               └── Sucrase compilation
                               └── React rendering
```
