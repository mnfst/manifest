# Quickstart: Node Library Sidedrawer

**Feature**: Node Library Sidedrawer
**Branch**: `001-node-library`
**Date**: 2026-01-06

## Prerequisites

- Node.js 18+
- pnpm installed (`npm install -g pnpm`)
- Repository cloned and dependencies installed

## Quick Setup

```bash
# Navigate to repository root
cd /path/to/generator

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The frontend will be available at `http://localhost:5173` (or next available port).

## Feature Overview

The Node Library is a collapsible sidedrawer that replaces the previous "+" button modal for adding nodes to a flow. It provides:

1. **Hierarchical Navigation**: Groups → Nodes with animated transitions
2. **Search**: Instant filtering at root level
3. **Visual Consistency**: Same icons and colors as existing node presentation

## Key Files

| File | Purpose |
|------|---------|
| `packages/frontend/src/components/flow/NodeLibrary/NodeLibrary.tsx` | Main sidedrawer component |
| `packages/frontend/src/components/flow/NodeLibrary/NodeGroup.tsx` | Group item display |
| `packages/frontend/src/components/flow/NodeLibrary/NodeItem.tsx` | Node item display |
| `packages/frontend/src/components/flow/NodeLibrary/NodeSearch.tsx` | Search bar |
| `packages/frontend/src/lib/nodeConfig.ts` | Node types and groups configuration |
| `packages/frontend/src/pages/FlowDetail.tsx` | Integration point (uses NodeLibrary) |

## Usage Example

```tsx
import { NodeLibrary } from '@/components/flow/NodeLibrary';
import type { NodeType } from '@shared/types/node';

function FlowEditor() {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const handleSelectNode = (nodeType: NodeType) => {
    // Create node of selected type
    createNode(nodeType);
    // Optionally close the library
    // setIsLibraryOpen(false);
  };

  return (
    <div className="flex h-full">
      <NodeLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectNode={handleSelectNode}
        disabledTypes={['Return']} // Optional: disable specific types
      />
      <div className="flex-1">
        {/* Canvas content */}
      </div>
    </div>
  );
}
```

## Configuration

Node types and groups are configured in `packages/frontend/src/lib/nodeConfig.ts`:

```typescript
// Add a new node type
const newNode: NodeTypeConfig = {
  type: 'NewType',
  name: 'New Node',
  description: 'Description of what this node does',
  icon: SomeIcon,
  color: {
    bg: 'bg-orange-100',
    bgHover: 'bg-orange-200',
    text: 'text-orange-600',
  },
  groupId: 'existing-group-id',
};

// Add a new group
const newGroup: NodeGroup = {
  id: 'new-group',
  name: 'New Group',
  description: 'Group description',
  icon: GroupIcon,
  color: {
    bg: 'bg-orange-100',
    bgHover: 'bg-orange-200',
    text: 'text-orange-600',
  },
};
```

## Testing Checklist

### Manual Testing

1. **Open/Close**
   - [ ] Click toggle button to open library
   - [ ] Click outside to close
   - [ ] Press Escape to close
   - [ ] Animations are smooth (no stuttering)

2. **Group Navigation**
   - [ ] Groups display with correct icons and colors
   - [ ] Clicking a group shows its nodes with animation
   - [ ] Back button returns to groups with animation

3. **Search**
   - [ ] Search bar visible at root level
   - [ ] Typing filters nodes instantly
   - [ ] Clear button resets search
   - [ ] "No results" message when no matches

4. **Node Selection**
   - [ ] Clicking a node triggers callback
   - [ ] Disabled nodes show disabled state
   - [ ] Library stays open after selection

## Common Issues

### Library doesn't open
- Verify `isOpen` prop is being updated
- Check for CSS z-index conflicts

### Animations are janky
- Ensure no heavy re-renders during animation
- Check for CSS transition conflicts

### Nodes not showing
- Verify `nodeConfig.ts` has correct group assignments
- Check console for TypeScript errors

## Architecture Notes

```
┌─────────────────────────────────────────────────────────┐
│ FlowDetail (page)                                       │
│ ┌─────────────┐ ┌─────────────────────────────────────┐ │
│ │ NodeLibrary │ │ FlowDiagram (React Flow canvas)     │ │
│ │ (sidedrawer)│ │                                     │ │
│ │             │ │  ┌──────┐  ┌──────┐  ┌──────┐      │ │
│ │ ┌─────────┐ │ │  │ Node │──│ Node │──│ Node │      │ │
│ │ │ Search  │ │ │  └──────┘  └──────┘  └──────┘      │ │
│ │ └─────────┘ │ │                                     │ │
│ │ ┌─────────┐ │ │                                     │ │
│ │ │ Groups  │ │ │                                     │ │
│ │ │ or      │ │ │                                     │ │
│ │ │ Nodes   │ │ │                                     │ │
│ │ └─────────┘ │ │                                     │ │
│ └─────────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Next Steps

After implementing the core functionality:

1. Run `/speckit.tasks` to generate implementation tasks
2. Follow tasks in dependency order
3. Test manually after each task
4. Run `pnpm lint` to check for issues
