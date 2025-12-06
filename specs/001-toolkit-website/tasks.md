# Tasks: Agentic UI Toolkit Website

**Input**: Design documents from `/specs/001-toolkit-website/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested - manual testing only per plan.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Base path: `packages/agentic-ui-toolkit/`

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

## Phase 4: User Story 2 - View Block Details with Live Preview (Priority: P1)

**Goal**: Developers see a live, interactive preview of the selected block in an isolated container

**Independent Test**: Select any block, verify preview renders and is interactive (clicks, hovers work)

### Implementation for User Story 2

- [ ] T013 [P] [US2] Create BlockPreview component wrapper in components/blocks/block-preview.tsx
- [ ] T014 [US2] Integrate BlockPreview into blocks page main content area in app/blocks/page.tsx
- [ ] T015 [US2] Add block title and description display above preview in app/blocks/page.tsx
- [ ] T016 [US2] Ensure preview adapts to light/dark theme in components/blocks/block-preview.tsx
- [ ] T017 [US2] Add responsive preview container (full width on mobile) in components/blocks/block-preview.tsx

**Checkpoint**: User Story 2 complete - blocks display with live interactive preview

---

## Phase 5: User Story 3 - Get Installation Instructions (Priority: P2)

**Goal**: Developers see clear installation command with one-click copy functionality

**Independent Test**: View any block page, find installation section, click copy, verify command copied

### Implementation for User Story 3

- [ ] T018 [P] [US3] Create BlockInstall component in components/blocks/block-install.tsx
- [ ] T019 [US3] Display `npx shadcn add <block-name>` command with copy button in components/blocks/block-install.tsx
- [ ] T020 [US3] Show dependencies list from registry.json in components/blocks/block-install.tsx
- [ ] T021 [US3] Add visual feedback on copy (checkmark icon, brief animation) in components/blocks/block-install.tsx
- [ ] T022 [US3] Integrate BlockInstall into blocks page below preview in app/blocks/page.tsx

**Checkpoint**: User Story 3 complete - installation commands copyable with one click

---

## Phase 6: User Story 4 - Learn Block Usage (Priority: P2)

**Goal**: Developers see usage examples with import statements and code snippets

**Independent Test**: View any block page, scroll to usage section, verify code examples display and copy works

### Implementation for User Story 4

- [ ] T023 [P] [US4] Create BlockUsage component in components/blocks/block-usage.tsx
- [ ] T024 [US4] Generate import statement from block file path in components/blocks/block-usage.tsx
- [ ] T025 [US4] Display basic usage code example in components/blocks/block-usage.tsx
- [ ] T026 [US4] Add copy button to code examples using CodeBlock component in components/blocks/block-usage.tsx
- [ ] T027 [US4] Integrate BlockUsage into blocks page below installation in app/blocks/page.tsx

**Checkpoint**: User Story 4 complete - usage documentation with copyable code examples

---

## Phase 7: User Story 5 - Explore Use Cases on Homepage (Priority: P3)

**Goal**: First-time visitors see interactive demos in ChatGPT/Claude-style interfaces with tabbed use cases

**Independent Test**: Load homepage, verify headline/subtitle display, switch tabs to see different demos, switch sub-tabs between ChatGPT/Claude

### Implementation for User Story 5

- [ ] T028 [P] [US5] Create Claude-style chat demo component in components/chat/claude-demo.tsx
- [ ] T029 [US5] Add headline and subtitle to homepage in app/page.tsx
- [ ] T030 [US5] Add sub-tabs for ChatGPT/Claude interface switching in app/page.tsx
- [ ] T031 [US5] Integrate ClaudeDemo component into sub-tabs in app/page.tsx
- [ ] T032 [US5] Ensure first use case tab selected by default in app/page.tsx
- [ ] T033 [US5] Make homepage demos responsive for mobile in app/page.tsx

**Checkpoint**: User Story 5 complete - homepage with interactive demos and AI interface sub-tabs

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T034 [P] Add 404 handling for non-existent block URLs in app/blocks/page.tsx
- [ ] T035 [P] Add loading states for block previews in components/blocks/block-preview.tsx
- [ ] T036 [P] Add error boundary for block preview failures in components/blocks/block-preview.tsx
- [ ] T037 Verify all blocks from registry.json are browsable in app/blocks/page.tsx
- [ ] T038 Performance check: homepage loads < 3 seconds
- [ ] T039 Performance check: tab switching < 500ms
- [ ] T040 Verify light/dark theme works on all pages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority - can run in parallel
  - US3 and US4 are both P2 priority - can run in parallel after US1/US2
  - US5 is P3 priority - can run independently
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Blocks page sidebar - foundation for all block browsing
- **User Story 2 (P1)**: Block preview - can start in parallel with US1, uses same page
- **User Story 3 (P2)**: Installation section - requires US1/US2 page structure
- **User Story 4 (P2)**: Usage section - requires US1/US2 page structure
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
- US1 and US2 can run in parallel (different aspects of blocks page)
- US3 and US4 can run in parallel (different sections of block detail)
- US5 is completely independent (homepage)

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T006)
3. Complete Phase 3: User Story 1 - Browse by Category (T007-T012)
4. Complete Phase 4: User Story 2 - Live Preview (T013-T017)
5. **STOP and VALIDATE**: Blocks page fully functional
6. Deploy/demo if ready - MVP complete!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US2 → Blocks browsing complete → Deploy (MVP!)
3. Add US3 + US4 → Installation & usage docs → Deploy
4. Add US5 → Homepage demos → Deploy
5. Polish → Production ready → Deploy

### Task Count Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 3 | 3 |
| Foundational | 3 | 2 |
| US1: Browse | 6 | 1 |
| US2: Preview | 5 | 1 |
| US3: Install | 5 | 1 |
| US4: Usage | 5 | 1 |
| US5: Homepage | 6 | 1 |
| Polish | 7 | 3 |
| **Total** | **40** | **13** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing code in app/blocks/page.tsx and app/page.tsx will be refactored, not rewritten from scratch
