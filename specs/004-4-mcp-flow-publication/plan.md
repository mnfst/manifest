# Implementation Plan: MCP Flow Publication

**Branch**: `004-4-mcp-flow-publication` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-4-mcp-flow-publication/spec.md`

## Summary

Implement flow-level and app-level publication controls for the MCP server. Add `isActive` field to flows to control tool visibility, ensure the existing `status` field on apps controls MCP endpoint accessibility, and create a landing page with ChatGPT integration instructions for published apps.

## Technical Context

**Language/Version**: TypeScript 5.x (all packages)
**Primary Dependencies**: NestJS 10.x, TypeORM, React 18.x, React Router 7.x, Tailwind CSS
**Storage**: SQLite (TypeORM)
**Testing**: Deferred per POC constitution
**Target Platform**: Web (Node.js backend, Browser frontend)
**Project Type**: Web application (monorepo with backend, frontend, shared packages)
**Performance Goals**: Deferred per POC constitution
**Constraints**: None for POC
**Scale/Scope**: POC - single user, local development

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| SOLID Principles | ✅ PASS | Feature uses existing service/controller patterns |
| Testing Standards | ⏸️ DEFERRED | POC phase - no automated tests required |
| UX Consistency | ✅ PASS | Using existing UI patterns (toggle switches, buttons) |
| Performance | ⏸️ DEFERRED | POC phase - no performance requirements |
| Documentation | ✅ PASS | Using spec-driven development |

**Gate Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/004-4-mcp-flow-publication/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md
├── checklists/
│   └── quality.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── entities/
│       │   └── app.entity.ts      # Existing (uses status field)
│       ├── flow/
│       │   ├── flow.entity.ts     # Add isActive field
│       │   ├── flow.service.ts    # Update to support isActive
│       │   └── flow.controller.ts # Existing
│       ├── mcp/
│       │   ├── mcp.tool.ts        # Filter by isActive
│       │   ├── ui.controller.ts   # Add landing page endpoint
│       │   └── templates/
│       │       └── landing.html   # New: landing page template
│       └── app/
│           ├── app.service.ts     # Existing (publish/unpublish)
│           └── app.controller.ts  # Existing
├── frontend/
│   └── src/
│       ├── components/
│       │   └── flow/
│       │       └── FlowActiveToggle.tsx  # New component
│       ├── pages/
│       │   ├── FlowDetail.tsx     # Add active toggle
│       │   └── AppDetail.tsx      # Add publish button
│       └── lib/
│           └── api.ts             # Add updateFlowActive()
└── shared/
    └── src/
        └── types/
            └── flow.ts            # Add isActive field
```

**Structure Decision**: Existing monorepo structure with backend, frontend, shared packages. Changes are localized to flow/mcp modules on backend, flow components on frontend, and shared types.

## Complexity Tracking

> No Constitution Check violations - this section is empty.
