# Implementation Plan: Link Output Node

**Branch**: `001-link-node` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-link-node/spec.md`

## Summary

Add a new "Link" output node that opens external URLs using ChatGPT's `window.openai.openExternal({ href })` API. The node terminates the flow successfully (no downstream connections), accepts both static and dynamic URLs, and enforces a placement constraint requiring it to follow UI nodes only.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: NestJS 10.4.15 (backend), React 18.3.1 (frontend), @xyflow/react 12.10.0 (canvas)
**Storage**: SQLite via TypeORM 0.3.20 (nodes stored as JSON in Flow entity)
**Testing**: DEFERRED (POC phase per constitution)
**Target Platform**: ChatGPT Apps SDK widget environment (browser iframe)
**Project Type**: web (monorepo with packages/backend, packages/frontend, packages/nodes, packages/shared)
**Performance Goals**: DEFERRED (POC phase)
**Constraints**: Link node must only be placed after UI/interface category nodes
**Scale/Scope**: Single new node type with connection validation constraint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Gate | Status | Notes |
|------|--------|-------|
| SOLID Principles | ✅ PASS | Link node follows Single Responsibility (one action: open external URL), extends existing node pattern without modifying base code |
| Testing Standards | ✅ DEFERRED | POC phase - no automated testing required |
| UX Consistency | ✅ PASS | Follows existing node patterns (icons, parameters, library placement) |
| Performance Requirements | ✅ DEFERRED | POC phase - no performance requirements |
| Documentation | ✅ PASS | Node will include description and parameter documentation |

**Result**: All gates pass or are appropriately deferred for POC phase.

### Post-Design Check

| Gate | Status | Notes |
|------|--------|-------|
| SOLID Principles | ✅ PASS | Design uses single LinkNode class, extends NodeTypeDefinition interface, validation logic separated in SchemaService |
| Testing Standards | ✅ DEFERRED | POC phase - manual testing documented in quickstart.md |
| UX Consistency | ✅ PASS | Blue theme distinguishes from Return (green) and UI (purple) nodes; same dropdown/edit pattern |
| Performance Requirements | ✅ DEFERRED | URL validation is O(1), no performance concerns |
| Documentation | ✅ PASS | Node description, data-model.md, quickstart.md all complete |

**Result**: All gates pass. Ready for task generation.

## Project Structure

### Documentation (this feature)

```text
specs/001-link-node/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output ✓
├── data-model.md        # Phase 1 output ✓
├── quickstart.md        # Phase 1 output ✓
├── contracts/           # Phase 1 output ✓
│   └── link-node-api.yaml
└── checklists/
    └── requirements.md  # Specification quality checklist ✓
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── node/
│       │   └── schema/
│       │       └── schema.service.ts    # MODIFY: Add source-node-type validation for Link
│       └── mcp/
│           └── mcp.tool.ts              # Execution engine (no changes needed)
├── frontend/
│   └── src/
│       └── components/
│           ├── flow/
│           │   ├── LinkNode.tsx         # ADD: Frontend node component
│           │   └── NodeEditModal.tsx    # MODIFY: Add Link node editor with UsePreviousOutputs
│           └── common/
│               ├── UsePreviousOutputs.tsx      # (existing) - used for dynamic URL selection
│               └── TemplateReferencesDisplay.tsx  # (existing) - used for reference validation
├── nodes/
│   └── src/
│       └── nodes/
│           ├── index.ts                 # MODIFY: Register LinkNode
│           └── return/                  # Link is a terminal/return node
│               └── LinkNode.ts          # ADD: Node definition
└── shared/
    └── src/
        └── types/
            └── node.ts                  # MODIFY: Add 'Link' to NodeType union, add LinkNodeParameters
```

**Structure Decision**: Web application monorepo pattern. The Link node will be added to `packages/nodes/src/nodes/return/` following the existing terminal node pattern (like ReturnNode). The frontend component goes in `packages/frontend/src/components/flow/`. The NodeEditModal will be extended to include Link node editing with the existing `UsePreviousOutputs` and `TemplateReferencesDisplay` components for dynamic URL selection. Connection validation enhancement goes in `packages/backend/src/node/schema/schema.service.ts`.

## Complexity Tracking

No violations to justify. Implementation follows existing patterns with minimal additions.

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/001-link-node/research.md` | ✅ Complete |
| Data Model | `specs/001-link-node/data-model.md` | ✅ Complete |
| API Contracts | `specs/001-link-node/contracts/link-node-api.yaml` | ✅ Complete |
| Quickstart | `specs/001-link-node/quickstart.md` | ✅ Complete |
| Agent Context | `CLAUDE.md` | ✅ Updated |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list.
