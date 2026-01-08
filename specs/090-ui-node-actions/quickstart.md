# Quickstart: UI Node Actions

**Feature**: 090-ui-node-actions
**Date**: 2026-01-08

## Overview

This feature adds support for interactive actions on UI nodes. UI nodes can now define actions that, when triggered by user interaction, continue flow execution along a specific path.

## Key Concepts

### 1. UI Node Actions

A **UI Node Action** is an event that a UI component can emit when a user interacts with it:

- **onReadMore**: Triggered when clicking "Read More" on a Post List item
- **onBack**: Triggered when clicking a back button
- **onSelect**: Triggered when selecting an item

Actions pass data to downstream nodes (e.g., the clicked Post object).

### 2. Action Handles

Action handles are connection points on the right side of UI nodes, one per action:

```
┌────────────────────┐
│      Post List     │
│                    │○───── onReadMore
│                    │
└────────────────────┘
```

Connect downstream nodes to these handles to create action-based execution paths.

### 3. Conditional Execution

With actions, flows support branching execution:

```
Trigger ──▶ API Call ──▶ Post List
                              │
                         onReadMore
                              │
                              ▼
                         Return Node
```

The Return Node only executes when the user clicks "Read More".

## Implementation Steps

### Step 1: Add Post List Node Type

Create `packages/nodes/src/nodes/interface/PostListNode.ts`:

```typescript
export const PostListNode: NodeTypeDefinition = {
  name: 'PostList',
  displayName: 'Post List',
  icon: 'layout-list',
  group: ['ui', 'display', 'blog'],
  category: 'interface',
  description: 'Display a list of blog posts with Read More action',

  inputs: ['main'],
  outputs: ['action:onReadMore'],

  defaultParameters: {
    layoutTemplate: 'post-list',
  },

  inputSchema: { /* posts array schema */ },
  outputSchema: { /* Post object schema */ },

  async execute(context): Promise<ExecutionResult> {
    return {
      success: true,
      output: {
        type: 'interface',
        layoutTemplate: 'post-list',
      },
    };
  },
};
```

### Step 2: Update LAYOUT_REGISTRY

In `packages/shared/src/types/app.ts`:

```typescript
export type LayoutTemplate = 'stat-card' | 'post-list';

export const LAYOUT_REGISTRY: Record<LayoutTemplate, LayoutTemplateConfig> = {
  'stat-card': { /* existing */ },
  'post-list': {
    manifestBlock: '@manifest/post-list',
    installCommand: 'npx shadcn@latest add @manifest/post-list',
    useCase: 'Blog posts, article lists, content feeds',
    actions: [
      { name: 'onReadMore', label: 'Read More', description: 'Click to read full post' }
    ],
  },
};
```

### Step 3: Update Node Type Union

In `packages/shared/src/types/node.ts`:

```typescript
export type NodeType =
  | 'StatCard'
  | 'PostList'  // Add this
  | 'Return'
  | /* ... */;
```

### Step 4: Register Node

In `packages/nodes/src/nodes/index.ts`:

```typescript
export { PostListNode } from './interface/index.js';

export const builtInNodes = {
  // existing nodes...
  PostList: PostListNode,
};

export const builtInNodeList = [
  // existing nodes...
  PostListNode,
];
```

### Step 5: Add Action Callback Endpoint

In `packages/backend/src/mcp/mcp.controller.ts`:

```typescript
@Post(':appSlug/actions')
async executeAction(
  @Param('appSlug') appSlug: string,
  @Body() request: ExecuteActionRequest
): Promise<McpToolResponse> {
  return this.mcpToolService.executeAction(appSlug, request);
}
```

### Step 6: Update Node Library Display

In `packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx`:

```typescript
import { LAYOUT_REGISTRY } from '@chatgpt-app-builder/shared';

// In the component:
const getActionLabel = (node: NodeTypeInfo): string => {
  if (node.category !== 'interface') return '';

  const layoutTemplate = node.defaultParameters?.layoutTemplate as LayoutTemplate;
  const config = LAYOUT_REGISTRY[layoutTemplate];
  const actionCount = config?.actions?.length ?? 0;

  if (actionCount === 0) return 'read only';
  return `${actionCount} action${actionCount > 1 ? 's' : ''}`;
};
```

## Testing the Feature

1. Start the dev servers: `pnpm dev`
2. Create a new flow
3. Add a Trigger node with parameters for fetching posts
4. Add an API Call node to fetch posts from an API
5. Add a Post List node and connect it to the API Call
6. Add a Return node and connect it to the Post List's "onReadMore" handle
7. Publish the app
8. Test in ChatGPT - click "Read More" on a post to trigger the action path

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/types/app.ts` | Add 'post-list' to LayoutTemplate, add to LAYOUT_REGISTRY |
| `packages/shared/src/types/node.ts` | Add 'PostList' to NodeType union |
| `packages/nodes/src/nodes/interface/PostListNode.ts` | NEW: PostListNode definition |
| `packages/nodes/src/nodes/interface/index.ts` | Export PostListNode |
| `packages/nodes/src/nodes/index.ts` | Register PostListNode |
| `packages/backend/src/mcp/mcp.controller.ts` | Add action callback endpoint |
| `packages/backend/src/mcp/mcp.tool.ts` | Add executeAction method |
| `packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx` | Display action count |

## Common Issues

### Action handle not showing

Ensure `outputs: ['action:onReadMore']` is set in the node definition and the layout template is registered in LAYOUT_REGISTRY with actions.

### Action not executing

Check that the connection's sourceHandle matches `action:actionName` format. Verify the action callback endpoint is registered.

### "Read only" showing for node with actions

Verify LAYOUT_REGISTRY has the correct actions array for the layout template.
