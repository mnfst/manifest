# Research: Transform Node Category

**Feature**: 089-transform-nodes | **Date**: 2026-01-07

## 1. CodeMirror Integration

### Decision: @uiw/react-codemirror

**Rationale**: Most popular and maintained React wrapper for CodeMirror 6. Provides React hooks and components out of the box with excellent TypeScript support. Lighter than Monaco Editor.

**Alternatives Considered**:
- Raw `@codemirror/*` - More setup required, no React abstractions
- `react-codemirror` - Less actively maintained
- Monaco Editor - Heavier (VS Code editor), overkill for simple transforms

**Installation Required**:
```bash
pnpm add @uiw/react-codemirror @codemirror/lang-javascript acorn --filter frontend
```

**Integration Pattern**:
- Follow existing NodeEditModal.tsx tab-based pattern
- Use useState for code state with onChange listener
- acorn parser provides real-time syntax validation without execution

---

## 2. Diamond-Shaped Node Rendering

### Decision: CSS Transform with External Handles

**Rationale**: Simple CSS approach using `transform: rotate(45deg)` works well with React Flow. Handles must be placed outside the rotated container for correct positioning.

**Alternatives Considered**:
- SVG custom shape - More complex, harder to maintain
- Canvas rendering - Overkill for static shape
- React Flow custom node shape API - Limited control over rotation

**Implementation Pattern**:
```tsx
<div className="relative w-[100px] h-[100px]">
  <Handle type="target" position={Position.Left} id="input" />
  <div className="transform rotate-45 w-full h-full bg-teal-100 border-2 border-teal-300">
    {/* Counter-rotate content to keep it readable */}
    <div className="transform -rotate-45">
      <Icon />
    </div>
  </div>
  <Handle type="source" position={Position.Right} id="output" />
</div>
```

**Key Details**:
- Size: ~100px (smaller than standard 200px nodes)
- Must use `nopan` class to prevent canvas pan on click
- Counter-rotate internal content for readability

---

## 3. Icon Selection

### Decision: `shuffle` from lucide-react

**Rationale**: Best represents data transformation/rearrangement concept. Already installed in project. Clear visual metaphor for "changing data format."

**Alternatives Considered**:
- `rotate-cw` - Too similar to refresh/reload
- `repeat` - Generic cycling, less intuitive
- `arrows-right-left` - More about bidirectional flow
- `wand-2` - Too playful for data transformation

**Color Scheme**: Teal/Emerald (distinct from existing Orange, Blue, Gray, Purple, Green)

---

## 4. JavaScript Execution Sandboxing

### Decision: Function Constructor (for POC)

**Rationale**: Safe for user-controlled code in flow builder context. Zero dependencies. Aligns with existing template resolution pattern in ApiCallNode. Fast immediate feedback.

**Alternatives Considered**:
- Web Workers - More isolation but adds complexity, unnecessary for POC
- iframe sandbox - Heaviest option, only needed for untrusted code

**Implementation Pattern**:
```typescript
function executeTransform(code: string, input: unknown): unknown {
  try {
    const func = new Function('input', code);
    return func(input);
  } catch (error) {
    throw new Error(`Transform failed: ${error.message}`);
  }
}
```

**Security Notes**:
- Function constructor creates isolated scope
- Cannot access window, document, or other globals
- Cannot import or require modules
- Syntax errors caught immediately
- Appropriate for POC where users control their own flows

---

## 5. Output Schema Inference

### Decision: Runtime Inference + Manual Override

**Rationale**: Aligns with existing ApiCallNode pattern that resolves schema from sample response. Provides immediate, accurate feedback. Can be extended to TypeScript analysis later.

**Alternatives Considered**:
- TypeScript Compiler API - Heavy dependency, complex, overkill for POC
- Static AST Analysis (acorn) - Can detect simple literals but limited for complex transforms

**Implementation Pattern**:
```typescript
function inferSchemaFromValue(value: unknown): JSONSchema {
  if (value === null) return { type: 'null' };
  if (typeof value === 'string') return { type: 'string' };
  if (typeof value === 'number') return { type: 'number' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length > 0 ? inferSchemaFromValue(value[0]) : {},
    };
  }
  if (typeof value === 'object') {
    const properties: Record<string, JSONSchema> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      properties[key] = inferSchemaFromValue(val);
    }
    return { type: 'object', properties };
  }
  return {};
}
```

**Workflow**:
1. User writes transformation code
2. Syntax validation happens in real-time (acorn)
3. When user tests or saves, code executes against sample input
4. Output schema inferred from actual return value
5. User can manually override schema if needed

---

## 6. Node Type Definition Pattern

### Decision: Follow ApiCallNode pattern with getOutputSchema()

**Rationale**: ApiCallNode demonstrates the exact pattern needed - dynamic output schema based on parameters. Proven pattern in existing codebase.

**Key Pattern Elements**:
```typescript
export const JavaScriptCodeTransform: NodeTypeDefinition = {
  name: 'JavaScriptCodeTransform',
  displayName: 'JavaScript Code',
  icon: 'shuffle',
  group: ['transform'],
  category: 'transform',  // NEW CATEGORY

  inputs: ['main'],
  outputs: ['main'],

  defaultParameters: {
    code: 'return input;',
    resolvedOutputSchema: null,
  },

  inputSchema: {
    type: 'object',
    additionalProperties: true,
  },

  getOutputSchema(parameters): JSONSchema | null {
    return (parameters.resolvedOutputSchema as JSONSchema) ?? null;
  },

  async execute(context): Promise<ExecutionResult> {
    // Execute transformation
  },
};
```

---

## 7. Incompatibility Detection & Suggestion

### Decision: Extend existing SchemaService.validateConnection()

**Rationale**: System already has schema compatibility checking. Extend it to return suggestion metadata when connections are incompatible.

**Implementation Approach**:
1. When `validateConnection()` returns incompatible status
2. Frontend shows "Add a transformer" button on the edge/connection
3. Clicking opens node library filtered to Transform category
4. Selection triggers auto-insertion between connected nodes

**Edge Logic**:
- Store edge metadata with compatibility status
- Custom edge component (extends DeletableEdge) shows button when incompatible
- Button handler: disconnect nodes → insert transformer → reconnect both ends

---

## Dependencies Summary

**Already Available**:
- @xyflow/react ^12.10.0
- lucide-react ^0.562.0
- React 18.3.1
- TypeScript 5.7.2

**Need to Add** (frontend package):
- @uiw/react-codemirror ^4.21.x
- @codemirror/lang-javascript ^6.2.x
- acorn ^8.10.x

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `packages/nodes/src/nodes/JavaScriptCodeTransform.ts` | Node type definition |
| `packages/frontend/src/components/flow/TransformNode.tsx` | Diamond visual component |

### Modified Files
| File | Changes |
|------|---------|
| `packages/shared/src/types/node.ts` | Add `'JavaScriptCodeTransform'` to NodeType, `'transform'` to category |
| `packages/nodes/src/nodes/index.ts` | Export new transformer node |
| `packages/frontend/src/components/flow/FlowDiagram.tsx` | Register TransformNode component |
| `packages/frontend/src/components/flow/NodeEditModal.tsx` | Add CodeMirror editor section for transform nodes |
| `packages/frontend/src/components/flow/CompatibilityDetailModal.tsx` | Add "Add transformer" button |

---

## Open Questions Resolved

All technical unknowns from the specification have been resolved through this research. No NEEDS CLARIFICATION markers remain.
