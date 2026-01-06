# Data Model: Node Library Sidedrawer

**Feature**: Node Library Sidedrawer
**Branch**: `001-node-library`
**Date**: 2026-01-06

## Overview

This feature is a **frontend-only UI change**. No new database entities or API changes are required. The data model below describes the TypeScript interfaces and configuration structures needed for the Node Library component.

## Entities

### NodeTypeConfig

Represents the configuration for a single node type displayed in the library.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `NodeType` | ✓ | The node type identifier (`'Interface'` \| `'Return'` \| `'CallFlow'`) |
| `name` | `string` | ✓ | Display name shown in the UI |
| `description` | `string` | ✓ | Short description of what the node does |
| `icon` | `LucideIcon` | ✓ | Icon component from lucide-react |
| `color` | `NodeColor` | ✓ | Color configuration for the node |
| `groupId` | `string` | ✓ | Reference to the parent group |

### NodeColor

Color configuration for consistent styling.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bg` | `string` | ✓ | Background class (e.g., `'bg-blue-100'`) |
| `bgHover` | `string` | ✓ | Hover background class (e.g., `'bg-blue-200'`) |
| `text` | `string` | ✓ | Text/icon color class (e.g., `'text-blue-600'`) |

### NodeGroup

Represents a category grouping related nodes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✓ | Unique identifier for the group |
| `name` | `string` | ✓ | Display name shown in the UI |
| `description` | `string` | ✓ | Short description of the group |
| `icon` | `LucideIcon` | ✓ | Icon component representing the group |
| `color` | `NodeColor` | ✓ | Color configuration for the group |

## Relationships

```
┌─────────────────┐       ┌──────────────────┐
│   NodeGroup     │ 1───* │  NodeTypeConfig  │
├─────────────────┤       ├──────────────────┤
│ id              │       │ type             │
│ name            │       │ name             │
│ description     │       │ description      │
│ icon            │       │ icon             │
│ color           │◄──────│ color            │
└─────────────────┘       │ groupId ─────────┘
                          └──────────────────┘
```

- A `NodeGroup` contains one or more `NodeTypeConfig` entries
- Each `NodeTypeConfig` belongs to exactly one `NodeGroup`

## Static Configuration

The node library configuration is defined statically in code (not fetched from API).

### Groups Configuration

| Group ID | Name | Icon | Color Scheme |
|----------|------|------|--------------|
| `display` | Display | `Layout` | Blue |
| `output` | Output | `FileOutput` | Green |
| `flow-control` | Flow Control | `GitBranch` | Purple |

### Nodes Configuration

| Type | Name | Group | Icon | Color Scheme |
|------|------|-------|------|--------------|
| `Interface` | View | display | `Layout` | Blue |
| `Return` | Return Value | output | `FileText` | Green |
| `CallFlow` | Call Flow | flow-control | `PhoneForwarded` | Purple |

## Component State Model

### NodeLibraryState

Internal state of the Node Library component.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `currentView` | `'groups'` \| `'nodes'` | `'groups'` | Current navigation level |
| `selectedGroupId` | `string \| null` | `null` | Currently selected group (when viewing nodes) |
| `searchTerm` | `string` | `''` | Current search query |
| `isAnimating` | `boolean` | `false` | Whether a navigation animation is in progress |

### State Transitions

```
┌──────────────┐  selectGroup(id)  ┌────────────────┐
│    groups    │ ────────────────► │     nodes      │
│              │                   │                │
│ searchTerm   │ ◄──────────────── │ selectedGroupId│
│              │    goBack()       │                │
└──────────────┘                   └────────────────┘
        │                                  │
        │ search(term)                     │ selectNode(type)
        ▼                                  ▼
┌──────────────┐                   ┌────────────────┐
│ search results│                  │ onSelectNode() │
│ (flat list)  │                   │ callback fired │
└──────────────┘                   └────────────────┘
```

## Validation Rules

1. **Group Selection**: Only valid group IDs from configuration can be selected
2. **Node Selection**: Only enabled node types can be selected (check `disabledTypes` prop)
3. **Search**: Case-insensitive substring match on node `name` field
4. **Navigation**: Cannot go "back" when already at root level

## Integration Points

### Input (Props)

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Controls visibility of the sidedrawer |
| `onClose` | `() => void` | Callback when user closes the drawer |
| `onSelectNode` | `(type: NodeType) => void` | Callback when a node is selected |
| `disabledTypes` | `NodeType[]` | Node types that cannot be selected |

### Output (Events)

| Event | Payload | Trigger |
|-------|---------|---------|
| `onClose` | none | User clicks outside, presses Escape, or clicks close button |
| `onSelectNode` | `NodeType` | User clicks on an enabled node item |

## Notes

- This data model is entirely frontend-based
- No database migrations required
- No API endpoints required
- Configuration can be extended to support additional node types without code changes to the core component
