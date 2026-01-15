# Quickstart: Blank Component

**Feature**: 001-blank-component
**Date**: 2026-01-14

## Overview

This quickstart guides developers through implementing the Blank Component feature. Follow the phases in order.

---

## Prerequisites

- Node.js >= 18.0.0
- pnpm installed
- Repository cloned and dependencies installed (`pnpm install`)

---

## Phase 1: Type Definitions

### 1.1 Add NodeTypeCategory

**File**: `packages/shared/src/types/node.ts`

Add 'blank' to the NodeTypeCategory type (around line 25):

```typescript
export type NodeTypeCategory =
  | 'blank'      // Add this first
  | 'trigger'
  | 'interface'
  | 'action'
  | 'return'
  | 'transform';
```

### 1.2 Add NodeType

**File**: `packages/shared/src/types/node.ts`

Add 'BlankComponent' to the NodeType union (around line 34):

```typescript
export type NodeType =
  | 'BlankComponent'  // Add this
  | 'StatCard'
  | 'PostList'
  // ... rest of types
```

### 1.3 Add Parameters Interface

**File**: `packages/shared/src/types/node.ts`

Add the BlankComponent parameters interface:

```typescript
export interface BlankComponentNodeParameters {
  customCode?: string;
  appearanceConfig?: AppearanceConfig;
}
```

---

## Phase 2: Template Code

### 2.1 Create Default Template

**File**: `packages/shared/src/types/templates.ts`

Add the default code constant and sample data:

```typescript
export const BLANK_COMPONENT_DEFAULT_CODE = `/**
 * Blank Component Template
 *
 * This component follows the Manifest UI 4-argument pattern.
 * Customize this template to create your own UI component.
 */

interface BlankComponentProps {
  /**
   * DATA: Input from the flow execution
   * This is the primary data your component will display or process.
   * Access nested properties safely: data?.property ?? defaultValue
   */
  data: unknown;

  /**
   * APPEARANCE: Visual customization options
   * Define typed options here and they'll auto-appear in the Appearance panel.
   * Supported types: boolean, string, number, or union literals ('a' | 'b')
   *
   * Example:
   *   variant?: 'default' | 'outlined';
   *   showBorder?: boolean;
   *   padding?: number;
   */
  appearance?: {
    // Add your appearance options here
  };

  /**
   * CONTROL: Behavior and state control
   * Use for component configuration that affects behavior, not visuals.
   *
   * Example:
   *   disabled?: boolean;
   *   readOnly?: boolean;
   *   maxItems?: number;
   */
  control?: {
    // Add your control options here
  };

  /**
   * ACTIONS: Event callbacks
   * Define functions the component can call to trigger flow actions.
   * These connect your component to the broader flow.
   *
   * Example:
   *   onClick?: () => void;
   *   onSubmit?: (value: string) => void;
   *   onItemSelect?: (item: unknown) => void;
   */
  actions?: {
    // Add your action callbacks here
  };
}

export default function BlankComponent({
  data,
  appearance = {},
  control = {},
  actions = {}
}: BlankComponentProps) {
  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        Hello World
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        Edit this component to create your own UI.
        Check the comments above for the 4-argument pattern.
      </p>
      {data && (
        <pre className="mt-4 p-2 bg-gray-50 rounded text-xs overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
`;

export const BLANK_COMPONENT_SAMPLE_DATA = {
  message: 'Sample data from flow',
  items: ['Item 1', 'Item 2', 'Item 3'],
  count: 42,
};
```

### 2.2 Update Template Helpers

**File**: `packages/shared/src/types/templates.ts`

Add 'blank-component' to the LayoutTemplate type and helper functions:

```typescript
export type LayoutTemplate = 'stat-card' | 'post-list' | 'blank-component';

export function getTemplateDefaultCode(template: LayoutTemplate): string {
  switch (template) {
    case 'blank-component':
      return BLANK_COMPONENT_DEFAULT_CODE;
    // ... existing cases
  }
}

export function getTemplateSampleData(template: LayoutTemplate): unknown {
  switch (template) {
    case 'blank-component':
      return BLANK_COMPONENT_SAMPLE_DATA;
    // ... existing cases
  }
}
```

---

## Phase 3: Backend Node Definition

### 3.1 Create Node Definition

**File**: `packages/nodes/src/nodes/interface/BlankComponentNode.ts` (new file)

```typescript
import { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types';
import { BLANK_COMPONENT_DEFAULT_CODE } from '@generator/shared';

export const BlankComponentNode: NodeTypeDefinition = {
  name: 'BlankComponent',
  displayName: 'Blank Component',
  icon: 'square',
  group: ['ui', 'custom'],
  category: 'blank',
  description: 'Create your own custom UI component with the 4-argument pattern',
  inputs: ['main'],
  outputs: ['main'],
  defaultParameters: {},
  inputSchema: { type: 'object', additionalProperties: true },
  outputSchema: { type: 'object', additionalProperties: true },

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { customCode, appearanceConfig } = context.node.parameters as {
      customCode?: string;
      appearanceConfig?: Record<string, unknown>;
    };

    return {
      success: true,
      output: {
        component: 'BlankComponent',
        code: customCode || BLANK_COMPONENT_DEFAULT_CODE,
        appearance: appearanceConfig || {},
        data: context.input,
      },
    };
  },
};
```

### 3.2 Register Node

**File**: `packages/nodes/src/nodes/index.ts`

Import and register the BlankComponent:

```typescript
import { BlankComponentNode } from './interface/BlankComponentNode';

// Add to builtInNodes map
builtInNodes.set('BlankComponent', BlankComponentNode);

// Add to builtInNodeList array
builtInNodeList.push(BlankComponentNode);
```

### 3.3 Add Category

**File**: `packages/backend/src/node/node.service.ts`

Add the 'blank' category to the categories array (around line 64):

```typescript
const categories: CategoryInfo[] = [
  { id: 'blank', displayName: 'Blank', order: 0 },  // Add first
  { id: 'trigger', displayName: 'Triggers', order: 1 },
  { id: 'interface', displayName: 'UI Components', order: 2 },
  { id: 'action', displayName: 'Actions', order: 3 },
  { id: 'transform', displayName: 'Transform', order: 4 },
  { id: 'return', displayName: 'Return Values', order: 5 },
];
```

---

## Phase 4: Frontend Integration

### 4.1 Add Category Config

**File**: `packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx`

Add 'blank' to CATEGORY_CONFIG (around line 36):

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
      text: 'text-amber-600',
    },
  },
  // ... existing categories
};
```

### 4.2 Create Canvas Node Component (Optional)

**File**: `packages/frontend/src/components/flow/BlankComponentNode.tsx` (new file)

If needed, create a dedicated canvas component. Otherwise, configure NodeLibrary to use existing patterns for BlankComponent nodes.

### 4.3 Wire Up InterfaceEditor

Ensure that when a BlankComponent node is edited, InterfaceEditor opens with:
- `initialCode`: node.parameters.customCode or BLANK_COMPONENT_DEFAULT_CODE
- `componentType`: 'BlankComponent'

---

## Phase 5: Verification

### 5.1 Build Check

```bash
pnpm build
```

Ensure no TypeScript errors.

### 5.2 Manual Testing

1. Start the dev servers:
   ```bash
   .specify/scripts/bash/serve-app.sh
   ```

2. Open the flow editor

3. Verify:
   - [ ] "Blank" category appears at the top of the node library
   - [ ] "Blank Component" node is available in the Blank category
   - [ ] Dragging creates a node with "Hello World" preview
   - [ ] Opening editor shows code with 4-argument pattern comments
   - [ ] Modifying code updates the preview
   - [ ] Saving persists changes

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Category not appearing | Check order field is 0; verify categories array update |
| Node not in library | Verify builtInNodeList includes BlankComponentNode |
| Preview not rendering | Check Sucrase compilation; verify export default function |
| Appearance options not parsing | Ensure TypeScript interface format matches parser regex |

---

## Next Steps

After implementation:
1. Run `/speckit.tasks` to generate detailed task breakdown
2. Implement according to task order
3. Test with `.specify/scripts/bash/serve-app.sh`
