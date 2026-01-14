# Quickstart: Registry-Based UI Nodes

**Feature**: 091-registry-items
**Date**: 2026-01-13

## Prerequisites

- Node.js >= 18.0.0
- pnpm 9.x
- Running development environment (`pnpm dev`)

## Configuration

### Environment Variables

| Variable | Location | Default | Description |
|----------|----------|---------|-------------|
| `VITE_REGISTRY_URL` | `packages/frontend/.env` | `https://ui.manifest.build/r` | Base URL for registry API |

**Example** (optional, for custom registry):
```bash
# packages/frontend/.env
VITE_REGISTRY_URL=https://custom-registry.example.com/r
```

## Key Implementation Files

### Frontend

| File | Purpose |
|------|---------|
| `src/services/registry.ts` | Registry API client |
| `src/types/registry.ts` | TypeScript type definitions |
| `src/components/flow/NodeLibrary/NodeLibrary.tsx` | Modified for category navigation |
| `src/components/flow/NodeLibrary/CategoryList.tsx` | New: Registry category grid |
| `src/components/flow/NodeLibrary/RegistryItemList.tsx` | New: Items within category |
| `src/components/flow/NodeLibrary/RegistryItemSkeleton.tsx` | New: Loading skeleton |

### Backend

| File | Purpose |
|------|---------|
| `src/flow/flow.service.ts` | Migration to delete old flows |

### Nodes Package

| Action | Files |
|--------|-------|
| DELETE | `src/nodes/interface/` (entire folder) |
| MODIFY | `src/nodes/index.ts` (remove interface exports) |

### Shared Package

| File | Purpose |
|------|---------|
| `src/types/registry.ts` | Shared registry type definitions |

## Development Flow

### 1. Start Development Server

```bash
pnpm dev
```

### 2. Access Node Library

1. Open any flow in the editor
2. Click "Add Step" or open the node library
3. Click "UIs" category
4. See registry categories load (with skeleton during fetch)
5. Click a category to see components
6. Click a component to add to canvas

### 3. Testing Registry Fetch

```typescript
// In browser console (frontend dev)
const response = await fetch('https://ui.manifest.build/r/registry.json');
const data = await response.json();
console.log('Categories:', [...new Set(data.items.map(i => i.category))]);
console.log('Total items:', data.items.length);
```

### 4. Testing Component Detail Fetch

```typescript
// In browser console
const detail = await fetch('https://ui.manifest.build/r/post-card.json');
const data = await detail.json();
console.log('Files:', data.files.length);
console.log('First file content length:', data.files[0]?.content?.length);
```

## Key Behaviors

### Navigation Flow

```
NodeLibrary (root)
    │
    ├── Triggers
    ├── UIs ─────────────┐
    │                    │ Click
    │                    ▼
    │              Registry Categories
    │                    │
    │                    │ Click category
    │                    ▼
    │              Registry Items
    │                    │
    │                    │ Click item
    │                    ▼
    │              Fetch detail → Add to canvas
    │
    ├── Actions
    ├── Transform
    └── Output
```

### Loading States

- **Registry list loading**: Skeleton items in UIs section
- **Component detail loading**: Loading indicator on click
- **Error state**: Error message, re-click to retry

### Node Data Storage

When a registry component is added:
```json
{
  "id": "uuid",
  "slug": "post_card_1",
  "type": "RegistryComponent",
  "name": "Post Card",
  "position": { "x": 100, "y": 200 },
  "parameters": {
    "registryName": "post-card",
    "version": "2.0.2",
    "title": "Post Card",
    "description": "...",
    "category": "blogging",
    "dependencies": ["lucide-react"],
    "registryDependencies": ["button"],
    "files": [
      {
        "path": "registry/blogging/post-card.tsx",
        "type": "registry:component",
        "content": "// Full source code..."
      }
    ]
  }
}
```

## Migration

### Automatic Cleanup

When the migration runs, it deletes:
1. All flows containing `StatCard` or `PostList` nodes
2. The `packages/nodes/src/nodes/interface/` folder

### Manual Verification

After migration, verify:
```bash
# Check no flows with old node types
sqlite3 packages/backend/data/generator.db \
  "SELECT id FROM flows WHERE nodes LIKE '%StatCard%' OR nodes LIKE '%PostList%'"
# Should return empty
```

## Troubleshooting

### Registry Not Loading

1. Check network tab for `registry.json` request
2. Verify CORS headers are present
3. Check `VITE_REGISTRY_URL` if using custom registry

### Component Add Fails

1. Check network tab for `{component-name}.json` request
2. Verify component exists in registry
3. Check for JSON parse errors in console

### Old Nodes Still Visible

1. Run migration to delete affected flows
2. Clear browser cache
3. Restart development server
