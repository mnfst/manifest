# Implementation Plan: Manifest UI Blocks Integration

**Branch**: `006-manifest-ui-blocks` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-manifest-ui-blocks/spec.md`

## Summary

Replace the current custom POC table and post-list layouts in the view editor with official Manifest UI components from `https://ui.manifest.build`. This requires:
1. Installing Manifest UI Table and BlogPostList components via shadcn CLI
2. Creating a data mapping layer to transform internal MockData types to Manifest component props
3. Updating the frontend LayoutRenderer to use Manifest components
4. Updating MCP server HTML templates to render Manifest components server-side
5. Updating AI tool prompts to generate Manifest-compatible data structures

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >=18.0.0
**Primary Dependencies**: React 18.3.1, NestJS 10.4.15, Vite 6.0.5, Tailwind CSS 3.4.17, lucide-react (new)
**Storage**: SQLite (TypeORM) - no schema changes required
**Testing**: Deferred (POC mode per constitution)
**Target Platform**: Web (React frontend, NestJS backend)
**Project Type**: Monorepo (packages/frontend, packages/backend, packages/shared)
**Performance Goals**: Deferred (POC mode)
**Constraints**: Must use only components from https://ui.manifest.build/blocks registry
**Scale/Scope**: 2 layout types (table, post-list), affects ~5 files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| SOLID - Single Responsibility | ✅ PASS | Data mapping layer separate from rendering |
| SOLID - Open/Closed | ✅ PASS | New components extend, don't modify shared types |
| SOLID - Liskov Substitution | ✅ PASS | Manifest components are drop-in replacements |
| SOLID - Interface Segregation | ✅ PASS | Minimal changes to existing interfaces |
| SOLID - Dependency Inversion | ✅ PASS | Components depend on abstractions (MockData types) |
| Testing Standards | ⏸️ DEFERRED | POC phase - manual testing acceptable |
| UX Consistency | ✅ PASS | Manifest components match ChatGPT app styling |
| Performance | ⏸️ DEFERRED | POC phase |
| Documentation | ✅ PASS | Component interfaces are self-documenting |

**Gate Result**: ✅ PASS - No violations, proceeding to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/006-manifest-ui-blocks/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no new API endpoints)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── ui/                    # shadcn/ui base components
│       │   │   ├── button.tsx         # NEW: Manifest dependency
│       │   │   └── checkbox.tsx       # NEW: Manifest dependency
│       │   └── editor/
│       │       └── LayoutRenderer.tsx # MODIFY: Use Manifest components
│       └── lib/
│           ├── utils.ts               # NEW: cn() utility for Manifest
│           └── manifest-mappers.ts    # NEW: MockData → Manifest props
├── backend/
│   └── src/
│       ├── mcp/
│       │   ├── templates/
│       │   │   ├── table.html         # MODIFY: Manifest Table rendering
│       │   │   └── post-list.html     # MODIFY: Manifest BlogPostList
│       │   └── ui.controller.ts       # MODIFY: Inject Manifest data
│       └── agent/
│           └── tools/
│               └── mock-data-generator.ts  # MODIFY: Generate Manifest-compatible data
└── shared/
    └── src/
        └── types/
            └── mock-data.ts           # MODIFY: Align with Manifest schemas
```

**Structure Decision**: Existing monorepo structure maintained. New Manifest UI components installed in frontend via shadcn CLI. Data mapping utilities added to frontend/lib.

## Complexity Tracking

No constitution violations requiring justification.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| SOLID - Single Responsibility | ✅ PASS | `manifest-mappers.ts` handles only data transformation |
| SOLID - Open/Closed | ✅ PASS | LayoutRenderer extended with new components, no breaking changes |
| SOLID - Liskov Substitution | ✅ PASS | Manifest components satisfy same rendering contract |
| SOLID - Interface Segregation | ✅ PASS | Mapping functions use minimal interfaces |
| SOLID - Dependency Inversion | ✅ PASS | LayoutRenderer depends on MockData abstraction |
| UX Consistency | ✅ PASS | Manifest components provide ChatGPT-native styling |
| Documentation | ✅ PASS | quickstart.md provides setup instructions |

**Post-Design Gate Result**: ✅ PASS - Ready for `/speckit.tasks` phase

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `research.md` | ✅ Complete |
| Data Model | `data-model.md` | ✅ Complete |
| Contracts | `contracts/README.md` | ✅ Complete (no new APIs) |
| Quickstart | `quickstart.md` | ✅ Complete |
| Agent Context | `CLAUDE.md` | ✅ Updated |
