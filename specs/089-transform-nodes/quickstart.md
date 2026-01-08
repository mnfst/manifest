# Quickstart: Transform Node Category

**Feature**: 089-transform-nodes | **Date**: 2026-01-07

## Overview

This feature adds a Transform node category with transformer nodes that convert data formats between incompatible nodes. The first transformer is "JavaScript Code" which allows users to write custom transformation logic.

## Key Concepts

### Transform Category
- New node category (`category: 'transform'`)
- Distinguished by teal color scheme
- Diamond-shaped visual (45° rotated square)
- Always requires input connection

### JavaScript Code Transformer
- Execute custom JavaScript to transform data
- CodeMirror editor for code editing
- Real-time syntax validation
- Dynamic output schema inference

## Quick Implementation Guide

### 1. Add Dependencies (frontend)

```bash
cd packages/frontend
pnpm add @uiw/react-codemirror @codemirror/lang-javascript acorn
```

### 2. Extend Type Definitions

**packages/shared/src/types/node.ts**:
```typescript
// Add to NodeType union
export type NodeType =
  | 'Interface' | 'Return' | 'CallFlow' | 'UserIntent' | 'ApiCall'
  | 'JavaScriptCodeTransform';

// Add to NodeTypeCategory union
export type NodeTypeCategory =
  | 'trigger' | 'interface' | 'action' | 'return'
  | 'transform';
```

### 3. Create Node Definition

**packages/nodes/src/nodes/JavaScriptCodeTransform.ts**:
```typescript
import type { NodeTypeDefinition } from '../types';

export const JavaScriptCodeTransform: NodeTypeDefinition = {
  name: 'JavaScriptCodeTransform',
  displayName: 'JavaScript Code',
  icon: 'shuffle',
  group: ['transform'],
  category: 'transform',
  description: 'Transform data using custom JavaScript code',

  inputs: ['main'],
  outputs: ['main'],

  defaultParameters: {
    code: 'return input;',
    resolvedOutputSchema: null,
  },

  inputSchema: {
    type: 'object',
    additionalProperties: true,
    description: 'Input data from upstream node',
  },

  getOutputSchema(parameters) {
    return parameters.resolvedOutputSchema ?? null;
  },

  async execute(context) {
    const { parameters, getNodeValue } = context;
    const code = parameters.code as string;
    const input = await getNodeValue('main');

    try {
      const func = new Function('input', code);
      const output = func(input);
      return { success: true, data: output };
    } catch (error) {
      return {
        success: false,
        error: `Transform failed: ${error.message}`
      };
    }
  },
};
```

### 4. Create Visual Component

**packages/frontend/src/components/flow/TransformNode.tsx**:
```tsx
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Shuffle } from 'lucide-react';

export function TransformNode({ data }: NodeProps) {
  return (
    <div className="relative w-[100px] h-[100px] nopan">
      <Handle type="target" position={Position.Left} id="input" />

      <div className="absolute inset-0 transform rotate-45 bg-teal-50 border-2 border-teal-300 rounded-lg">
        <div className="absolute inset-0 flex items-center justify-center transform -rotate-45">
          <Shuffle className="w-6 h-6 text-teal-600" />
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}
```

### 5. Register Node Type

**packages/frontend/src/components/flow/FlowDiagram.tsx**:
```typescript
import { TransformNode } from './TransformNode';

const nodeTypes = {
  // ... existing types
  JavaScriptCodeTransform: TransformNode,
};
```

### 6. Export from Nodes Package

**packages/nodes/src/nodes/index.ts**:
```typescript
export * from './JavaScriptCodeTransform';

// Add to builtInNodeList
export const builtInNodeList = [
  // ... existing nodes
  JavaScriptCodeTransform,
];
```

## Usage Flow

1. **Via Incompatibility Suggestion**:
   - Connect two nodes with incompatible schemas
   - See "Add a transformer" button on connection
   - Click to open filtered node library (Transform only)
   - Select JavaScript Code transformer
   - Transformer auto-inserted between nodes

2. **Manual Addition**:
   - Open node library
   - Navigate to Transform category
   - Drag JavaScript Code to canvas
   - Connect input (left handle) to upstream node
   - Open configuration modal to write code

3. **Configuration**:
   - Click transformer node to open modal
   - Write JavaScript code in CodeMirror editor
   - View real-time syntax validation
   - Test with sample input to see output
   - Output schema auto-inferred from test result

## Testing Checklist

- [ ] Transform category appears in node library
- [ ] JavaScript Code node displays as diamond shape
- [ ] Handles positioned correctly (left input, right output)
- [ ] CodeMirror editor opens in modal
- [ ] Syntax errors highlighted in real-time
- [ ] Code execution transforms data correctly
- [ ] Output schema inferred from test execution
- [ ] Incompatibility suggestion appears on invalid connections
- [ ] Auto-insertion places transformer correctly
- [ ] Execution tracking shows transformer in usage screen

## Files Reference

| File | Purpose |
|------|---------|
| `packages/nodes/src/nodes/JavaScriptCodeTransform.ts` | Node definition |
| `packages/frontend/src/components/flow/TransformNode.tsx` | Visual component |
| `packages/shared/src/types/node.ts` | Type definitions |
| `packages/frontend/src/components/flow/NodeEditModal.tsx` | Configuration UI |
| `specs/089-transform-nodes/contracts/` | API contracts |
