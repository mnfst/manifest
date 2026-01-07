# Research: UI Selection Architecture Refactor

**Feature Branch**: `001-ui-selection`
**Date**: 2026-01-07

## Research Areas

### 1. Node Folder Structure Reorganization

**Decision**: Organize nodes by category subfolders matching `NodeTypeCategory` enum values.

**Rationale**:
- Current flat structure (5 files) becomes harder to navigate as node count grows
- Category-based organization matches the existing `category` property on each node
- Barrel exports in each subfolder maintain clean import paths

**Implementation Pattern**:
```text
nodes/
├── index.ts           # Re-exports from all subfolders
├── trigger/
│   ├── index.ts       # export { UserIntentNode } from './UserIntentNode.js'
│   └── UserIntentNode.ts
├── action/
│   ├── index.ts
│   └── ApiCallNode.ts
├── interface/
│   ├── index.ts
│   ├── InterfaceNode.ts
│   └── StatCardNode.ts  # NEW
└── return/
    ├── index.ts
    ├── ReturnNode.ts
    └── CallFlowNode.ts
```

**Backward Compatibility Strategy**:
- Root `nodes/index.ts` re-exports all nodes from subfolders
- Existing imports (`from './nodes/InterfaceNode.js'`) continue to work via package.json exports
- No breaking changes to consumers

**Alternatives Considered**:
- Keep flat structure: Rejected - doesn't scale as more nodes added
- Group by functionality (io, flow-control): Rejected - category is already defined, use it

---

### 2. Manifest UI Stats Component Structure

**Decision**: Create StatCardNode based on the Manifest UI stats.json component.

**Rationale**:
- Provides a clean, tested component structure from the Manifest UI ecosystem
- Supports all required features: label, value, change, trend indicators
- Matches the pattern already used for table and blog-post-list

**Component Props Interface** (from stats.json):
```typescript
interface StatCardData {
  label: string;          // Metric name (e.g., "Sales")
  value: string | number; // Display value (e.g., "$12,543")
  change?: number;        // Percentage change (e.g., 12.5)
  changeLabel?: string;   // Description (e.g., "vs last month")
  trend?: 'up' | 'down' | 'neutral'; // Trend direction
}

interface StatsInputData {
  stats: StatCardData[];
}
```

**Visual Features**:
- Responsive grid layout (2 columns mobile, 3 columns desktop)
- Color-coded trend indicators: green (up), red (down), gray (neutral)
- Lucide React icons: TrendingUp, TrendingDown, Minus

**Alternatives Considered**:
- Custom component from scratch: Rejected - Manifest UI provides tested, styled component
- Multiple separate stat nodes: Rejected - single stats component handles array of stats

---

### 3. Table/Post-List Removal Scope

**Decision**: Complete removal of all traces from codebase.

**Files to Remove/Modify**:

| File | Action | Notes |
|------|--------|-------|
| `packages/shared/src/types/app.ts` | MODIFY | Remove `table` and `post-list` from LayoutTemplate type |
| `packages/backend/src/mcp/templates/table.html` | DELETE | Remove HTML template |
| `packages/backend/src/mcp/templates/post-list.html` | DELETE | Remove HTML template |
| `packages/backend/src/agent/tools/layout-selector.ts` | MODIFY | Update for stat-card only |
| `packages/frontend/src/components/ui/table.tsx` | DELETE | Remove React component |
| `packages/frontend/src/components/ui/blog-post-list.tsx` | DELETE | Remove React component |
| `packages/frontend/src/components/ui/blog-post-card.tsx` | DELETE | Remove React component |
| `packages/frontend/src/components/editor/LayoutRenderer.tsx` | MODIFY | Update for stat-card only |

**Rationale**:
- User explicitly requested removal of all traces
- Clean slate approach for the new UI component system
- Reduces confusion about which UIs are available

**Risk Mitigation**:
- Existing flows using table/post-list may break - this is acceptable per user request
- Version control preserves history if needed later

---

### 4. StatCardNode Implementation Pattern

**Decision**: Create as a new node type in the interface category.

**Node Definition Structure**:
```typescript
const StatCardNode: NodeTypeDefinition = {
  name: 'StatCard',
  displayName: 'Stat Card',
  icon: 'bar-chart-3',  // Lucide icon
  group: ['ui', 'display', 'stats'],
  category: 'interface',
  description: 'Display statistical metrics with trend indicators',

  inputs: ['main'],
  outputs: [],  // Read-only - no outputs for now

  defaultParameters: {
    layoutTemplate: 'stat-card',
  },

  inputSchema: {
    type: 'object',
    properties: {
      stats: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: ['string', 'number'] },
            change: { type: 'number' },
            changeLabel: { type: 'string' },
            trend: { type: 'string', enum: ['up', 'down', 'neutral'] }
          },
          required: ['label', 'value']
        }
      }
    }
  },

  outputSchema: null,  // Read-only node

  execute: async (context) => ({
    success: true,
    output: { type: 'interface', layoutTemplate: 'stat-card' }
  })
};
```

**Rationale**:
- Follows existing InterfaceNode pattern
- Read-only (no outputs) as specified in requirements
- inputSchema enables design-time validation
- Future: Can add outputs like `action:click` when interactivity needed

---

### 5. Package.json Exports Update

**Decision**: Update exports field to support new folder structure.

**Current Exports** (package.json):
```json
{
  "./nodes": "./dist/nodes/index.js",
  "./nodes/InterfaceNode": "./dist/nodes/InterfaceNode.js"
}
```

**Updated Exports**:
```json
{
  "./nodes": "./dist/nodes/index.js",
  "./nodes/*": "./dist/nodes/*"
}
```

**Rationale**:
- Wildcard pattern supports any subfolder organization
- Maintains backward compatibility with direct imports
- Simplifies maintenance as more nodes added

---

### 6. HTML Template for Stats Component

**Decision**: Create `stats.html` template following existing table.html pattern.

**Template Structure**:
- Same CSS variables and theme support as table.html
- Responsive grid layout
- Color-coded trend indicators using CSS classes
- JavaScript to receive data via postMessage API

**Data Format Expected**:
```javascript
{
  structuredContent: {
    stats: [
      { label: "Sales", value: "$12,543", change: 12.5, trend: "up" },
      { label: "Orders", value: "342", change: -3.2, trend: "down" },
      { label: "Customers", value: "1,205", change: 0, trend: "neutral" }
    ]
  }
}
```

---

## Summary of Decisions

| Area | Decision | Confidence |
|------|----------|------------|
| Folder structure | Category-based subfolders | High |
| Stats component | Based on Manifest UI stats.json | High |
| Table/post-list removal | Complete removal | High |
| StatCardNode | New interface node, read-only | High |
| Package exports | Wildcard pattern | High |
| HTML template | Follow table.html pattern | High |

## Open Questions (None)

All technical decisions have been resolved through research.
