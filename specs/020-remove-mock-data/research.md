# Research: Remove Mock Data and Add Default Test Fixtures

**Date**: 2026-01-06
**Feature**: 020-remove-mock-data

## Overview

This document consolidates research findings for the mock data removal and default fixture seeding feature.

---

## 1. Mock Data Removal Scope

### Decision: Complete Removal Approach
All mock data functionality will be fully removed from the codebase, including types, default values, components, and agent tools.

### Rationale
- Mock data was designed for prototyping/preview purposes but is no longer needed
- The feature adds complexity without providing current value
- Clean removal is simpler than partial deprecation
- Future data handling will be connected to real data sources (connectors)

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Deprecate but keep types | Still leaves dead code; TypeScript exports would need maintenance |
| Make mock data optional | Increases complexity; still need to maintain unused code paths |
| Convert to "sample data" feature | Scope creep; not requested by user |

---

## 2. Files Requiring Modification

### Backend Files

| File | Action | Details |
|------|--------|---------|
| `packages/backend/src/agent/tools/mock-data-generator.ts` | DELETE | Entire file - LangChain tool for mock data generation |
| `packages/backend/src/agent/tools/index.ts` | MODIFY | Remove `mockDataGeneratorTool` export |
| `packages/backend/src/agent/agent.service.ts` | MODIFY | Remove mock data imports, `GenerateAppResult.mockData`, `GenerateFlowResult.mockData`, `ProcessMockDataChatResult`, `processMockDataChat()`, mock data generation in `generateApp()`, `processChat()`, `processInterfaceNodeChat()` |
| `packages/backend/src/app/app.service.ts` | MODIFY | Add seeding method for default app |
| `packages/backend/src/flow/flow.service.ts` | MODIFY | Used for seeding default flow (no direct mock data references) |
| `packages/backend/src/main.ts` | MODIFY | Trigger seeding on application bootstrap |

### Frontend Files

| File | Action | Details |
|------|--------|---------|
| `packages/frontend/src/components/flow/MockDataModal.tsx` | DELETE | Entire file - modal for editing mock data |
| `packages/frontend/src/components/flow/MockDataNode.tsx` | DELETE | Entire file - React Flow node displaying mock data |
| `packages/frontend/src/components/flow/NodeEditModal.tsx` | MODIFY | Remove `mockData` state, `getDefaultMockData()`, mock data handling in form submission |
| `packages/frontend/src/components/flow/FlowDiagram.tsx` | MODIFY | Remove `MockDataNode` import, remove `mockDataNode` from `nodeTypes`, remove mock data node creation logic |
| `packages/frontend/src/components/editor/LayoutRenderer.tsx` | MODIFY | Handle missing/undefined `mockData` prop gracefully |
| `packages/frontend/src/components/editor/VisualDisplay.tsx` | MODIFY | Remove `DEFAULT_TABLE_MOCK_DATA` fallback |
| `packages/frontend/src/pages/FlowDetail.tsx` | MODIFY | Remove `onMockDataEdit` handler and related state |
| `packages/frontend/src/components/flow/ViewNode.tsx` | VERIFY | Check for mock data references |
| `packages/frontend/src/components/preview/FlowPreview.tsx` | VERIFY | Check for mock data references |
| `packages/frontend/src/lib/manifest-mappers.ts` | VERIFY | Check for mock data references |

### Shared/Nodes Files

| File | Action | Details |
|------|--------|---------|
| `packages/shared/src/types/node.ts` | MODIFY | Remove `MockData`, `TableMockData`, `PostListMockData`, `TableColumn`, `PostItem`, `DEFAULT_TABLE_MOCK_DATA`, `DEFAULT_POST_LIST_MOCK_DATA`, `isTableMockData()`, `isPostListMockData()`. Keep `InterfaceNodeParameters` but remove `mockData` field |
| `packages/shared/src/index.ts` | MODIFY | Remove all mock data exports |
| `packages/nodes/src/nodes/InterfaceNode.ts` | MODIFY | Remove `DEFAULT_TABLE_MOCK_DATA` import, remove `mockData` from `defaultParameters` |

---

## 3. Default Test Fixtures Seeding

### Decision: Use NestJS Lifecycle Hook with Idempotent Check
Seed default app and flow on application bootstrap using `OnModuleInit` lifecycle hook.

### Rationale
- NestJS provides clean lifecycle hooks for initialization logic
- `OnModuleInit` runs after dependency injection is complete
- Idempotent check prevents duplicate fixtures on restart
- Keeps seeding logic within existing service structure

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Separate seeder script | Adds deployment complexity; needs to run before/after app |
| Database migration | Seeding is not a schema change; wrong tool for the job |
| Conditional bootstrap in main.ts | Mixes concerns; services should handle their own initialization |

### Implementation Details

**Seeding Location**: `AppService.onModuleInit()` (implements `OnModuleInit` interface)

**Seeding Logic**:
```
1. Check if any apps exist (findAll().length === 0)
2. If no apps exist:
   a. Create "Test App" with default theme
   b. Create "Test Flow" in the app with default tool metadata
3. Log success message for visibility
```

**Default Values**:
- App name: "Test App"
- App description: "Default test application for development and PR testing"
- Flow name: "Test Flow"
- Flow toolName: "test_flow"
- Flow toolDescription: "A default test flow for development purposes"

---

## 4. InterfaceNodeParameters After Mock Data Removal

### Decision: Keep `layoutTemplate` Only
After removing mock data, `InterfaceNodeParameters` will only contain `layoutTemplate`.

### Rationale
- Layout template is still needed for UI rendering decisions
- Future data will come from flow execution context (connectors, API calls)
- Clean interface prepares for real data integration

### Updated Interface
```typescript
export interface InterfaceNodeParameters {
  layoutTemplate: LayoutTemplate;
}
```

---

## 5. Layout Rendering Without Mock Data

### Decision: Show Empty/Placeholder State
When no data is provided, layout components should render an empty placeholder state.

### Rationale
- Graceful degradation is better than errors
- Users understand "no data" state
- Prepares UI for async data loading patterns

### Implementation
- `LayoutRenderer`: Check if `mockData` prop exists, render placeholder if not
- `VisualDisplay`: Remove hardcoded `DEFAULT_TABLE_MOCK_DATA` fallback, pass through undefined

---

## 6. Backward Compatibility

### Decision: Silent Ignore of Existing Mock Data
Existing flows with mock data stored in node parameters will be silently ignored.

### Rationale
- No migration needed - legacy data simply won't be used
- Loading flows won't break - parameters are typed as `Record<string, unknown>`
- Saving flows will naturally drop mock data as it's no longer included in form submission

### No Migration Required
- SQLite stores nodes as JSON - extra fields are harmless
- TypeScript interfaces control what gets used at runtime
- Natural cleanup occurs as flows are edited and saved

---

## Summary

| Topic | Decision |
|-------|----------|
| Mock data removal | Complete removal of all types, defaults, components, tools |
| Seeding approach | NestJS `OnModuleInit` lifecycle hook in `AppService` |
| Seeding fixtures | 1 "Test App" with 1 "Test Flow" |
| Idempotency | Check `findAll().length === 0` before seeding |
| Layout rendering | Empty/placeholder state when no data provided |
| Backward compatibility | Silent ignore of existing mock data in saved flows |
