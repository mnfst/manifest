# Research: Registry-Based UI Nodes

**Feature**: 091-registry-items
**Date**: 2026-01-13

## Registry Data Format

### Decision: Use external registry format as-is, transform on frontend

**Rationale**: The registry at `https://ui.manifest.build/r/registry.json` provides a well-structured format. Transforming on the frontend keeps the backend simple and allows for direct fetching without proxying.

**Registry List Response** (`registry.json`):
```typescript
interface RegistryResponse {
  $schema: string;
  name: string;
  homepage: string;
  items: RegistryItem[];
}

interface RegistryItem {
  name: string;           // e.g., "post-card"
  version: string;        // e.g., "2.0.2"
  type: string;           // "registry:block" or "registry:component"
  title: string;          // e.g., "Post Card"
  description: string;    // Component description
  category: string;       // e.g., "blogging", "form", "payment"
  dependencies: string[]; // npm packages, e.g., ["lucide-react"]
  registryDependencies: string[]; // other registry items, e.g., ["button"]
  files: { path: string; type: string }[]; // file metadata only
}
```

**Component Detail Response** (`{name}.json`):
```typescript
interface ComponentDetail extends RegistryItem {
  $schema: string;
  changelog?: Record<string, string>;
  files: ComponentFile[];
}

interface ComponentFile {
  path: string;      // e.g., "registry/blogging/post-card.tsx"
  type: string;      // e.g., "registry:component"
  content: string;   // Full source code
}
```

**Alternatives Considered**:
1. Proxy through backend - Adds complexity, latency; CORS not an issue for this registry
2. Cache in backend - Rejected per clarification (no caching requirement)

---

## Category Navigation Pattern

### Decision: Add dynamic registry categories as sub-level under "UIs" category

**Rationale**: The existing NodeLibrary uses a two-level pattern (category → nodes). Registry items should integrate as a third level under the existing "interface" category: interface → registry categories → registry items.

**Current Flow**:
```
NodeLibrary (groups view)
  ├── Triggers
  ├── UIs → [StatCard, PostList] (static)
  ├── Actions
  ├── Transform
  └── Output
```

**New Flow**:
```
NodeLibrary (groups view)
  ├── Triggers
  ├── UIs → (dynamic registry categories)
  │   ├── Form → [Contact Form, Date Picker, ...]
  │   ├── Payment → [Card Form, Checkout Summary, ...]
  │   ├── List → [Product List, Data Table, ...]
  │   ├── Blogging → [Post Card, Post List, ...]
  │   ├── Messaging → [Message Bubble, Conversation, ...]
  │   ├── Events → [Event Card, Event List, ...]
  │   └── Miscellaneous → [Badge, Progress, ...]
  ├── Actions
  ├── Transform
  └── Output
```

**Alternatives Considered**:
1. Replace entire category system with registry - Too disruptive, loses non-UI node organization
2. Mix static and registry nodes at same level - UI would be cluttered with 50+ items

---

## Node Data Storage

### Decision: Store complete component code in node `parameters`

**Rationale**: When adding a registry component, store the full ComponentDetail (including file contents) in the node's `parameters` field. This makes flows self-contained and supports offline rendering.

**Node Instance Structure**:
```typescript
interface NodeInstance {
  id: string;
  slug: string;
  type: 'RegistryComponent';  // New node type for all registry items
  name: string;               // User-editable display name
  position: { x: number; y: number };
  parameters: {
    // Registry component data
    registryName: string;     // e.g., "post-card"
    version: string;          // e.g., "2.0.2"
    title: string;            // e.g., "Post Card"
    description: string;
    category: string;         // e.g., "blogging"
    dependencies: string[];
    registryDependencies: string[];
    files: ComponentFile[];   // Full source code
    // Component appearance/config
    variant?: string;
    // ... other component-specific config
  };
}
```

**Alternatives Considered**:
1. Store only registry name, fetch on render - Requires network, breaks offline
2. Store URL reference - Same offline issues
3. Create separate node type per registry item - 50+ node types, not scalable

---

## Frontend Data Fetching

### Decision: Direct fetch from registry URL, no backend proxy

**Rationale**: The registry API has CORS headers allowing direct access. No caching required per clarifications, so frontend can fetch directly.

**Implementation**:
```typescript
// packages/frontend/src/services/registry.ts

const DEFAULT_REGISTRY_URL = 'https://ui.manifest.build/r';

export async function fetchRegistry(): Promise<RegistryItem[]> {
  const baseUrl = import.meta.env.VITE_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
  const response = await fetch(`${baseUrl}/registry.json`);
  const data = await response.json();
  return data.items;
}

export async function fetchComponentDetail(name: string): Promise<ComponentDetail> {
  const baseUrl = import.meta.env.VITE_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
  const response = await fetch(`${baseUrl}/${name}.json`);
  return response.json();
}
```

**Environment Variable**: `VITE_REGISTRY_URL` (frontend env var for Vite)

**Alternatives Considered**:
1. Backend proxy endpoint - Unnecessary complexity, CORS not an issue
2. GraphQL aggregation - Over-engineered for this use case

---

## Loading State Pattern

### Decision: Skeleton items in UI section during fetch

**Rationale**: Per clarification, show skeleton/placeholder items only in the UI section while loading. Other categories remain accessible.

**Implementation**:
```tsx
// Skeleton component for loading state
function RegistryItemSkeleton() {
  return (
    <div className="animate-pulse p-4 border rounded-lg">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-full" />
        </div>
      </div>
    </div>
  );
}
```

**Alternatives Considered**:
1. Full-page loader - Blocks access to other categories
2. No indicator - Poor UX, users don't know if loading

---

## Error Handling Pattern

### Decision: Show error message, user re-clicks to retry

**Rationale**: Per clarification, no automatic retry or retry button. Simple error display, user initiates retry by re-clicking.

**Error States**:
1. Registry list fetch fails → Show error in UI category, allow browsing other categories
2. Component detail fetch fails → Show error toast/message, component not added
3. Invalid JSON → Show parsing error message

**Alternatives Considered**:
1. Auto-retry - Adds complexity, may mask persistent issues
2. Retry button - Extra UI element, not needed

---

## Migration Strategy

### Decision: Delete flows with old interface nodes, remove static node definitions

**Rationale**: Per clarification, breaking change is acceptable (no production data). Delete all flows containing PostListNode or StatCardNode.

**Migration Steps**:
1. Delete `packages/nodes/src/nodes/interface/` folder entirely
2. Remove interface node exports from `packages/nodes/src/nodes/index.ts`
3. Add database migration to delete flows with old node types
4. Update frontend to handle missing node types gracefully

**Files to Delete**:
- `packages/nodes/src/nodes/interface/StatCardNode.ts`
- `packages/nodes/src/nodes/interface/PostListNode.ts`
- `packages/nodes/src/nodes/interface/index.ts`

**Alternatives Considered**:
1. Keep old nodes, dual system - Confusion, maintenance burden
2. Auto-migrate to registry equivalents - Complex mapping, overkill for POC

---

## View/Node Rendering

### Decision: Create new `RegistryComponentNode` React component

**Rationale**: Registry components need different rendering than static nodes. Store component code in node data, render preview/placeholder in canvas.

**Canvas Display**: Show component metadata (title, description, version) with a generic "UI Component" visual. Full rendering happens in preview/execution.

**Alternatives Considered**:
1. Dynamic code execution in canvas - Security risk, complexity
2. One component per registry item - Not scalable (50+ components)

---

## Summary of Key Decisions

| Area | Decision | Key Reason |
|------|----------|------------|
| Data Format | Transform registry format on frontend | Keep backend simple |
| Navigation | 3-level: UIs → Registry Category → Items | Organize 50+ components |
| Storage | Full component code in `parameters` | Offline support, self-contained |
| Fetching | Direct frontend fetch, no proxy | CORS works, no caching needed |
| Loading | Skeleton items in UI section only | Per clarification |
| Error Handling | Error message, re-click to retry | Per clarification |
| Migration | Delete flows with old nodes | Breaking change acceptable |
| Node Type | Single `RegistryComponent` type | Scalable for 50+ items |
