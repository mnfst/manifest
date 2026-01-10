# Tasks: Manifest UI Website

**Input**: Design documents from `/specs/001-toolkit-website/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested - manual testing only per plan.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Base path: `packages/manifest-ui/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and shared utilities

- [ ] T001 [P] Create copy-to-clipboard hook in lib/hooks/use-copy-to-clipboard.ts
- [ ] T002 [P] Create block data types in lib/types/blocks.ts
- [ ] T003 [P] Create block utility functions in lib/blocks.ts (parse registry.json, get block by name)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core components that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create CodeBlock component with copy button in components/blocks/code-block.tsx
- [ ] T005 [P] Create site Header component with navigation in components/layout/header.tsx
- [ ] T006 Update root layout to include Header in app/layout.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Browse Blocks by Category (Priority: P1) 🎯 MVP

**Goal**: Developers can browse all blocks organized by category in a sidebar, with the first block displayed by default

**Independent Test**: Navigate to /blocks, verify sidebar shows categories expanded, click block names to see them highlighted and displayed

### Implementation for User Story 1

- [ ] T007 [P] [US1] Extract category sidebar into reusable Sidebar component in components/layout/sidebar.tsx
- [ ] T008 [US1] Refactor blocks page to use Sidebar component in app/blocks/page.tsx
- [ ] T009 [US1] Add URL-based block selection with first block as default in app/blocks/page.tsx
- [ ] T010 [US1] Style active block highlight in sidebar in app/blocks/page.tsx
- [ ] T011 [US1] Add responsive mobile sidebar (collapsible) in components/layout/sidebar.tsx
- [ ] T012 [US1] Ensure categories are expanded by default in app/blocks/page.tsx

**Checkpoint**: User Story 1 complete - blocks browsable by category with sidebar navigation

---

## Phase 4: User Story 2 - View Block with All Variants (Priority: P1)

**Goal**: Developers see ALL variants of a block on a single page, each with its own Preview/Code tabs and install commands

**Independent Test**: Select any block (e.g., Post Card), verify all variants display (Default, No Image, Compact, Horizontal), each with working tabs

### Implementation for User Story 2

- [ ] T013 [US2] Restructure block data to group variants under BlockGroup in app/blocks/page.tsx
- [ ] T014 [P] [US2] Create VariantSection component in components/blocks/variant-section.tsx with:
  - Variant name label
  - Preview/Code tabs
  - Install command inline with tabs
  - Content area for preview or code
- [ ] T015 [US2] Integrate VariantSection to display all variants on block page in app/blocks/page.tsx
- [ ] T016 [US2] Ensure each variant has independent tab state (switching one doesn't affect others)
- [ ] T017 [US2] Add block title and description at top of page in app/blocks/page.tsx
- [ ] T018 [US2] Ensure previews render directly without wrapper containers (minimal UI)
- [ ] T019 [US2] Ensure preview adapts to light/dark theme

**Checkpoint**: User Story 2 complete - blocks display with all variants, each with independent tabs

---

## Phase 5: User Story 3 - Get Installation Instructions per Variant (Priority: P2)

**Goal**: Each variant section shows install commands for ALL 4 package managers (npx, pnpm, yarn, bunx)

**Independent Test**: View any variant, verify package manager selector shows 4 options, each generates correct command, copy works

### Implementation for User Story 3

- [ ] T020 [P] [US3] Create InstallCommandInline component in components/blocks/install-command-inline.tsx
- [ ] T021 [US3] Add package manager selector (npx, pnpm, yarn, bunx) with pill/chip style
- [ ] T022 [US3] Generate correct command per package manager:
  - npx: `npx shadcn@latest add @manifest/{name}`
  - pnpm: `pnpm dlx shadcn@latest add @manifest/{name}`
  - yarn: `npx shadcn@latest add @manifest/{name}`
  - bunx: `bunx --bun shadcn@latest add @manifest/{name}`
- [ ] T023 [US3] Add copy button with visual feedback (checkmark, brief animation)
- [ ] T024 [US3] Integrate InstallCommandInline into VariantSection, inline with tabs

**Checkpoint**: User Story 3 complete - install commands for all 4 package managers with one-click copy

---

## Phase 6: User Story 4 - View Source Code per Variant (Priority: P2)

**Goal**: Each variant's "Code" tab shows source code with syntax highlighting and copy

**Independent Test**: Click Code tab on any variant, verify syntax-highlighted code displays, copy works

### Implementation for User Story 4

- [ ] T025 [P] [US4] Create CodeViewer component in components/blocks/code-viewer.tsx
- [ ] T026 [US4] Fetch code from /r/{registryName}.json endpoint
- [ ] T027 [US4] Display code with syntax highlighting using CodeBlock component
- [ ] T028 [US4] Add copy button to code view
- [ ] T029 [US4] Integrate CodeViewer into VariantSection's Code tab

**Checkpoint**: User Story 4 complete - code view with syntax highlighting and copy

---

## Phase 7: User Story 5 - Explore Use Cases on Homepage (Priority: P3)

**Goal**: First-time visitors see interactive demos in ChatGPT/Claude-style interfaces with tabbed use cases

**Independent Test**: Load homepage, verify headline/subtitle display, switch tabs to see different demos, switch sub-tabs between ChatGPT/Claude

### Implementation for User Story 5

- [ ] T030 [P] [US5] Create Claude-style chat demo component in components/chat/claude-demo.tsx
- [ ] T031 [US5] Add headline and subtitle to homepage in app/page.tsx
- [ ] T032 [US5] Add sub-tabs for ChatGPT/Claude interface switching in app/page.tsx
- [ ] T033 [US5] Integrate ClaudeDemo component into sub-tabs in app/page.tsx
- [ ] T034 [US5] Ensure first use case tab selected by default in app/page.tsx
- [ ] T035 [US5] Make homepage demos responsive for mobile in app/page.tsx

**Checkpoint**: User Story 5 complete - homepage with interactive demos and AI interface sub-tabs

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T036 [P] Add 404 handling for non-existent block URLs in app/blocks/page.tsx
- [ ] T037 [P] Add loading states for block previews in components/blocks/block-preview.tsx
- [ ] T038 [P] Add error boundary for block preview failures in components/blocks/block-preview.tsx
- [ ] T039 Verify all blocks from registry.json are browsable in app/blocks/page.tsx
- [ ] T040 Performance check: homepage loads < 3 seconds
- [ ] T041 Performance check: tab switching < 500ms
- [ ] T042 Verify light/dark theme works on all pages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (sidebar) must be done first
  - US2 (variants display) depends on US1
  - US3 (install commands) and US4 (code view) depend on US2's VariantSection
  - US5 is completely independent (homepage)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Blocks page sidebar - foundation for all block browsing
- **User Story 2 (P1)**: Block variants display - requires US1 for navigation, creates VariantSection
- **User Story 3 (P2)**: Install commands inline - requires US2's VariantSection component
- **User Story 4 (P2)**: Code view - requires US2's VariantSection component
- **User Story 5 (P3)**: Homepage - completely independent from blocks page

### Within Each User Story

- Components before page integration
- Core implementation before styling
- Desktop before mobile responsiveness

### Parallel Opportunities

**Phase 1 (all parallel)**:
```
T001: use-copy-to-clipboard.ts
T002: lib/types/blocks.ts
T003: lib/blocks.ts
```

**Phase 2 (T004-T005 parallel, then T006)**:
```
T004: code-block.tsx
T005: header.tsx
→ T006: layout.tsx (depends on T005)
```

**User Story phases**:
- US1 then US2 (US2 depends on US1's page structure)
- US3 and US4 can run in parallel (both integrate into VariantSection)
- US5 is completely independent (homepage)

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T006)
3. Complete Phase 3: User Story 1 - Browse by Category (T007-T012)
4. Complete Phase 4: User Story 2 - All Variants Display (T013-T019)
5. **STOP and VALIDATE**: Blocks page shows all variants with Preview/Code tabs
6. Deploy/demo if ready - MVP complete!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US2 → Blocks browsing with all variants → Deploy (MVP!)
3. Add US3 + US4 → Install commands (4 package managers) & code view → Deploy
4. Add US5 → Homepage demos → Deploy
5. Polish → Production ready → Deploy

### Task Count Summary

| Phase | Tasks | IDs | Parallelizable |
|-------|-------|-----|----------------|
| Setup | 3 | T001-T003 | 3 |
| Foundational | 3 | T004-T006 | 2 |
| US1: Browse | 6 | T007-T012 | 1 |
| US2: Variants | 7 | T013-T019 | 1 |
| US3: Install | 5 | T020-T024 | 1 |
| US4: Code | 5 | T025-T029 | 1 |
| US5: Homepage | 6 | T030-T035 | 1 |
| Polish | 7 | T036-T042 | 3 |
| **Total** | **42** | **T001-T042** | **13** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing code in app/blocks/page.tsx and app/page.tsx will be refactored, not rewritten from scratch
