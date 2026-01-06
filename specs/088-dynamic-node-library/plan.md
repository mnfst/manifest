# Implementation Plan: Dynamic Node Library

**Branch**: `088-dynamic-node-library` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/088-dynamic-node-library/spec.md`

## Summary

This feature ensures the node library dynamically displays all registered nodes grouped by category, and corrects the Call Flow node categorization from "action" to "return". The implementation requires a single-line change in the CallFlowNode definition to fix the category, with the existing infrastructure already supporting dynamic node loading.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**:
- Backend: NestJS 10.4.15, TypeORM 0.3.20
- Frontend: React 18.3.1, @xyflow/react 12.10.0, Vite 6.0.5
- Nodes: @chatgpt-app-builder/nodes (internal package)
**Storage**: SQLite (better-sqlite3 11.7.0)
**Testing**: No automated testing configured (POC phase)
**Target Platform**: Web application (browser + Node.js backend)
**Project Type**: Web (monorepo with 4 packages: backend, frontend, nodes, shared)
**Performance Goals**: User feedback within 100ms (per constitution)
**Constraints**: POC phase - no performance requirements enforced
**Scale/Scope**: Single-user POC application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | Single change follows SRP - node defines its own category |
| II. Testing Standards | DEFERRED | POC phase - no automated testing required |
| III. User Experience Consistency | PASS | Uses existing UI patterns (NodeLibrary component) |
| IV. Performance Requirements | DEFERRED | POC phase - no performance requirements |
| V. Documentation & Readability | PASS | Self-documenting code change |

**Gate Result**: PASS - All applicable principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/088-dynamic-node-library/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       └── node/
│           └── node.service.ts       # API for node types (already dynamic)
├── frontend/
│   └── src/
│       └── components/
│           └── flow/
│               └── NodeLibrary/
│                   ├── NodeLibrary.tsx   # Main component (already dynamic)
│                   ├── NodeGroup.tsx
│                   ├── NodeItem.tsx
│                   └── NodeSearch.tsx
├── nodes/
│   └── src/
│       └── nodes/
│           ├── index.ts              # Node registry (builtInNodeList)
│           ├── CallFlowNode.ts       # CHANGE: category 'action' → 'return'
│           ├── ApiCallNode.ts        # Verify registered correctly
│           ├── UserIntentNode.ts
│           ├── InterfaceNode.ts
│           └── ReturnNode.ts
└── shared/
    └── src/
        └── types/
            └── node.ts               # NodeTypeCategory type definition
```

**Structure Decision**: Existing monorepo structure with packages/ layout. No structural changes required.

## Complexity Tracking

> No violations to justify - this is a minimal change.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Implementation Summary

### Scope Analysis

After investigating the codebase, the implementation scope is **minimal**:

1. **The node library already dynamically fetches nodes** from the backend API (`/api/node-types`)
2. **The API Call node IS registered** in `builtInNodeList` and should appear
3. **Only change needed**: Update `CallFlowNode.ts` category from `'action'` to `'return'`

### Files to Modify

| File | Change | Reason |
|------|--------|--------|
| `packages/nodes/src/nodes/CallFlowNode.ts` | Line 14: `category: 'action'` → `category: 'return'` | FR-005: Call Flow should be categorized as return value |

### Verification Steps

1. Rebuild the nodes package: `pnpm --filter @chatgpt-app-builder/nodes build`
2. Rebuild backend to pick up changes: `pnpm --filter @chatgpt-app-builder/backend build`
3. Start application: `.specify/scripts/bash/serve-app.sh`
4. Open node library and verify:
   - API Call appears in "Actions" category
   - Call Flow appears in "Return Values" category
   - All 5 nodes (UserIntent, Interface, Return, CallFlow, ApiCall) are visible

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing flows break | Low | Medium | Category is display-only; execution logic unchanged |
| Frontend not rebuilding | Low | Low | Clear instructions in tasks.md |
