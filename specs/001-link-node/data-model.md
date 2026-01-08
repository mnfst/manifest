# Data Model: Link Output Node

**Feature**: 001-link-node
**Date**: 2026-01-08

## Entities

### LinkNodeParameters

Parameters stored in NodeInstance.parameters for Link nodes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| href | string | Yes | URL to open. Supports template variables `{{nodeSlug.path}}` for dynamic URLs from upstream nodes |

**Validation Rules**:
- `href` must not be empty after trimming
- If `href` lacks protocol, `https://` is auto-prepended
- Final URL must be valid (parseable by URL constructor)

**Example Values**:
```typescript
// Static URL
{ href: "https://docs.example.com/guide" }

// Dynamic URL from API response
{ href: "{{weather_api.body.forecastUrl}}" }

// Dynamic URL with path construction
{ href: "https://shop.example.com/product/{{product_lookup.body.id}}" }
```

---

### UI Components Integration

The Link node edit modal must integrate the existing "Use Previous Outputs" components for dynamic URL selection.

| Component | Purpose | File |
|-----------|---------|------|
| `UsePreviousOutputs` | Dropdown UI to select upstream node/field and generate `{{slug.path}}` references | `components/common/UsePreviousOutputs.tsx` |
| `TemplateReferencesDisplay` | Validates template references in href field, shows warnings for missing nodes/fields | `components/common/TemplateReferencesDisplay.tsx` |
| `useUpstreamNodes` | Hook to discover upstream nodes via BFS graph traversal and fetch their output schemas | `hooks/useUpstreamNodes.ts` |

**Integration Pattern** (in NodeEditModal):
```tsx
// 1. Use the hook to get upstream node data
const { upstreamNodes, isLoading, error, refresh } = useUpstreamNodes(flowId, nodeId);

// 2. Show UsePreviousOutputs component for field selection
<UsePreviousOutputs
  upstreamNodes={upstreamNodes}
  isLoading={isLoading}
  error={error}
  onRefresh={refresh}
/>

// 3. URL input field with template placeholder
<input
  value={href}
  placeholder="https://example.com or {{ nodeSlug.field }}"
/>

// 4. Validate template references
<TemplateReferencesDisplay
  values={[href]}
  upstreamNodes={upstreamNodes}
  isConnected={upstreamNodes.length > 0}
/>
```

---

### LinkNodeOutput

Output structure produced by Link node execution.

| Field | Type | Description |
|-------|------|-------------|
| type | `'link'` (literal) | Discriminator for output type |
| href | string | Resolved URL after template variable substitution |

**Example**:
```typescript
{
  type: 'link',
  href: 'https://docs.example.com/guide'
}
```

**Consuming Context**:
The MCP execution layer or frontend widget recognizes outputs with `type: 'link'` and calls `window.openai.openExternal({ href })`.

---

### NodeTypeDefinition (Link)

Configuration registered in the node type registry.

| Field | Value |
|-------|-------|
| name | `'Link'` |
| displayName | `'Open Link'` |
| icon | `'external-link'` (lucide-react) |
| group | `['flow', 'output']` |
| category | `'return'` |
| description | `'Open an external URL in the user\'s browser. Terminates the flow.'` |
| inputs | `['main']` |
| outputs | `[]` (terminal node) |
| inputSchema | `{ type: 'object', additionalProperties: true }` |
| outputSchema | `null` (terminal nodes have no output schema) |

---

### Connection Constraint

Link nodes require source node type validation.

| Constraint | Requirement |
|------------|-------------|
| Source category | Must be `'interface'` |
| Valid source types | `StatCard` (and future UI nodes) |
| Invalid source types | `UserIntent`, `ApiCall`, `Return`, `CallFlow`, `JavaScriptCodeTransform` |

**Validation Location**: `SchemaService.validateFlowConnections()` in backend

**Error Response**:
```typescript
{
  connectionId: string,
  status: 'error',
  issues: [{
    type: 'constraint-violation',
    message: 'Link nodes can only be connected after UI nodes'
  }]
}
```

---

## Type Definitions (TypeScript)

### Shared Types Package

File: `packages/shared/src/types/node.ts`

```typescript
// Add to NodeType union
export type NodeType =
  | 'StatCard'
  | 'Return'
  | 'CallFlow'
  | 'UserIntent'
  | 'ApiCall'
  | 'JavaScriptCodeTransform'
  | 'Link';  // NEW

// Add parameters interface
export interface LinkNodeParameters {
  href: string;
}

// Add type guard
export function isLinkNode(
  node: NodeInstance
): node is NodeInstance & { parameters: LinkNodeParameters } {
  return node.type === 'Link';
}
```

### Nodes Package

File: `packages/nodes/src/nodes/return/LinkNode.ts`

```typescript
import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';
import type { JSONSchema, LinkNodeParameters } from '@chatgpt-app-builder/shared';

export interface LinkNodeOutput {
  type: 'link';
  href: string;
}

export const LinkNode: NodeTypeDefinition = {
  name: 'Link',
  displayName: 'Open Link',
  icon: 'external-link',
  group: ['flow', 'output'],
  category: 'return',
  description: 'Open an external URL in the user\'s browser. Terminates the flow.',

  inputs: ['main'],
  outputs: [],

  defaultParameters: {
    href: '',
  } satisfies LinkNodeParameters,

  inputSchema: {
    type: 'object',
    additionalProperties: true,
    description: 'Data available for template variable resolution in URL',
  } as JSONSchema,

  outputSchema: null,

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    // Implementation details in contracts
  },
};
```

---

## State Transitions

Link nodes are stateless output actions. No state machine applies.

| State | Description |
|-------|-------------|
| N/A | Link node execution is atomic - either opens link or fails |

---

## Relationships

```
                    ┌─────────────┐
                    │  UserIntent │ (trigger)
                    └──────┬──────┘
                           │
                           ▼
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌───────────────┐                    ┌────────────────┐
│    ApiCall    │                    │    StatCard    │ (interface)
└───────┬───────┘                    └────────┬───────┘
        │                                     │
        │    ❌ Cannot connect                │    ✅ Can connect
        │       to Link directly              │       to Link
        │                                     │
        ▼                                     ▼
  [Must go through                    ┌───────────────┐
   UI node first]                     │     Link      │ (return)
                                      │ [TERMINAL]    │
                                      └───────────────┘
```

---

## Migration

No database migration required. Link nodes are stored as JSON within Flow.nodes array (existing pattern).

**Storage Format** (within FlowEntity.nodes JSON):
```json
{
  "id": "uuid-here",
  "slug": "link_1",
  "type": "Link",
  "name": "Open Documentation",
  "position": { "x": 400, "y": 200 },
  "parameters": {
    "href": "https://docs.example.com"
  }
}
```
