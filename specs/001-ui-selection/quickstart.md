# Quickstart: UI Selection Architecture Refactor

**Feature Branch**: `001-ui-selection`
**Date**: 2026-01-07

## Prerequisites

- Node.js >= 18.0.0
- pnpm 9.15.4
- Existing generator monorepo cloned

## Quick Setup

```bash
# 1. Switch to feature branch
git checkout 001-ui-selection

# 2. Install dependencies
pnpm install

# 3. Build all packages (ensures types are generated)
pnpm build

# 4. Start development servers
.specify/scripts/bash/serve-app.sh
```

## Key Changes Overview

### 1. Node Folder Structure

**Before** (flat):
```
packages/nodes/src/nodes/
├── index.ts
├── ApiCallNode.ts
├── CallFlowNode.ts
├── InterfaceNode.ts
├── ReturnNode.ts
└── UserIntentNode.ts
```

**After** (category-based):
```
packages/nodes/src/nodes/
├── index.ts                    # Re-exports all
├── trigger/
│   ├── index.ts
│   └── UserIntentNode.ts
├── action/
│   ├── index.ts
│   └── ApiCallNode.ts
├── interface/
│   ├── index.ts
│   ├── InterfaceNode.ts
│   └── StatCardNode.ts         # NEW
└── return/
    ├── index.ts
    ├── ReturnNode.ts
    └── CallFlowNode.ts
```

### 2. New Stat Card UI Component

The Stat Card displays statistical metrics with trend indicators.

**Input Data Format**:
```typescript
{
  stats: [
    {
      label: "Sales",
      value: "$12,543",
      change: 12.5,
      changeLabel: "vs last month",
      trend: "up"
    },
    {
      label: "Orders",
      value: 342,
      change: -3.2,
      trend: "down"
    },
    {
      label: "Customers",
      value: "1,205",
      trend: "neutral"
    }
  ]
}
```

**Usage in Flow**:
1. Open node library
2. Find "Stat Card" under interface category
3. Drag onto canvas
4. Connect upstream node providing stats data
5. Node renders statistics with trend indicators

### 3. Removed Components

The following have been completely removed:
- `table` layout template
- `post-list` layout template
- Associated HTML templates
- Associated React components

## Testing the Changes

### Manual Test 1: Node Library Display

1. Start the app: `.specify/scripts/bash/serve-app.sh`
2. Open browser to frontend URL
3. Create or open a flow
4. Open node library
5. Verify "Stat Card" appears under interface category

### Manual Test 2: Stat Card Rendering

1. Add a Stat Card node to canvas
2. Connect to a data source providing stats format
3. Run the flow
4. Verify stats display with correct values and trend colors

### Manual Test 3: Existing Nodes Work

1. Verify all existing nodes (UserIntent, ApiCall, Return, CallFlow, Interface) still function
2. Create a simple flow using each node type
3. Execute flows and verify behavior unchanged

## File Reference

| Purpose | File Path |
|---------|-----------|
| StatCardNode definition | `packages/nodes/src/nodes/interface/StatCardNode.ts` |
| Node registry | `packages/nodes/src/nodes/index.ts` |
| Layout types | `packages/shared/src/types/app.ts` |
| Stats HTML template | `packages/backend/src/mcp/templates/stats.html` |
| Stats React component | `packages/frontend/src/components/ui/stats.tsx` |
| Layout renderer | `packages/frontend/src/components/editor/LayoutRenderer.tsx` |

## Troubleshooting

### Import Errors After Refactor

If you see import resolution errors:
```bash
# Rebuild all packages
pnpm clean && pnpm build
```

### Stat Card Not Appearing in Library

1. Check `packages/nodes/src/nodes/index.ts` includes StatCardNode
2. Verify build completed: `pnpm build`
3. Restart dev servers

### Layout Errors for Old Flows

Flows using `table` or `post-list` layouts will fail. This is expected.
Update flow to use `stat-card` or remove the interface node.
