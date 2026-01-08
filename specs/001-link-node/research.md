# Research: Link Output Node

**Feature**: 001-link-node
**Date**: 2026-01-08

## 1. Node Implementation Pattern

### Decision
Follow the existing `ReturnNode` pattern for terminal/output nodes with category `return`, no output handles, and terminal flow semantics.

### Rationale
- ReturnNode already establishes the pattern for flow-terminating output nodes
- Uses `outputs: []` to indicate no downstream connections
- Category `return` signals special termination semantics to the execution engine
- Same structural pattern reduces learning curve and maintains consistency

### Alternatives Considered
| Option | Rejected Because |
|--------|------------------|
| `action` category with outputs | Actions expect downstream processing; Link terminates flow |
| `interface` category | Interface is for display-only UI components, not flow control |
| New `link` category | Unnecessary complexity; `return` category already handles termination semantics |

### Reference Implementation
File: `packages/nodes/src/nodes/return/ReturnNode.ts`
```typescript
export const ReturnNode: NodeTypeDefinition = {
  name: 'Return',
  category: 'return',
  inputs: ['main'],
  outputs: [], // Terminal - no downstream
  outputSchema: null, // No output schema for terminal nodes
};
```

---

## 2. ChatGPT openExternal API

### Decision
Use `window.openai.openExternal({ href })` to open external URLs. The execution will happen in the frontend context when the flow is executed in a ChatGPT widget.

### Rationale
- Only available in ChatGPT widget iframe context where `window.openai` is injected
- Automatically shows safe-link modal for security
- Return flow support available via `redirect_domains` metadata
- No specific user interaction requirement documented, but typically used on user action

### API Details
```typescript
// Basic usage
window.openai.openExternal({ href: "https://example.com" });

// Parameters
interface OpenExternalOptions {
  href: string; // The external URL to open
}
```

### Constraints
- Only works in ChatGPT widget iframe context
- Backend node execution cannot call browser APIs directly
- Link node `execute()` must signal frontend to call `openExternal`

### Implementation Strategy
The Link node `execute()` will return a special output type indicating an external link action:
```typescript
return {
  success: true,
  output: {
    type: 'link',
    href: resolvedUrl,
  },
};
```
The MCP tool execution or frontend will recognize this output type and call `window.openai.openExternal()`.

---

## 3. Source Node Type Constraint

### Decision
Implement connection constraint at validation time using the existing `SchemaService.validateFlowConnections()` pattern, checking source node category.

### Rationale
- Constraint should block invalid connections before flow execution
- Existing `validateFlowConnections()` already validates all connections
- Can add Link-specific validation in the same location
- Frontend can show immediate feedback when attempting invalid connection

### Implementation Approach

Add constraint check in `SchemaService.validateFlowConnections()`:
```typescript
// Check Link node source constraints
const targetNodeDef = this.nodeTypeMap.get(targetNode.type);
if (targetNodeDef?.name === 'Link') {
  const sourceNodeDef = this.nodeTypeMap.get(sourceNode.type);
  if (sourceNodeDef?.category !== 'interface') {
    results.push({
      connectionId: connection.id,
      status: 'error',
      issues: [{
        type: 'constraint-violation',
        message: 'Link nodes can only be connected after UI nodes',
      }],
    });
  }
}
```

### Alternatives Considered
| Option | Rejected Because |
|--------|------------------|
| Runtime validation in execute() | Too late - connection already exists, flow may fail mid-execution |
| Frontend-only validation | Inconsistent with backend validation; API could create invalid connections |
| New constraint system | Over-engineering for a single node type; existing validation sufficient |

---

## 4. URL Validation

### Decision
Validate URL format with protocol requirement. Auto-prepend `https://` if missing protocol.

### Rationale
- Common user error is omitting protocol
- Auto-prepending reduces friction while maintaining security
- HTTPS is the safe default

### Validation Rules
1. If URL starts with `http://` or `https://`, use as-is
2. If URL has no protocol, prepend `https://`
3. Validate final URL structure (domain required)
4. Reject empty URLs

### Implementation
```typescript
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('URL is required');

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
```

---

## 5. Dynamic URL Resolution

### Decision
Support template variable syntax `{{nodeSlug.path}}` for dynamic URL construction, following the ApiCallNode pattern.

### Rationale
- Existing pattern used by ApiCallNode
- Well-tested template resolution logic available
- Allows URL to come from upstream data (API responses, transforms)

### Reference Implementation
File: `packages/nodes/src/nodes/action/ApiCallNode.ts` (lines 34-73)
```typescript
async function resolveTemplate(
  template: string,
  getNodeValue: (nodeId: string) => Promise<unknown>
): Promise<string>
```

### Usage Example
```typescript
// Static URL
{ href: "https://docs.example.com" }

// Dynamic URL from upstream API response
{ href: "{{api_call_1.body.redirectUrl}}" }

// Dynamic URL from transform output
{ href: "{{transformer_1.generatedUrl}}" }
```

---

## 6. Frontend Component Pattern

### Decision
Create `LinkNode.tsx` following the `ReturnValueNode.tsx` pattern with single left handle (target), no right handle (terminal), and blue theme for visual distinction.

### Rationale
- ReturnValueNode already establishes terminal node UI pattern
- Single left handle indicates incoming connection only
- Color distinction helps users identify different output types

### Component Structure
- Left `Handle` type="target" for incoming connections
- No right `Handle` (terminal node)
- Icon: `ExternalLink` from lucide-react
- Theme: Blue (green=Return, purple=UI, blue=Link action)
- Parameters editor: URL input field with validation

### Reference Implementation
File: `packages/frontend/src/components/flow/ReturnValueNode.tsx`

---

## 7. Node Registration

### Decision
Add Link to node registry in `packages/nodes/src/nodes/index.ts` and NodeType union in `packages/shared/src/types/node.ts`.

### Files to Modify
1. `packages/nodes/src/nodes/index.ts` - Add to builtInNodeList and builtInNodes
2. `packages/shared/src/types/node.ts` - Add 'Link' to NodeType union
3. `packages/shared/src/types/node.ts` - Add LinkNodeParameters interface

### Node Type Union Update
```typescript
export type NodeType = 'StatCard' | 'Return' | 'CallFlow' | 'UserIntent' | 'ApiCall' | 'JavaScriptCodeTransform' | 'Link';
```

---

## 8. Parameter Schema

### Decision
Link node parameters will include:
- `href`: string - The URL (static or template with dynamic variables)

### Interface Definition
```typescript
export interface LinkNodeParameters {
  href: string; // URL to open (can contain {{template}} variables)
}
```

### Default Parameters
```typescript
defaultParameters: {
  href: '',
}
```

---

## Summary

All research items resolved. Ready to proceed with Phase 1: Design & Contracts.

| Item | Resolution |
|------|------------|
| Node category | `return` (terminal/output pattern) |
| ChatGPT API | `window.openai.openExternal({ href })` |
| Source constraint | Validation in SchemaService |
| URL validation | Auto-prepend https://, validate format |
| Dynamic URLs | Template variables `{{nodeSlug.path}}` |
| Frontend | Blue-themed terminal node component |
| Registration | Add to index.ts and NodeType union |
| Parameters | `{ href: string }` |
