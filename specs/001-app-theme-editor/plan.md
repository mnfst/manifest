# Implementation Plan: App Theme Editor

**Branch**: `001-app-theme-editor` | **Date**: 2026-01-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-app-theme-editor/spec.md`

## Summary

Add a comprehensive shadcn theme editor to the app detail page that enables visual customization of all CSS theme variables. The editor will provide three synchronized editing modes: visual color pickers, a CodeMirror-based code editor, and a real-time preview component. Changes persist to the existing `themeVariables` JSON column on the App entity.

## Technical Context

**Language/Version**: TypeScript 5.7.2 (strict mode), Node.js >=18.0.0
**Primary Dependencies**: React 18.3.1, NestJS 10.4.15, @uiw/react-codemirror 4.25.4, TailwindCSS 3.4.17
**Storage**: SQLite via better-sqlite3 11.7.0, TypeORM 0.3.20 (existing `themeVariables` JSON column on AppEntity)
**Testing**: Jest 29.7.0 (backend), no frontend test runner configured (POC)
**Target Platform**: Web browser (desktop), auto-selected ports via Vite
**Project Type**: Web monorepo (pnpm + Turbo) with packages/backend, packages/frontend, packages/shared
**Performance Goals**: Preview updates within 200ms of color change (SC-001)
**Constraints**: HSL color format for all values (e.g., "222.2 47.4% 11.2%")
**Scale/Scope**: Single-user app customization, ~20 theme variables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & SOLID | PASS | Preview component will be interface-segregated for modularity (FR-007) |
| II. Testing Standards | N/A | POC - testing deferred per constitution |
| III. UX Consistency | PASS | Will reuse existing shadcn UI components; feedback within 100ms per constitution |
| IV. Performance Requirements | N/A | POC - deferred per constitution |
| V. Documentation & Readability | PASS | Self-documenting component names; spec serves as documentation |
| Auto-Serve Requirement | ACKNOWLEDGED | Will run serve-app.sh after implementation per constitution |

**Gate Status**: PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/001-app-theme-editor/
├── plan.md              # This file
├── research.md          # Phase 0 output - technology decisions
├── data-model.md        # Phase 1 output - entity definitions
├── quickstart.md        # Phase 1 output - developer guide
├── contracts/           # Phase 1 output - API specifications
│   └── theme-api.yaml   # OpenAPI spec for theme endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── backend/
│   └── src/
│       └── app/
│           ├── app.entity.ts        # Existing - has themeVariables column
│           ├── app.service.ts       # Existing - has update method for themes
│           └── app.controller.ts    # Existing - PATCH endpoint
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── ui/
│       │   │   └── tabs.tsx         # Existing - tab component
│       │   ├── common/
│       │   │   └── CodeEditor.tsx   # Existing - CodeMirror wrapper
│       │   └── theme-editor/        # NEW - theme editor components
│       │       ├── ThemeEditor.tsx           # Main editor container
│       │       ├── ColorPickerControl.tsx    # Individual color picker
│       │       ├── VariableControlGroup.tsx  # Grouped controls
│       │       ├── ThemeCodeEditor.tsx       # CodeMirror CSS editor
│       │       ├── ThemePreview.tsx          # Modular preview component
│       │       └── hooks/
│       │           └── useThemeEditor.ts     # State management hook
│       ├── pages/
│       │   └── AppDetail.tsx        # Existing - add Theme tab
│       └── lib/
│           └── api.ts               # Existing - updateApp method
│
└── shared/
    └── src/
        └── types/
            └── theme.ts             # Existing - ThemeVariables type
```

**Structure Decision**: Leveraging existing monorepo structure. New components added to `packages/frontend/src/components/theme-editor/` directory. No backend changes required - existing PATCH /apps/:id endpoint already supports themeVariables updates.

## Complexity Tracking

> No constitution violations requiring justification.

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| Color picker | Add react-colorful dependency | Lightweight (2.8kb), supports HSL natively, no dependencies |
| Bidirectional sync | Single source of truth state | Avoids sync conflicts between visual/code editors |
| Preview modularity | Props interface with render slot | Allows swapping preview without editor changes |
