# Implementation Plan: UI Node Edit Modal Consolidation

**Branch**: `001-ui-edit-modal-merge` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ui-edit-modal-merge/spec.md`

## Summary

Consolidate the UI node editing experience by merging the separate "Edit" modal into the "Edit Code" interface (renamed to "Edit"), removing the deprecated `layoutTemplate` field, adding an "Appearance" tab for form-based visual configuration, and preventing the editor from auto-opening when adding new UI nodes.

## Technical Context

**Language/Version**: TypeScript 5.7.2
**Primary Dependencies**: React 18.3.1, NestJS 10.4.15, @xyflow/react 12.10.0, CodeMirror 6
**Storage**: SQLite (better-sqlite3 11.7.0) via TypeORM 0.3.20 - nodes stored as JSON in Flow entity
**Testing**: Not configured (POC phase - deferred)
**Target Platform**: Web (Desktop browsers)
**Project Type**: Web application (monorepo with backend/frontend/shared packages)
**Performance Goals**: POC - deferred
**Constraints**: POC - deferred
**Scale/Scope**: Single-user POC application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| SOLID Principles | PASS | Changes follow SRP (separate tabs), OCP (extensible form controls) |
| Testing Standards | DEFERRED | POC phase - no automated tests required |
| UX Consistency | PASS | Reuses existing UI patterns (tabs, forms, editor) |
| Performance Requirements | DEFERRED | POC phase |
| Documentation & Readability | PASS | Self-documenting code with clear type definitions |
| Auto-Serve for Testing | WILL COMPLY | Run serve-app.sh after implementation |

**Pre-Phase 0 Gate**: PASSED - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-ui-edit-modal-merge/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output - research findings
├── data-model.md        # Phase 1 output - entity changes
├── quickstart.md        # Phase 1 output - implementation guide
├── contracts/           # Phase 1 output - API contracts
│   └── node-api.yaml    # Updated node API contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       ├── node/
│       │   ├── node.service.ts     # Node CRUD (no changes needed)
│       │   └── dto/                # May need DTO updates
│       └── flow/
│           └── flow.entity.ts      # Flow entity (no changes needed)
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── editor/
│       │   │   ├── InterfaceEditor.tsx    # MODIFY: Add tabs, General, Appearance
│       │   │   ├── GeneralTab.tsx         # NEW: Name and schema form
│       │   │   ├── AppearanceTab.tsx      # NEW: Dynamic appearance form
│       │   │   ├── CodeEditor.tsx         # EXISTING: Code editing
│       │   │   └── ComponentPreview.tsx   # EXISTING: Live preview
│       │   ├── flow/
│       │   │   ├── ViewNodeDropdown.tsx   # MODIFY: Rename "Edit Code" to "Edit"
│       │   │   ├── NodeEditModal.tsx      # MODIFY: Remove StatCard handling
│       │   │   └── ViewNode.tsx           # EXISTING: Node display (no changes)
│       │   └── ui/
│       │       └── tabs.tsx               # EXISTING or NEW: Tab components
│       └── pages/
│           └── FlowDetail.tsx             # MODIFY: Remove auto-open editor
│
└── shared/
    └── src/
        ├── types/
        │   ├── appearance.ts              # NEW: Appearance schema types
        │   ├── node.ts                    # MODIFY: UINodeParameters
        │   └── app.ts                     # MODIFY: Remove LAYOUT_REGISTRY or simplify
        └── index.ts                       # MODIFY: Export new types
```

**Structure Decision**: Existing web application structure maintained. New files added for appearance types and tab components.

## Complexity Tracking

No constitution violations requiring justification.

---

## Phase 0: Research Findings

See [research.md](./research.md) for detailed findings.

**Key Decisions**:
1. Define typed appearance schemas per component in `COMPONENT_APPEARANCE_REGISTRY`
2. Store appearance config as `Record<string, AppearanceValue>` in node parameters
3. Map schema types to form controls: enum→select, boolean→switch, string→text, number→number
4. Remove `layoutTemplate` by ignoring it (no migration needed)
5. Four tabs: General, Appearance, Code, Preview

---

## Phase 1: Design Artifacts

### Data Model
See [data-model.md](./data-model.md) for complete entity definitions.

**Key Changes**:
- `StatCardNodeParameters` → `UINodeParameters`
- Remove `layoutTemplate` field
- Add `appearanceConfig?: AppearanceConfig` field
- New `COMPONENT_APPEARANCE_REGISTRY` with schemas for all component types

### API Contracts
See [contracts/node-api.yaml](./contracts/node-api.yaml) for OpenAPI specification.

**Key Changes**:
- `layoutTemplate` marked as deprecated (ignored on read/write)
- `appearanceConfig` added to `UINodeParameters`
- No breaking changes - existing clients continue to work

### Quickstart Guide
See [quickstart.md](./quickstart.md) for implementation guide.

---

## Post-Design Constitution Re-check

| Principle | Status | Notes |
|-----------|--------|-------|
| SOLID Principles | PASS | Tab components follow SRP, appearance schema is extensible |
| UX Consistency | PASS | Uses existing tab patterns, form controls match system style |
| Documentation | PASS | Types are self-documenting, schema includes descriptions |

**Post-Phase 1 Gate**: PASSED - Design is constitution-compliant.

---

## Implementation Phases (for /speckit.tasks)

### Phase A: Shared Package Changes
1. Create `packages/shared/src/types/appearance.ts` with schema types
2. Create `COMPONENT_APPEARANCE_REGISTRY` with all component schemas
3. Update `packages/shared/src/types/node.ts` - rename and modify parameters type
4. Update exports in `packages/shared/src/index.ts`

### Phase B: Frontend - Tab Structure
1. Add/configure tab component (may use existing shadcn/ui tabs)
2. Refactor `InterfaceEditor.tsx` to use tabs
3. Create `GeneralTab.tsx` component
4. Create `AppearanceTab.tsx` with dynamic form generation

### Phase C: Frontend - Integration
1. Update `ViewNodeDropdown.tsx` - rename "Edit Code" to "Edit"
2. Update `NodeEditModal.tsx` - remove StatCard-specific handling
3. Update `FlowDetail.tsx` - remove auto-open editor on node add

### Phase D: Backend Cleanup (if needed)
1. Review and update DTOs if layoutTemplate is explicitly typed
2. Verify node service handles new parameters correctly

### Phase E: Testing & Verification
1. Manual testing of all user scenarios
2. Verify backward compatibility with existing nodes
3. Run `serve-app.sh` for user testing

---

## Next Steps

Run `/speckit.tasks` to generate the detailed task breakdown for implementation.
