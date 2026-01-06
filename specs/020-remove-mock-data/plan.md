# Implementation Plan: Remove Mock Data and Add Default Test Fixtures

**Branch**: `020-remove-mock-data` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-remove-mock-data/spec.md`

## Summary

Remove all mock data functionality from the codebase including: mock data generator tool, mock data types/defaults, MockDataModal and MockDataNode frontend components, and agent service mock data methods. Additionally, implement automatic seeding of a default test app and flow on application startup to eliminate manual setup for PR testing.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 18+
**Primary Dependencies**: NestJS 10.x (backend), React 18.x (frontend), LangChain (agent), TypeORM (database)
**Storage**: SQLite (better-sqlite3) for development, MySQL for production
**Testing**: None (POC phase - testing deferred per constitution)
**Target Platform**: Web application (Linux server + modern browsers)
**Project Type**: web (monorepo with packages: backend, frontend, shared, nodes)
**Performance Goals**: POC - no strict requirements
**Constraints**: POC - no strict requirements
**Scale/Scope**: POC - single developer testing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Code Quality & SOLID | ✅ PASS | Removal simplifies codebase; seeding follows Single Responsibility |
| Testing Standards | ✅ N/A | Deferred for POC per constitution |
| User Experience Consistency | ✅ PASS | Removal eliminates mock data UI; default fixtures improve DX |
| Performance Requirements | ✅ N/A | Deferred for POC per constitution |
| Documentation & Readability | ✅ PASS | Code cleanup improves readability; spec documents rationale |
| Auto-Serve for Testing | ✅ PASS | Will run serve-app.sh after implementation |

**Gate Status**: ✅ PASSED - No violations

## Project Structure

### Documentation (this feature)

```text
specs/020-remove-mock-data/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no new APIs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── agent/
│       │   ├── agent.service.ts        # Remove mock data generation methods
│       │   └── tools/
│       │       ├── index.ts            # Remove mock-data-generator export
│       │       └── mock-data-generator.ts  # DELETE FILE
│       ├── app/
│       │   └── app.service.ts          # Add seeding logic
│       ├── flow/
│       │   └── flow.service.ts         # Used for seeding default flow
│       └── main.ts                     # Trigger seeding on bootstrap
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── flow/
│       │   │   ├── MockDataModal.tsx   # DELETE FILE
│       │   │   ├── MockDataNode.tsx    # DELETE FILE
│       │   │   └── NodeEditModal.tsx   # Remove mockData handling
│       │   └── editor/
│       │       ├── LayoutRenderer.tsx  # Handle missing mockData
│       │       └── VisualDisplay.tsx   # Handle missing mockData
│       └── pages/
│           └── FlowDetail.tsx          # Remove MockDataNode references
├── nodes/
│   └── src/
│       └── nodes/
│           └── InterfaceNode.ts        # Remove mockData from defaultParameters
└── shared/
    └── src/
        ├── types/
        │   └── node.ts                 # Remove MockData types and defaults
        └── index.ts                    # Remove MockData exports
```

**Structure Decision**: Web application structure with monorepo packages. Changes span backend (agent tools, seeding), frontend (component removal, UI updates), shared (type removal), and nodes (default parameters).

## Complexity Tracking

No constitution violations requiring justification.
