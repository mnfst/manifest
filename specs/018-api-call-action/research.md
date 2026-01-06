# Research: API Call Action Node

**Feature**: 018-api-call-action
**Date**: 2026-01-06

## Executive Summary

This research documents the technical decisions for implementing an API Call action node. The codebase has well-established patterns for node implementation that this feature will follow.

---

## Research Areas

### 1. Node Implementation Pattern

**Question**: How should the ApiCallNode follow existing node patterns?

**Decision**: Follow the exact pattern established by InterfaceNode, ReturnNode, and CallFlowNode.

**Rationale**:
- Existing nodes provide a clear, well-tested template
- Consistency reduces cognitive load for maintainers
- The pattern separates concerns: type definition (packages/nodes), shared types (packages/shared), and UI (packages/frontend)

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Custom node class hierarchy | Unnecessary complexity; existing flat structure works well |
| Plugin-based node system | Over-engineering for POC phase |

**Pattern Summary**:
```
NodeTypeDefinition (packages/nodes/src/types.ts)
├── name: string              - 'ApiCall'
├── displayName: string       - 'API Call'
├── icon: string              - Lucide icon name
├── group: string[]           - Categories for organization
├── description: string       - What the node does
├── inputs: string[]          - ['main'] for single input handle
├── outputs: string[]         - ['main'] for single output handle
├── defaultParameters: {}     - Initial configuration values
└── execute: async function   - Node execution logic
```

---

### 2. HTTP Client for Backend Execution

**Question**: What HTTP client should be used for making API calls?

**Decision**: Use the built-in `fetch` API (available in Node.js 18+).

**Rationale**:
- Node.js 18+ includes native `fetch` support (target platform confirmed)
- No additional dependencies required
- Simple, well-documented API
- Supports all HTTP methods, headers, timeouts via AbortController

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| axios | Additional dependency; fetch is sufficient for basic needs |
| node-fetch | Unnecessary since native fetch available in Node 18+ |
| got | Over-featured for simple HTTP requests |

**Implementation Approach**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);

const response = await fetch(url, {
  method,
  headers,
  body: method !== 'GET' ? JSON.stringify(body) : undefined,
  signal: controller.signal,
});

clearTimeout(timeoutId);
```

---

### 3. Input Mapping from Upstream Nodes

**Question**: How should users map upstream node outputs to API Call parameters?

**Decision**: Use template string interpolation with `{{nodeId.path}}` syntax, similar to CallFlowNode's inputMapping pattern.

**Rationale**:
- CallFlowNode already has an inputMapping pattern in defaultParameters
- Template strings are intuitive for users familiar with similar tools (Zapier, n8n)
- Can be rendered with a dropdown UI showing available upstream outputs

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Direct code injection | Security risk; complex to implement safely |
| Visual drag-drop mapping | More complex UI; overkill for POC |
| JSONPath expressions | Less intuitive for non-technical users |

**Implementation Approach**:
- Store inputMappings in node parameters: `{ url: "{{prev.data.id}}", headers: {...} }`
- At execution time, resolve templates using `context.getNodeValue(nodeId)`
- UI shows available inputs from connected upstream nodes

---

### 4. Response Output Structure

**Question**: What should the API Call node output contain?

**Decision**: Output a structured object with status, headers, body, and success indicator.

**Rationale**:
- Complete information allows downstream nodes to make decisions
- Follows REST conventions
- Error responses are still useful data (not just failure)

**Output Structure**:
```typescript
interface ApiCallOutput {
  type: 'apiCall';
  success: boolean;           // true if request completed (even 4xx/5xx)
  status: number;             // HTTP status code
  statusText: string;         // HTTP status text
  headers: Record<string, string>;
  body: unknown;              // Parsed JSON or raw text
  error?: string;             // Error message if request failed
}
```

---

### 5. Error Handling Strategy

**Question**: How should network errors, timeouts, and HTTP errors be handled?

**Decision**: Capture all errors in the output without crashing the flow.

**Rationale**:
- Flows should be resilient to external API failures
- Users may want to handle errors differently based on type
- Consistent with CallFlowNode error handling pattern

**Error Categories**:
| Error Type | Behavior |
|------------|----------|
| Network error | `success: false`, `error: "Network error: ..."` |
| Timeout | `success: false`, `error: "Request timeout after Xms"` |
| HTTP 4xx/5xx | `success: true`, full response available |
| Invalid URL | `success: false`, `error: "Invalid URL: ..."` |

---

### 6. UI Component Strategy

**Question**: Which frontend files need modification?

**Decision**: Modify three existing files, add one new component.

**Files to Modify**:
| File | Change |
|------|--------|
| `AddStepModal.tsx` | Add ApiCall to stepOptions array and type union |
| `NodeEditModal.tsx` | Add ApiCall case in form rendering |
| `FlowDiagram.tsx` | Add ApiCall to nodeTypes mapping (if needed) |
| `packages/shared/src/types/node.ts` | Add 'ApiCall' to NodeType union, add ApiCallNodeParameters |

**New Component**:
- `ApiCallNode.tsx` - Visual node component following ViewNode pattern

**UI Design**:
- Color theme: Orange (integration/API theme) - distinct from blue (Interface), green (Return), purple (CallFlow)
- Icon: `globe` or `network` from Lucide
- Form fields: URL input, Method dropdown, Headers key-value editor, Timeout input

---

### 7. Node Type Registration

**Question**: How are new node types registered in the system?

**Decision**: Follow existing registration pattern in three locations.

**Registration Points**:
1. **packages/nodes/src/nodes/index.ts** - Export ApiCallNode and add to builtInNodes/builtInNodeList
2. **packages/shared/src/types/node.ts** - Add 'ApiCall' to NodeType union
3. **packages/frontend/src/components/flow/AddStepModal.tsx** - Add to stepOptions array

**No Backend Changes Required**: The existing flow execution engine dynamically uses node definitions from the nodes package.

---

## Technical Decisions Summary

| Decision Area | Choice | Key Reason |
|---------------|--------|------------|
| Implementation pattern | Follow existing node pattern | Consistency and maintainability |
| HTTP client | Native fetch | No new dependencies, Node 18+ support |
| Input mapping | Template strings `{{nodeId.path}}` | User-friendly, similar to CallFlowNode |
| Output structure | Complete response object | Enables downstream decision-making |
| Error handling | Capture without crashing | Flow resilience |
| UI color theme | Orange | Distinct from other node types |
| Icon | `globe` | Represents external API/network |

---

## Open Items

None - all technical decisions resolved for POC implementation.

---

## References

- `packages/nodes/src/nodes/CallFlowNode.ts` - Reference async node pattern
- `packages/nodes/src/types.ts` - NodeTypeDefinition interface
- `packages/frontend/src/components/flow/AddStepModal.tsx` - Node picker UI
- `packages/frontend/src/components/flow/NodeEditModal.tsx` - Node configuration UI
- `packages/frontend/src/components/flow/ViewNode.tsx` - Node visualization pattern
- `packages/shared/src/types/node.ts` - NodeType and parameter types
