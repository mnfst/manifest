# Quickstart: Flow Return Value Support

**Feature Branch**: `001-flow-return-value`

## Overview

This feature enables MCP tools that return text directly to the LLM without requiring a UI. After defining a flow's user intent, users can now choose between adding a View (existing) or a Return Value step. Multiple return values can be added to a single flow.

## Key Concepts

### Return Value vs View

| Aspect | Return Value | View |
|--------|--------------|------|
| Purpose | Return text to LLM | Display UI to user |
| MCP Response | `content: [{type: "text", text: "..."}]` | `structuredContent` + widget |
| Multiple per flow | Yes (ordered) | Yes (ordered) |
| Editing | Text editor | Layout template editor |
| Entity | ReturnValueEntity | ViewEntity |

### Mutual Exclusivity

A flow can have **either**:
- One or more Views (existing behavior)
- One or more Return Values (new behavior)

**Not both.** This is enforced at the API level.

## User Flow

```
1. Create Flow → Define User Intent
                        ↓
2. Click "Add next step"
                        ↓
3. Side drawer opens with options:
   ┌─────────────────────────────────┐
   │  Choose step type               │
   ├─────────────────────────────────┤
   │  📊 View                        │
   │  Display data in a UI layout    │
   ├─────────────────────────────────┤
   │  📝 Return value                │
   │  Return text directly to LLM    │
   └─────────────────────────────────┘
                        ↓
4a. Select "View" → Existing view creation workflow
                        ↓
4b. Select "Return value" → Text editor opens
                        ↓
5. Edit text content and save
                        ↓
6. (Optional) Add more return values
```

## API Examples

### Create Return Value

```bash
curl -X POST http://localhost:3000/api/flows/{flowId}/return-values \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The operation completed successfully."
  }'
```

### List Return Values

```bash
curl http://localhost:3000/api/flows/{flowId}/return-values
```

### Update Return Value

```bash
curl -X PATCH http://localhost:3000/api/flows/{flowId}/return-values/{returnValueId} \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Updated content here."
  }'
```

### Delete Return Value

```bash
curl -X DELETE http://localhost:3000/api/flows/{flowId}/return-values/{returnValueId}
```

### Reorder Return Values

```bash
curl -X PATCH http://localhost:3000/api/flows/{flowId}/return-values/reorder \
  -H "Content-Type: application/json" \
  -d '{
    "orderedIds": ["uuid-2", "uuid-1", "uuid-3"]
  }'
```

### MCP Tool Call Response (Single Return Value)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "The operation completed successfully."
      }
    ],
    "isError": false
  }
}
```

### MCP Tool Call Response (Multiple Return Values)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Current conditions: Partly cloudy"
      },
      {
        "type": "text",
        "text": "Temperature: 72°F"
      },
      {
        "type": "text",
        "text": "Humidity: 45%"
      }
    ],
    "isError": false
  }
}
```

## Development Setup

No additional setup required. The feature uses existing:
- TypeORM (auto-syncs new entity)
- React Flow (custom nodes)
- Tailwind CSS (styling)

## Files to Create/Modify

### Backend (New Files)
- `packages/backend/src/return-value/return-value.entity.ts` - ReturnValue entity
- `packages/backend/src/return-value/return-value.service.ts` - CRUD operations
- `packages/backend/src/return-value/return-value.controller.ts` - REST endpoints
- `packages/backend/src/return-value/return-value.module.ts` - NestJS module

### Backend (Modifications)
- `packages/backend/src/flow/flow.entity.ts` - Add returnValues relation
- `packages/backend/src/flow/flow.service.ts` - Load returnValues in queries
- `packages/backend/src/view/view.service.ts` - Add mutual exclusivity check
- `packages/backend/src/mcp/mcp.tool.ts` - Handle return value execution
- `packages/backend/src/app.module.ts` - Import ReturnValueModule

### Frontend (New Files)
- `packages/frontend/src/components/flow/StepTypeDrawer.tsx` - Step type selection
- `packages/frontend/src/components/flow/ReturnValueNode.tsx` - Diagram node
- `packages/frontend/src/components/flow/ReturnValueEditor.tsx` - Text editor

### Frontend (Modifications)
- `packages/frontend/src/components/flow/AddViewNode.tsx` → Rename to `AddStepNode.tsx`
- `packages/frontend/src/components/flow/FlowDiagram.tsx` - Update node types
- `packages/frontend/src/pages/FlowDetail.tsx` - Add drawer integration
- `packages/frontend/src/lib/api.ts` - Add return value API methods

### Shared (New Files)
- `packages/shared/src/types/return-value.ts` - ReturnValue types

### Shared (Modifications)
- `packages/shared/src/types/flow.ts` - Add `returnValues` to Flow type
- `packages/shared/src/types/index.ts` - Export return-value types

## Testing

Manual testing checklist:

1. [ ] Create new flow, verify "Add next step" appears (not "Create your first view")
2. [ ] Click "Add next step", verify drawer opens with View and Return value options
3. [ ] Select "View", verify existing workflow works unchanged
4. [ ] Create another flow, select "Return value"
5. [ ] Edit return value text, save, verify persistence
6. [ ] Add a second return value to the same flow
7. [ ] Reorder return values, verify order persists
8. [ ] Delete a return value, verify removal
9. [ ] Return to flow, verify return value steps are displayed in order
10. [ ] Publish app with return value flow
11. [ ] Make MCP tool call, verify text content response format with all return values
12. [ ] Try to add view to return value flow, verify rejection
13. [ ] Try to add return value to view flow, verify rejection
