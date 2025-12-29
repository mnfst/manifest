# Quickstart: MCP Tool Parameters

**Feature**: 001-tool-params
**Date**: 2025-12-28

## Prerequisites

- Node.js >= 18.0.0
- pnpm 9.x
- SQLite (bundled via better-sqlite3)

## Setup

```bash
# Install dependencies
pnpm install

# Start development servers (backend + frontend)
pnpm dev
```

Backend runs on `http://localhost:3001`
Frontend runs on `http://localhost:5173`

## Implementation Order

### Phase 1: Shared Types
1. Add `FlowParameter` interface to `packages/shared/src/types/flow.ts`
2. Add `ParameterType` type union
3. Update `Flow`, `CreateFlowRequest`, `UpdateFlowRequest` interfaces
4. Build shared package: `pnpm --filter @chatgpt-app-builder/shared build`

### Phase 2: Backend Entity
1. Add `parameters` column to `FlowEntity` in `packages/backend/src/flow/flow.entity.ts`
2. Column type: `simple-json`, nullable, default empty array
3. Restart backend to auto-sync schema

### Phase 3: Backend API
1. Update `FlowController.createFlow()` to accept parameters
2. Update `FlowController.updateFlow()` to accept parameters
3. Add validation in controller (unique names, valid types)
4. Update `FlowService.entityToFlow()` to include parameters

### Phase 4: Frontend Components
1. Create `ParameterEditor.tsx` component
2. Update `CreateFlowModal.tsx` to include parameter editor
3. Update `EditFlowForm.tsx` to include parameter editor
4. Update `FlowCard.tsx` to display parameter count

## Key Files to Modify

| Package | File | Change |
|---------|------|--------|
| shared | `src/types/flow.ts` | Add Parameter types |
| backend | `src/flow/flow.entity.ts` | Add parameters column |
| backend | `src/flow/flow.controller.ts` | Update create/update endpoints |
| backend | `src/flow/flow.service.ts` | Update entity mapping |
| frontend | `src/components/flow/ParameterEditor.tsx` | New component |
| frontend | `src/components/flow/CreateFlowModal.tsx` | Add parameter editor |
| frontend | `src/components/flow/EditFlowForm.tsx` | Add parameter editor |
| frontend | `src/components/flow/FlowCard.tsx` | Display param count |

## Validation Checklist

- [ ] Can create flow with 0 parameters
- [ ] Can create flow with 1+ parameters
- [ ] Can edit existing flow parameters
- [ ] Can remove parameters from flow
- [ ] Parameter count displays on flow cards
- [ ] Duplicate parameter names rejected
- [ ] Empty parameter names rejected
- [ ] All 4 types work (string, number, integer, boolean)
- [ ] Optional checkbox persists correctly
- [ ] Parameters survive page refresh

## API Examples

### Create Flow with Parameters
```bash
curl -X POST http://localhost:3001/api/apps/{appId}/flows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Search Products",
    "description": "Search product catalog",
    "parameters": [
      {"name": "query", "type": "string", "optional": false},
      {"name": "limit", "type": "integer", "optional": true}
    ]
  }'
```

### Update Flow Parameters
```bash
curl -X PATCH http://localhost:3001/api/flows/{flowId} \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": [
      {"name": "query", "type": "string", "optional": false},
      {"name": "limit", "type": "integer", "optional": true},
      {"name": "includeInactive", "type": "boolean", "optional": true}
    ]
  }'
```
