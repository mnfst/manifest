# Research: Blank Component Implementation

**Feature**: 001-blank-component
**Date**: 2026-01-14
**Status**: Complete

## Overview

This document consolidates research findings for implementing the Blank Component feature. All technical decisions have been made based on analysis of the existing codebase patterns.

---

## Research Topics

### 1. Node Type Registration Approach

**Decision**: Implement as a built-in node type (not registry-based)

**Rationale**:
- Built-in nodes are always available without external dependencies
- Allows creation of a new "blank" category that appears first in the node library
- Simpler persistence - uses existing UINodeParameters structure
- Consistent with how specialized nodes (UserIntent, Return, etc.) are implemented

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Registry component | Would require external registry hosting; cannot control category ordering; adds deployment complexity |
| Special template in existing UI nodes | Would not support dedicated "blank" category; confuses purpose with StatCard/PostList |

**Key Files**:
- `packages/nodes/src/nodes/index.ts` - Register new node
- `packages/shared/src/types/node.ts` - Add to NodeType enum

---

### 2. Category System Extension

**Decision**: Add new 'blank' category with order: 0 (appears first)

**Rationale**:
- Existing category system uses numeric `order` field for sorting
- Setting order: 0 ensures Blank category appears above Triggers (order: 1)
- Minimal changes required - just add new entry to categories array

**Implementation Pattern**:
```typescript
// packages/backend/src/node/node.service.ts
const categories: CategoryInfo[] = [
  { id: 'blank', displayName: 'Blank', order: 0 },      // NEW - appears first
  { id: 'trigger', displayName: 'Triggers', order: 1 },
  // ... existing categories
];
```

**Frontend Changes**:
- Add 'blank' to CATEGORY_CONFIG in NodeLibrary.tsx
- Color scheme: Use distinctive color (e.g., yellow/amber) to highlight as starting point

**Key Files**:
- `packages/backend/src/node/node.service.ts:64-70` - Add category
- `packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx:36-60` - Add UI config
- `packages/shared/src/types/node.ts:25` - Add to NodeTypeCategory type

---

### 3. Component Template Structure (4-Argument Pattern)

**Decision**: Define template with explicit data, appearance, control, and actions props

**Rationale**:
- Aligns with Manifest UI toolkit philosophy
- Existing system already supports `data` and `appearance` props
- Adding `control` and `actions` extends the pattern consistently
- TypeScript interface enables auto-parsing of appearance options

**Template Design**:
```typescript
/**
 * Blank Component Template
 *
 * This component follows the Manifest UI 4-argument pattern:
 * - data: Input data from the flow (required)
 * - appearance: Visual styling options (optional)
 * - control: Component behavior/state control (optional)
 * - actions: Callbacks for events the component can trigger (optional)
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
   * Example: variant?: 'default' | 'compact' | 'expanded'
   */
  appearance?: {
    // Add your appearance options here
    // variant?: 'default' | 'outlined';
    // showBorder?: boolean;
  };

  /**
   * CONTROL: Behavior and state control
   * Use for component configuration that affects behavior, not visuals.
   * Example: disabled?: boolean; readOnly?: boolean
   */
  control?: {
    // Add your control options here
    // disabled?: boolean;
  };

  /**
   * ACTIONS: Event callbacks
   * Define functions the component can call to trigger flow actions.
   * Example: onClick?: () => void; onSubmit?: (value: string) => void
   */
  actions?: {
    // Add your action callbacks here
    // onClick?: () => void;
  };
}

export default function BlankComponent({
  data,
  appearance = {},
  control = {},
  actions = {}
}: BlankComponentProps) {
  return (
    <div className="p-4 border rounded-lg bg-white">
      <h2 className="text-lg font-semibold">Hello World</h2>
      <p className="text-sm text-gray-500">
        Edit this component to create your own UI.
      </p>
    </div>
  );
}
```

**Key Files**:
- `packages/shared/src/types/templates.ts` - Add BLANK_COMPONENT_DEFAULT_CODE

---

### 4. Appearance Auto-Parsing Compatibility

**Decision**: Use existing parseAppearanceOptions() without modification

**Rationale**:
- Existing regex pattern matches `appearance?: { ... }` blocks
- TypeScript interface format is already supported
- No changes needed to registry.ts parsing logic

**Verification**:
The existing parser at `packages/frontend/src/services/registry.ts:64-132` will correctly parse:
```typescript
appearance?: {
  variant?: 'default' | 'outlined';
  showBorder?: boolean;
  padding?: number;
}
```

Into appearance options displayed in the Appearance panel.

---

### 5. Node Canvas Representation

**Decision**: Create BlankComponentNode.tsx following RegistryComponentNode pattern

**Rationale**:
- Consistent visual language with other UI nodes
- Shows node name, "Blank Component" label, and edit controls
- Reuses existing Handle components for connections

**Key Patterns from RegistryComponentNode**:
- Uses `@xyflow/react` Handle components
- Displays node.name from parameters
- Shows edit button that opens InterfaceEditor
- Delete button with confirmation

**Key Files**:
- `packages/frontend/src/components/flow/RegistryComponentNode.tsx` - Pattern to follow
- `packages/frontend/src/components/flow/BlankComponentNode.tsx` - New file

---

### 6. Integration with InterfaceEditor

**Decision**: Reuse existing InterfaceEditor without modification

**Rationale**:
- InterfaceEditor already supports:
  - General tab (node name)
  - Appearance tab (when options exist)
  - Code tab (TSX editor)
  - Preview tab (live rendering)
- BlankComponent parameters match expected UINodeParameters structure

**Flow Integration**:
1. User clicks edit on BlankComponent node
2. InterfaceEditor opens with:
   - `initialCode`: BLANK_COMPONENT_DEFAULT_CODE (or customized)
   - `appearanceOptions`: Parsed from code's TypeScript interface
3. User edits code, sees live preview
4. Save updates node.parameters.customCode

---

### 7. Execute Function Implementation

**Decision**: Return component preview data (similar to RegistryComponent execution)

**Rationale**:
- BlankComponent is an interface node that renders UI
- Execute function should return the compiled component output
- Follows pattern of other interface nodes

**Implementation Approach**:
```typescript
async execute(context: ExecutionContext): Promise<ExecutionResult> {
  const { customCode, appearanceConfig } = context.node.parameters as UINodeParameters;
  const code = customCode || BLANK_COMPONENT_DEFAULT_CODE;

  return {
    success: true,
    output: {
      component: 'BlankComponent',
      code,
      appearance: appearanceConfig || {},
      data: context.input,
    },
  };
}
```

---

## Type System Changes

### NodeType Enum Extension
```typescript
// packages/shared/src/types/node.ts
export type NodeType =
  | 'BlankComponent'  // NEW
  | 'StatCard'
  | 'PostList'
  | ... existing types;
```

### NodeTypeCategory Extension
```typescript
// packages/shared/src/types/node.ts
export type NodeTypeCategory =
  | 'blank'     // NEW
  | 'trigger'
  | 'interface'
  | 'action'
  | 'return'
  | 'transform';
```

### BlankComponentNodeParameters
```typescript
// packages/shared/src/types/node.ts
export interface BlankComponentNodeParameters {
  customCode?: string;
  appearanceConfig?: AppearanceConfig;
}
```

---

## Dependencies

No new dependencies required. Implementation uses existing:
- React 18.3.1
- @xyflow/react 12.10.0
- Sucrase (for TSX compilation in ComponentPreview)
- CodeMirror (for code editing in InterfaceEditor)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Appearance parsing fails for new pattern | Low | Medium | Template uses same format as existing components; parser already tested |
| Category ordering breaks existing UI | Low | Low | Adding new category doesn't modify existing ones; regression testable |
| Template code confuses users | Medium | Low | Clear comments and Hello World default make pattern obvious |

---

## Summary

All technical decisions are resolved. The implementation follows existing patterns with minimal new code:

1. **New node type**: BlankComponent added to built-in registry
2. **New category**: 'blank' with order: 0 appears first
3. **Template**: 4-argument pattern with comprehensive comments
4. **Rendering**: Reuses existing ComponentPreview and InterfaceEditor
5. **Parsing**: Existing appearance auto-parsing works without changes

Ready to proceed to Phase 1: Design & Contracts.
