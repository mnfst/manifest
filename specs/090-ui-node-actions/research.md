# Research: UI Node Actions

**Feature**: 090-ui-node-actions
**Date**: 2026-01-08

## Research Tasks

### 1. How to implement action-based conditional execution

**Decision**: Extend the existing connection system with action handle IDs

**Rationale**:
The existing system already supports multiple handles via the `sourceHandle` field in connections. When a connection's sourceHandle is `action:actionName`, the execution engine needs to treat it as a conditional path that only executes when that specific action is triggered by user interaction.

**Current Implementation**:
- Connections store `sourceHandle` and `targetHandle` fields (see `packages/shared/src/types/node.ts`)
- ViewNode.tsx already generates handles with IDs like `action:${action.name}`
- Execution engine (`mcp.tool.ts`) traverses all connections from a trigger

**Required Changes**:
1. The execution engine currently executes all reachable nodes from a trigger in one pass
2. For UI nodes with actions, execution needs to:
   - Execute the UI node to render the interface
   - Wait for user action (this happens in the runtime/frontend)
   - When action is triggered, execute nodes connected to that action's handle

**Implementation Pattern**:
- UI nodes with actions return their layout/widget data but also register pending action handlers
- The runtime (ChatGPT/client) invokes a callback when user clicks an action
- This triggers a secondary execution pass starting from the action handle
- Connection sourceHandle `action:onReadMore` identifies which path to execute

**Alternatives Considered**:
1. Event-based system with WebSockets - Too complex for POC
2. Separate "action flow" entities - Adds unnecessary complexity
3. Polling for action state - Poor UX and performance

### 2. Post List component integration

**Decision**: Create PostListNode following StatCardNode pattern, with actions from manifest JSON

**Rationale**:
The Post List component from ui.manifest.build defines:
- `onReadMore: (post: Post) => void` action
- Post type with: id, title, excerpt, coverImage?, author, publishedAt, readTime?, tags?, category?, url?

**Current Pattern** (StatCardNode):
```typescript
export const StatCardNode: NodeTypeDefinition = {
  name: 'StatCard',
  category: 'interface',
  outputs: [], // Read-only
  inputSchema: { /* stats array */ },
  outputSchema: null,
  execute: async (context) => ({
    success: true,
    output: { type: 'interface', layoutTemplate: 'stat-card' },
  }),
};
```

**New Pattern** (PostListNode):
```typescript
export const PostListNode: NodeTypeDefinition = {
  name: 'PostList',
  category: 'interface',
  outputs: ['action:onReadMore'], // Action output
  inputSchema: { /* posts array */ },
  outputSchema: { /* Post object from action */ },
  execute: async (context) => ({
    success: true,
    output: { type: 'interface', layoutTemplate: 'post-list' },
  }),
};
```

**LAYOUT_REGISTRY Update**:
```typescript
'post-list': {
  manifestBlock: '@manifest/post-list',
  installCommand: 'npx shadcn@latest add @manifest/post-list',
  useCase: 'Blog posts, article lists, content feeds',
  actions: [
    { name: 'onReadMore', label: 'Read More', description: 'Triggered when user clicks Read More on a post' }
  ],
  sampleData: { posts: [...] },
}
```

**Alternatives Considered**:
1. Generic "UI Component" node with dynamic actions - Too complex for POC
2. Loading actions from remote manifest at runtime - Adds latency, network dependency

### 3. Action metadata in NodeTypeInfo for library display

**Decision**: Add `actionCount` computed property based on LAYOUT_REGISTRY

**Rationale**:
NodeTypeInfo is sent to the frontend via `GET /api/node-types`. To show action count in the library:
1. The backend can compute action count from LAYOUT_REGISTRY at runtime
2. Or NodeTypeInfo can include an `actions` array

**Implementation Options**:

**Option A: Compute from LAYOUT_REGISTRY on frontend** (Selected)
- Keep NodeTypeInfo unchanged
- Frontend imports LAYOUT_REGISTRY and looks up actions by layoutTemplate
- NodeItem checks `LAYOUT_REGISTRY[layoutTemplate]?.actions.length`
- Pros: No API changes, single source of truth
- Cons: Frontend needs to know layout registry

**Option B: Add actions to NodeTypeInfo**
- Extend NodeTypeInfo with `actions?: LayoutAction[]`
- Backend populates from LAYOUT_REGISTRY in toNodeTypeInfo
- Pros: API provides complete data
- Cons: Duplicates LAYOUT_REGISTRY data, more complex

**Decision**: Option A - frontend computes from LAYOUT_REGISTRY since it's already imported in ViewNode.tsx and keeps the API surface minimal.

### 4. Runtime action execution flow

**Decision**: Two-phase execution with action callback

**Current Flow**:
```
Trigger → [Node1] → [Node2] → [UI Node] → [Return]
```

**New Flow with Actions**:
```
Phase 1 (initial):
Trigger → [Node1] → [UI Node] → (render widget, register actions)

Phase 2 (on action):
[UI Node].action:onReadMore → [Node3] → [Return]
```

**Implementation**:
1. When executing a UI node with actions, return widget + action metadata
2. Widget includes callback URLs or identifiers for each action
3. When user triggers action (e.g., clicks "Read More"):
   - Client calls backend with: flowId, nodeId, actionName, actionData (Post)
   - Backend finds connections from `action:actionName` handle
   - Executes downstream nodes with actionData as input
4. Return response from action path execution

**API Endpoint for Action Callbacks**:
```
POST /api/apps/:appSlug/actions
{
  "toolName": "get_posts",
  "nodeId": "post-list-node-id",
  "action": "onReadMore",
  "data": { "id": "123", "title": "..." }
}
```

## Summary

All research items resolved. Key findings:

1. **Conditional execution**: Use sourceHandle prefixed with `action:` to identify action paths
2. **PostListNode**: Follow StatCardNode pattern with outputs array including action handles
3. **Library display**: Compute action count from LAYOUT_REGISTRY on frontend
4. **Runtime**: Two-phase execution with dedicated action callback endpoint

No NEEDS CLARIFICATION items remain.
