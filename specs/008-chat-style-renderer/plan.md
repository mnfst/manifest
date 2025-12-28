# Implementation Plan: Chat-Style Component Renderer

**Branch**: `008-chat-style-renderer` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-chat-style-renderer/spec.md`

## Summary

Enhance the View Editor to provide an authentic chat platform preview experience. Users can switch between ChatGPT and Claude visual styles, toggle light/dark mode, and see their app's logo and name displayed above rendered components. The current view/tool name header and extra border will be removed to create an immersive preview that mirrors how components appear in real chat applications.

**Technical Approach**:
- Add `logoUrl` field to App entity for branding display
- Create platform-specific styling configurations (ChatGPT/Claude)
- Build reusable preview components (ChatStyleWrapper, AppAvatar)
- Refactor ViewEditor.tsx to integrate chat-style rendering
- Use localStorage for preference persistence

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js >= 18.0.0
**Primary Dependencies**: React 18.3.1, NestJS 10.4.15, Tailwind CSS 3.4.17, TypeORM 0.3.20
**Storage**: SQLite via better-sqlite3 (TypeORM auto-sync)
**Testing**: None (POC - deferred per constitution)
**Target Platform**: Desktop browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (Turborepo monorepo with 3 packages)
**Performance Goals**: Style switching <1s, theme toggle <500ms
**Constraints**: POC mode - no auth, no performance optimization required
**Scale/Scope**: Single-user local development

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Principles | ✅ Pass | New components follow SRP; platform styles are extensible |
| II. Testing Standards | ✅ Deferred | POC phase - no tests required |
| III. UX Consistency | ✅ Pass | Reuses existing patterns (toggles, toolbar); provides feedback <100ms |
| IV. Performance Requirements | ✅ Deferred | POC phase - targets documented as goals |
| V. Documentation & Readability | ✅ Pass | Components self-documenting; spec serves as architecture doc |

**Post-Phase 1 Re-check**: No violations introduced. Feature adds optional field and new components without breaking existing functionality.

## Project Structure

### Documentation (this feature)

```text
specs/008-chat-style-renderer/
├── plan.md              # This file
├── research.md          # Research findings and decisions
├── data-model.md        # Entity and type changes
├── quickstart.md        # Development setup guide
├── contracts/           # API and component contracts
│   └── api.md
└── tasks.md             # Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── backend/src/
│   ├── entities/
│   │   └── app.entity.ts          # MODIFY: Add logoUrl column
│   └── app/
│       └── app.service.ts         # (no changes needed - TypeORM handles new field)
│
├── frontend/src/
│   ├── components/
│   │   └── preview/               # NEW DIRECTORY
│   │       ├── ChatStyleWrapper.tsx    # NEW: Chat platform wrapper component
│   │       ├── AppAvatar.tsx           # NEW: Logo/initial avatar component
│   │       ├── PlatformStyleSelector.tsx # NEW: Platform toggle buttons
│   │       └── styles/                 # NEW: Platform-specific styles
│   │           ├── chatgpt.ts          # NEW: ChatGPT theme config
│   │           └── claude.ts           # NEW: Claude theme config
│   ├── hooks/
│   │   └── usePreviewPreferences.ts   # NEW: localStorage preference hook
│   └── pages/
│       └── ViewEditor.tsx         # MODIFY: Major refactor for chat styling
│
└── shared/src/
    ├── types/
    │   ├── app.ts                 # MODIFY: Add logoUrl to App interface
    │   └── platform.ts            # NEW: PlatformStyle, ThemeMode types
    └── index.ts                   # MODIFY: Export new types
```

**Structure Decision**: Using existing monorepo web application structure. New components placed in `packages/frontend/src/components/preview/` to group all preview-related functionality together, following the existing component organization pattern.

## Implementation Phases

### Phase 1: Backend & Shared Types

**Scope**: Data model changes only

1. Add `logoUrl` column to AppEntity
2. Update App interface in shared types
3. Create platform.ts with PlatformStyle and ThemeMode types
4. Export new types from shared index

**Verification**: TypeORM auto-syncs new column; type-check passes

### Phase 2: Core Preview Components

**Scope**: New UI components

1. Create `AppAvatar` component (logo with fallback)
2. Create platform style configurations (chatgpt.ts, claude.ts)
3. Create `ChatStyleWrapper` component (combines header + styling)
4. Create `PlatformStyleSelector` component (toggle UI)

**Verification**: Components render in isolation

### Phase 3: Preference Persistence

**Scope**: localStorage integration

1. Create `usePreviewPreferences` hook
2. Handle read/write with validation
3. Provide defaults for missing/invalid values

**Verification**: Preferences persist across page refresh

### Phase 4: ViewEditor Integration

**Scope**: Main page refactor

1. Remove view info header (lines 211-227)
2. Remove extra border from preview container
3. Add platform style selector to toolbar
4. Move template name to toolbar
5. Integrate ChatStyleWrapper around LayoutRenderer
6. Connect preference hook for persistence

**Verification**: All acceptance scenarios pass manual testing

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Platform styles don't match actual apps | Medium | Low | Use public screenshots as reference; iterate |
| localStorage conflicts with other features | Low | Low | Namespace keys with `generator:` prefix |
| Logo images slow down preview | Low | Medium | Lazy load images; fallback is immediate |
| Breaking existing ViewEditor functionality | Medium | High | Incremental changes; test each step |

## Dependencies

**Internal Dependencies**:
- ThemeProvider (existing) - used by ChatStyleWrapper
- LayoutRenderer (existing) - wrapped by ChatStyleWrapper
- Tailwind CSS configuration (existing) - extended with platform colors

**External Dependencies**:
- None added

## Complexity Tracking

> No constitution violations - this section is not applicable.

Feature is straightforward:
- 1 database column addition
- 4 new React components
- 1 new custom hook
- 1 page refactor
- No new patterns or abstractions beyond standard React component composition
