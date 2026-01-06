# Quickstart: Remove Mock Data and Add Default Test Fixtures

**Date**: 2026-01-06
**Feature**: 020-remove-mock-data

## Prerequisites

- Node.js 18+
- pnpm 9.x
- Repository cloned and dependencies installed (`pnpm install`)

---

## Implementation Order

Execute tasks in this order to minimize broken builds:

### Phase 1: Remove Shared Types (Foundation)

1. **Edit `packages/shared/src/types/node.ts`**
   - Remove all mock data types, interfaces, and constants
   - Update `InterfaceNodeParameters` to remove `mockData` field

2. **Edit `packages/shared/src/index.ts`**
   - Remove all mock data exports

3. **Run type check**: `pnpm type-check` - expect errors in dependent packages

### Phase 2: Update Nodes Package

4. **Edit `packages/nodes/src/nodes/InterfaceNode.ts`**
   - Remove `DEFAULT_TABLE_MOCK_DATA` import
   - Remove `mockData` from `defaultParameters`
   - Update execute method to not return mock data

5. **Run type check**: `cd packages/nodes && pnpm type-check`

### Phase 3: Update Backend

6. **Delete `packages/backend/src/agent/tools/mock-data-generator.ts`**

7. **Edit `packages/backend/src/agent/tools/index.ts`**
   - Remove `mockDataGeneratorTool` export

8. **Edit `packages/backend/src/agent/agent.service.ts`**
   - Remove mock data imports
   - Remove `mockData` from `GenerateAppResult`
   - Remove `mockData` from `GenerateFlowResult`
   - Delete `ProcessMockDataChatResult` interface
   - Delete `processMockDataChat()` method
   - Remove mock data generation from `generateApp()`
   - Remove mock data regeneration from `processChat()`
   - Remove mock data regeneration from `processInterfaceNodeChat()`

9. **Add seeding to `packages/backend/src/app/app.service.ts`**
   - Implement `OnModuleInit` interface
   - Add `seedDefaultFixtures()` method
   - Call it from `onModuleInit()`

10. **Run backend type check**: `cd packages/backend && pnpm type-check`

### Phase 4: Update Frontend

11. **Delete `packages/frontend/src/components/flow/MockDataModal.tsx`**

12. **Delete `packages/frontend/src/components/flow/MockDataNode.tsx`**

13. **Edit `packages/frontend/src/components/flow/FlowDiagram.tsx`**
    - Remove `MockDataNode` import
    - Remove `mockDataNode` from `nodeTypes`
    - Remove mock data node creation in `computedNodes`
    - Remove `onMockDataEdit` prop handling

14. **Edit `packages/frontend/src/components/flow/NodeEditModal.tsx`**
    - Remove mock data imports
    - Remove `mockData` state
    - Remove `getDefaultMockData()` helper
    - Remove mock data from form submission

15. **Edit `packages/frontend/src/pages/FlowDetail.tsx`**
    - Remove `onMockDataEdit` handler
    - Remove mock data modal state
    - Remove `MockDataModal` component usage

16. **Edit `packages/frontend/src/components/editor/VisualDisplay.tsx`**
    - Remove `DEFAULT_TABLE_MOCK_DATA` import and fallback

17. **Edit `packages/frontend/src/components/editor/LayoutRenderer.tsx`**
    - Handle undefined `mockData` gracefully

18. **Run frontend type check**: `cd packages/frontend && pnpm type-check`

### Phase 5: Final Verification

19. **Full build**: `pnpm build`

20. **Search for remaining references**: `grep -r "mockData\|MockData" packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "\.d\.ts"`

21. **Start application**: `.specify/scripts/bash/serve-app.sh`

22. **Verify default fixtures created** (check console logs for seeding message)

---

## Testing Checklist

- [ ] Application starts without errors
- [ ] Default "Test App" exists on first startup
- [ ] Default "Test Flow" exists within Test App
- [ ] Can create new Interface nodes without mock data errors
- [ ] Interface nodes save only with `layoutTemplate` parameter
- [ ] No TypeScript errors in any package
- [ ] Build succeeds for all packages

---

## Rollback Plan

If issues arise:

1. `git stash` any work in progress
2. `git checkout main -- packages/` to restore original files
3. `pnpm install` to ensure dependencies are clean
4. `pnpm build` to verify rollback

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/shared/src/types/node.ts` | Type definitions - start here |
| `packages/shared/src/index.ts` | Public exports from shared package |
| `packages/nodes/src/nodes/InterfaceNode.ts` | Node type definition with defaults |
| `packages/backend/src/agent/agent.service.ts` | Agent orchestration service |
| `packages/backend/src/app/app.service.ts` | App CRUD + seeding logic |
| `packages/frontend/src/components/flow/FlowDiagram.tsx` | React Flow diagram with node types |
| `packages/frontend/src/components/flow/NodeEditModal.tsx` | Node creation/edit form |
