# Quickstart: UI Component Actions

**Feature**: 015-ui-actions
**Date**: 2025-12-28

## Overview

This feature enables UI component actions in the flow diagram. Views display action handles that can be connected to return values or call flows via drag-and-drop.

---

## Prerequisites

- Node.js >= 18.0.0
- pnpm 9.0.0+
- Existing generator codebase with backend, frontend, and shared packages

---

## Implementation Order

### Phase 1: Shared Types (15 min)

1. **Add LayoutAction interface and extend LAYOUT_REGISTRY**
   - File: `packages/shared/src/types/app.ts`
   - Add `LayoutAction` interface
   - Add `actions: LayoutAction[]` to registry entries

2. **Create ActionConnection types**
   - File: `packages/shared/src/types/action-connection.ts` (new)
   - Export from `packages/shared/src/index.ts`

### Phase 2: Backend Entity & Module (30 min)

1. **Create ActionConnectionEntity**
   - File: `packages/backend/src/action-connection/action-connection.entity.ts` (new)
   - Follow CallFlowEntity pattern

2. **Create ActionConnectionModule**
   - Files: `action-connection.module.ts`, `action-connection.service.ts`, `action-connection.controller.ts` (new)
   - Register in `app.module.ts`

### Phase 3: Frontend Flow Diagram (45 min)

1. **Extend ViewNode with action handles**
   - File: `packages/frontend/src/components/flow-diagram/ViewNode.tsx`
   - Add source handles for each action from LAYOUT_REGISTRY

2. **Add action connection edges**
   - File: `packages/frontend/src/components/flow-diagram/FlowDiagram.tsx`
   - Fetch action connections via API
   - Generate edges from action handles to targets

3. **Handle connection events**
   - Implement `onConnect` for action handles
   - Call API to persist connections

### Phase 4: Widget Action Triggers (30 min)

1. **Add action handler to widget HTML**
   - File: `packages/backend/src/mcp-tool/mcp-tool.service.ts`
   - Inject click handlers in rendered component HTML

2. **Handle action invocation**
   - Look up ActionConnection for triggered action
   - Execute connected target (return value or call flow)

---

## Quick Validation

After each phase, validate:

1. **Phase 1**: Run `pnpm type-check` - no TypeScript errors
2. **Phase 2**: Start backend, verify `/api/views/:viewId/action-connections` endpoint responds
3. **Phase 3**: Open flow with post-list view, verify "onReadMore" handle appears
4. **Phase 4**: Execute tool, click action button, verify target executes

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/shared/src/types/app.ts` | LAYOUT_REGISTRY with actions |
| `packages/shared/src/types/action-connection.ts` | ActionConnection types |
| `packages/backend/src/action-connection/` | Backend module (entity, service, controller) |
| `packages/frontend/src/components/flow-diagram/ViewNode.tsx` | Action handles display |
| `packages/frontend/src/components/flow-diagram/FlowDiagram.tsx` | Action edges |
| `packages/backend/src/mcp-tool/mcp-tool.service.ts` | Widget action handlers |

---

## Common Issues

### Action handles not appearing
- Verify LAYOUT_REGISTRY has `actions` array for the layout template
- Check ViewNode renders handles when `actions.length > 0`

### Edges not connecting
- Ensure `sourceHandle` matches action name exactly
- Verify ActionConnection is created in database

### Widget actions not triggering
- Check data-action attributes in rendered HTML
- Verify triggerAction function is included in widget script

---

## Testing Checklist

- [ ] Create flow with post-list view
- [ ] Verify "onReadMore" handle visible on ViewNode
- [ ] Drag connection from handle to ReturnValue node
- [ ] Verify edge appears and persists after refresh
- [ ] Execute MCP tool, verify widget renders
- [ ] Click "Read More" in widget, verify return value delivered
- [ ] Delete connection, verify action still clickable but no effect
- [ ] Delete target, verify connection removed gracefully
