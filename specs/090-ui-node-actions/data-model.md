# Data Model: UI Node Actions

**Feature**: 090-ui-node-actions
**Date**: 2026-01-08

## Entities

### Post

Represents a blog post displayed in the Post List UI component.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| title | string | Yes | Post title |
| excerpt | string | Yes | Short description/summary |
| coverImage | string | No | URL to cover image |
| author | Author | Yes | Author information |
| publishedAt | string | Yes | ISO date string |
| readTime | string | No | Estimated read time (e.g., "5 min read") |
| tags | string[] | No | Array of tag strings |
| category | string | No | Post category |
| url | string | No | Link to full article |

### Author

Nested entity within Post.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Author display name |
| avatar | string | No | URL to author avatar |

### LayoutAction

Defines an action that a UI component can emit. Already exists in `packages/shared/src/types/app.ts`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Action identifier (e.g., "onReadMore") |
| label | string | Yes | Display label for the action handle |
| description | string | Yes | Tooltip/description text |

### LayoutTemplateConfig (Extended)

Extended to support Post List template. Located in `packages/shared/src/types/app.ts`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| manifestBlock | string | Yes | Manifest UI block identifier |
| installCommand | string | Yes | CLI command to install component |
| useCase | string | Yes | Description of use cases |
| actions | LayoutAction[] | Yes | Available actions for this template |
| defaultCode | string | No | Default TSX code |
| sampleData | unknown | No | Sample data for preview |

## Type Updates

### LayoutTemplate (Union Type)

```typescript
// Before
export type LayoutTemplate = 'stat-card';

// After
export type LayoutTemplate = 'stat-card' | 'post-list';
```

### NodeType (Union Type)

```typescript
// Before
export type NodeType =
  | 'StatCard'
  | 'Return'
  | 'CallFlow'
  | 'UserIntent'
  | 'ApiCall'
  | 'JavaScriptCodeTransform';

// After
export type NodeType =
  | 'StatCard'
  | 'PostList'  // NEW
  | 'Return'
  | 'CallFlow'
  | 'UserIntent'
  | 'ApiCall'
  | 'JavaScriptCodeTransform';
```

## LAYOUT_REGISTRY Updates

```typescript
export const LAYOUT_REGISTRY: Record<LayoutTemplate, LayoutTemplateConfig> = {
  'stat-card': {
    manifestBlock: '@manifest/stats',
    installCommand: 'npx shadcn@latest add @manifest/stats',
    useCase: 'KPIs, dashboard stats, metrics overview',
    actions: [], // Read-only
  },
  'post-list': {
    manifestBlock: '@manifest/post-list',
    installCommand: 'npx shadcn@latest add @manifest/post-list',
    useCase: 'Blog posts, article lists, content feeds',
    actions: [
      {
        name: 'onReadMore',
        label: 'Read More',
        description: 'Triggered when user clicks Read More on a post',
      },
    ],
    sampleData: {
      posts: [
        {
          id: '1',
          title: 'Sample Post',
          excerpt: 'This is a sample post excerpt',
          author: { name: 'Author Name' },
          publishedAt: '2026-01-08',
        },
      ],
    },
  },
};
```

## JSON Schemas

### Post Input Schema (PostListNode.inputSchema)

```json
{
  "type": "object",
  "properties": {
    "posts": {
      "type": "array",
      "description": "Array of posts to display",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "description": "Unique post identifier" },
          "title": { "type": "string", "description": "Post title" },
          "excerpt": { "type": "string", "description": "Short summary" },
          "coverImage": { "type": "string", "description": "Cover image URL" },
          "author": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "avatar": { "type": "string" }
            },
            "required": ["name"]
          },
          "publishedAt": { "type": "string", "description": "ISO date string" },
          "readTime": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } },
          "category": { "type": "string" },
          "url": { "type": "string" }
        },
        "required": ["id", "title", "excerpt", "author", "publishedAt"]
      }
    }
  },
  "required": ["posts"]
}
```

### Post Output Schema (action:onReadMore output)

```json
{
  "type": "object",
  "description": "Post object passed when onReadMore action is triggered",
  "properties": {
    "id": { "type": "string" },
    "title": { "type": "string" },
    "excerpt": { "type": "string" },
    "coverImage": { "type": "string" },
    "author": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "avatar": { "type": "string" }
      },
      "required": ["name"]
    },
    "publishedAt": { "type": "string" },
    "readTime": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "category": { "type": "string" },
    "url": { "type": "string" }
  },
  "required": ["id", "title", "excerpt", "author", "publishedAt"]
}
```

## Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                       Flow                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    nodes[]                           │    │
│  │  ┌──────────────┐     ┌──────────────┐              │    │
│  │  │ UserIntent   │────▶│  PostList    │              │    │
│  │  │ (trigger)    │     │  (interface) │              │    │
│  │  └──────────────┘     └──────┬───────┘              │    │
│  │                              │                       │    │
│  │                   action:onReadMore                  │    │
│  │                              │                       │    │
│  │                              ▼                       │    │
│  │                       ┌──────────────┐              │    │
│  │                       │   Return     │              │    │
│  │                       │  (output)    │              │    │
│  │                       └──────────────┘              │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  connections[]                       │    │
│  │  { source: trigger, target: postlist, handle: main }│    │
│  │  { source: postlist, target: return,                │    │
│  │    sourceHandle: 'action:onReadMore' }              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## State Transitions

### UI Node Execution States

1. **Pending**: Node not yet reached in execution
2. **Rendering**: UI node is rendering its widget (Phase 1)
3. **WaitingForAction**: UI widget displayed, waiting for user interaction
4. **ActionTriggered**: User clicked an action, executing action path (Phase 2)
5. **Completed**: All paths have executed

Note: For POC, states 2-4 are simplified - the runtime handles the action callback loop.
