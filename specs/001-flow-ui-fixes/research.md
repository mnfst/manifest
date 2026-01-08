# Research: Flow UI Fixes

**Date**: 2026-01-08
**Feature**: 001-flow-ui-fixes

## Bug Analysis & Root Causes

### Bug #1: Preview Tab Disabled When No UI Nodes

**Location**: `packages/frontend/src/pages/FlowDetail.tsx:577-582`

**Current Code**:
```typescript
const nodes = flow.nodes ?? [];
const interfaceNodes = nodes.filter(n => n.type === 'StatCard' || n.type === 'PostList');
// ...
{ id: 'preview', label: 'Preview', icon: Eye, disabled: interfaceNodes.length === 0 },
```

**Root Cause**: The Preview tab's `disabled` property is set based on whether UI nodes (StatCard or PostList) exist. This prevents users from previewing flows that have other node types but no UI components.

**Decision**: Change the condition to check if the flow has any executable nodes (`nodes.length > 0`) rather than requiring UI nodes specifically.

**Rationale**: Users should be able to test flow logic without requiring a visual interface component. The preview can show raw output or a generic chat interface.

**Alternatives Considered**:
- Keep current behavior but add a tooltip explaining why Preview is disabled - Rejected because it doesn't solve the user need
- Add a separate "Test" tab for non-UI flows - Rejected as over-engineering for a POC

---

### Bug #2: Transformer Node Not Appearing After Insertion

**Location**: `packages/frontend/src/components/flow/FlowDiagram.tsx:718-722`

**Current Code**:
```typescript
onTransformerInserted={() => {
  // Close the modal and trigger a refresh of the flow data
  setSelectedConnection(null);
  // The parent component should handle refreshing the flow data
}}
```

**Root Cause**: The `onTransformerInserted` callback in FlowDiagram only closes the modal but doesn't actually refresh the flow data. The comment says "parent component should handle refreshing" but FlowDiagram doesn't expose a callback prop for this, and FlowDetail doesn't provide one.

**Secondary Issue**: The backend `insertTransformer` response contains the updated flow data, but the hook doesn't propagate it.

**Decision**: Add an `onFlowUpdate` prop to FlowDiagram that FlowDetail can use to refresh the flow state after transformer insertion. The callback should receive the updated flow data.

**Rationale**: This follows the existing pattern used for other mutations (e.g., `onConnectionsChange`).

**Alternatives Considered**:
- Have FlowDiagram internally call api.getFlow() - Rejected because it violates single responsibility and doesn't sync with parent state
- Use a global state/context for flow - Over-engineering for POC

---

### Bug #3: Share Modal URLs Missing Production Domain

**Location**: `packages/frontend/src/components/app/ShareModal.tsx:18-19`

**Current Code**:
```typescript
const landingPageUrl = `${BACKEND_URL}/servers/${appSlug}`;
const mcpEndpointUrl = `${BACKEND_URL}/servers/${appSlug}/mcp`;
```

**BACKEND_URL Source**: `packages/frontend/src/lib/api.ts:100`
```typescript
export const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3847';
```

**Root Cause**: In production, `VITE_API_URL` is set to `""` (empty string) for same-origin relative URLs. The nullish coalescing operator (`??`) correctly handles this, but empty string results in URLs like `/servers/...` which don't include the domain.

**Decision**: For the share modal specifically, we need to construct absolute URLs using `window.location.origin` when `BACKEND_URL` is empty or relative.

**Rationale**: Share URLs must be absolute because they're copied/shared externally.

**Implementation**:
```typescript
const getAbsoluteUrl = (path: string) => {
  if (BACKEND_URL && !BACKEND_URL.startsWith('http')) {
    return `${window.location.origin}${path}`;
  }
  if (!BACKEND_URL) {
    return `${window.location.origin}${path}`;
  }
  return `${BACKEND_URL}${path}`;
};
```

**Alternatives Considered**:
- Add a separate environment variable for public URLs - Over-engineering
- Always use window.location.origin - Would break dev environments where backend is on different port

---

### Bug #4: PostList Node Creation Not Working

**Location**: `packages/frontend/src/pages/FlowDetail.tsx:256-281`

**Current Code**:
```typescript
const handleNodeLibrarySelect = useCallback(async (nodeType: NodeType) => {
  // For StatCard and PostList, skip the modal and create directly with defaults
  if ((nodeType === 'StatCard' || nodeType === 'PostList') && flowId && flow) {
    // ... creates node ...
  }
  // ... rest of handler
}, [flowId, flow]);
```

**Observed Behavior**: "Nothing happens when we add it" - suggesting the API call might be failing silently or the flow state isn't updating.

**Root Cause Analysis**:
1. The catch block only logs to console, no user feedback
2. The code looks correct - need to verify runtime behavior
3. Possible issue: `flow` dependency might be stale

**Decision**: Add error handling feedback and ensure flow state is fresh before creating nodes.

**Investigation Points**:
- Check if `api.createNode` is being called
- Check if the API returns an error
- Check if `setFlow` is triggering a re-render

---

### Bug #5: API Key Settings Link Missing

**Location**: `packages/frontend/src/components/chat/PreviewChat.tsx:178-189`

**Current Code**:
```typescript
if (!hasApiKey) {
  return (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center">
      <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">API Key Required</h3>
      <p className="text-muted-foreground text-sm max-w-md">
        To use the chat preview, please configure your OpenAI API key in Settings &gt; API Keys.
      </p>
    </div>
  );
}
```

**Root Cause**: The message mentions "Settings > API Keys" as text but doesn't provide a clickable link.

**Decision**: Replace the text with a React Router Link to `/settings` (which defaults to the api-keys tab).

**Rationale**: Users shouldn't have to manually navigate; one click should take them to the right place.

---

## Technical Decisions Summary

| Bug | Decision | File(s) to Modify |
|-----|----------|-------------------|
| #1 | Change disabled condition to `nodes.length === 0` | FlowDetail.tsx |
| #2 | Add `onFlowUpdate` prop, call it after transformer insertion | FlowDiagram.tsx, FlowDetail.tsx |
| #3 | Create `getAbsoluteUrl` helper using `window.location.origin` | ShareModal.tsx |
| #4 | Add error feedback, verify state updates | FlowDetail.tsx |
| #5 | Add Link component to navigate to settings | PreviewChat.tsx |

## Dependencies

No new dependencies required. All fixes use existing React, React Router, and application patterns.
