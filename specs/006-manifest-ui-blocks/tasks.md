# Tasks: Manifest UI Blocks Integration

**Input**: Design documents from `/specs/006-manifest-ui-blocks/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not included (POC mode per constitution - testing deferred)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (monorepo)**: `packages/frontend/src/`, `packages/backend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create base utilities required by Manifest components

- [x] T001 Install lucide-react dependency in packages/frontend/package.json
- [x] T002 [P] Install clsx and tailwind-merge dependencies in packages/frontend/package.json
- [x] T003 [P] Create cn() utility function in packages/frontend/src/lib/utils.ts
- [x] T004 [P] Configure tsconfig.json paths alias for @/ imports in packages/frontend/tsconfig.json
- [x] T005 Install shadcn/ui button component via `npx shadcn@latest add button` in packages/frontend/
- [x] T006 [P] Install shadcn/ui checkbox component via `npx shadcn@latest add checkbox` in packages/frontend/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Install Manifest UI components that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Install Manifest Table component via `npx shadcn@latest add https://ui.manifest.build/r/table.json` in packages/frontend/
- [x] T008 [P] Install Manifest BlogPostList component via `npx shadcn@latest add https://ui.manifest.build/r/blog-post-list.json` in packages/frontend/
- [x] T009 Verify installed components exist in packages/frontend/src/components/ui/table.tsx
- [x] T010 [P] Verify installed components exist in packages/frontend/src/components/ui/blog-post-list.tsx and blog-post-card.tsx

**Checkpoint**: Foundation ready - Manifest components installed, user story implementation can begin

---

## Phase 3: User Story 3 - Data Mapping to Manifest Component Props (Priority: P1) 🎯 MVP

**Goal**: Create mapping utilities to transform internal MockData types to Manifest component props

**Independent Test**: Import mapping functions and verify they transform sample data correctly without errors

**Note**: US3 is implemented first because US1 and US2 depend on the mapping layer

### Implementation for User Story 3

- [x] T011 [US3] Create Manifest type definitions (ManifestTableColumn, ManifestBlogPost) in packages/frontend/src/lib/manifest-mappers.ts
- [x] T012 [US3] Implement mapTableColumnToManifest function with render functions for badge/number/date types in packages/frontend/src/lib/manifest-mappers.ts
- [x] T013 [US3] Implement mapTableMockDataToManifest function in packages/frontend/src/lib/manifest-mappers.ts
- [x] T014 [US3] Implement mapPostItemToManifestBlogPost function with author object transformation in packages/frontend/src/lib/manifest-mappers.ts
- [x] T015 [US3] Implement mapPostListMockDataToManifest function in packages/frontend/src/lib/manifest-mappers.ts
- [x] T016 [US3] Export all mapping functions and types from packages/frontend/src/lib/manifest-mappers.ts

**Checkpoint**: Data mapping layer complete - can transform internal types to Manifest props

---

## Phase 4: User Story 1 - View Displays with Manifest Table Component (Priority: P1)

**Goal**: Replace custom table implementation with official Manifest UI Table component

**Independent Test**: Create a flow with table layout, verify the rendered table matches Manifest UI Table styling and supports sorting headers

### Implementation for User Story 1

- [x] T017 [US1] Update LayoutRenderer imports to include Manifest Table component in packages/frontend/src/components/editor/LayoutRenderer.tsx
- [x] T018 [US1] Update LayoutRenderer imports to include mapTableMockDataToManifest in packages/frontend/src/components/editor/LayoutRenderer.tsx
- [x] T019 [US1] Replace TableLayout function with Manifest Table component rendering in packages/frontend/src/components/editor/LayoutRenderer.tsx
- [x] T020 [US1] Add dark mode support via Tailwind dark class wrapper for table in packages/frontend/src/components/editor/LayoutRenderer.tsx
- [x] T021 [US1] Remove old TableLayout function implementation from packages/frontend/src/components/editor/LayoutRenderer.tsx

**Checkpoint**: Table views now render with Manifest UI Table component with sorting and responsive mobile view

---

## Phase 5: User Story 2 - View Displays with Manifest Blog Post List Component (Priority: P1)

**Goal**: Replace custom post-list implementation with official Manifest UI BlogPostList component

**Independent Test**: Create a flow with post-list layout, verify posts render using Manifest UI BlogPostList styling

### Implementation for User Story 2

- [x] T022 [US2] Update LayoutRenderer imports to include Manifest BlogPostList component in packages/frontend/src/components/editor/LayoutRenderer.tsx
- [x] T023 [US2] Update LayoutRenderer imports to include mapPostListMockDataToManifest in packages/frontend/src/components/editor/LayoutRenderer.tsx
- [x] T024 [US2] Replace PostListLayout function with Manifest BlogPostList component rendering in packages/frontend/src/components/editor/LayoutRenderer.tsx
- [x] T025 [US2] Add dark mode support via Tailwind dark class wrapper for post-list in packages/frontend/src/components/editor/LayoutRenderer.tsx
- [x] T026 [US2] Remove old PostListLayout function implementation from packages/frontend/src/components/editor/LayoutRenderer.tsx

**Checkpoint**: Post-list views now render with Manifest UI BlogPostList component with variants and responsive layout

---

## Phase 6: User Story 4 - AI Generates Manifest-Compatible Mock Data (Priority: P2)

**Goal**: Update AI prompts to generate data structures directly compatible with Manifest component schemas

**Independent Test**: Use AI chat to modify view data, verify output matches Manifest schema without transformation errors

### Implementation for User Story 4

- [x] T027 [US4] Update mock-data-generator.ts table column schema documentation in AI prompt in packages/backend/src/agent/tools/mock-data-generator.ts
- [x] T028 [US4] Update mock-data-generator.ts to instruct AI to generate TableColumn with key/header/type format in packages/backend/src/agent/tools/mock-data-generator.ts
- [x] T029 [US4] Update mock-data-generator.ts post item schema documentation in AI prompt in packages/backend/src/agent/tools/mock-data-generator.ts
- [x] T030 [US4] Update mock-data-generator.ts to instruct AI to include author/date fields for post items in packages/backend/src/agent/tools/mock-data-generator.ts
- [x] T031 [US4] Update DEFAULT_TABLE_MOCK_DATA in packages/shared/src/types/mock-data.ts to use Manifest-compatible structure
- [x] T032 [US4] Update DEFAULT_POST_LIST_MOCK_DATA in packages/shared/src/types/mock-data.ts to use Manifest-compatible structure

**Checkpoint**: AI-generated mock data is compatible with Manifest components without transformation errors

---

## Phase 7: User Story 5 - MCP Server Renders Manifest Components (Priority: P2)

**Goal**: Update MCP HTML templates to render Manifest UI components for published apps

**Independent Test**: Publish an app and access the MCP UI endpoint, verify HTML contains Manifest component rendering with proper styling

### Implementation for User Story 5

- [x] T033 [US5] Update table.html template to include React CDN scripts in packages/backend/src/mcp/templates/table.html
- [x] T034 [US5] Update table.html template to include Manifest Table component rendering script in packages/backend/src/mcp/templates/table.html
- [x] T035 [US5] Update table.html template to inject mockData as JSON for client-side rendering in packages/backend/src/mcp/templates/table.html
- [x] T036 [US5] Update post-list.html template to include React CDN scripts in packages/backend/src/mcp/templates/post-list.html
- [x] T037 [US5] Update post-list.html template to include Manifest BlogPostList component rendering script in packages/backend/src/mcp/templates/post-list.html
- [x] T038 [US5] Update post-list.html template to inject mockData as JSON for client-side rendering in packages/backend/src/mcp/templates/post-list.html
- [x] T039 [US5] Update ui.controller.ts to pass mockData to templates in packages/backend/src/mcp/ui.controller.ts
- [x] T040 [US5] Add Manifest CSS variables to MCP templates for proper styling in packages/backend/src/mcp/templates/

**Checkpoint**: MCP server HTML output renders Manifest UI components with proper styling

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, edge cases, and validation

- [x] T041 [P] Handle empty data arrays gracefully (show Manifest component's built-in empty state) in packages/frontend/src/lib/manifest-mappers.ts
- [x] T042 [P] Handle missing optional fields in mock data (author, date, image) in packages/frontend/src/lib/manifest-mappers.ts
- [x] T043 [P] Add fallback for invalid column types (default to text rendering) in packages/frontend/src/lib/manifest-mappers.ts
- [ ] T044 Run quickstart.md validation to verify setup instructions work end-to-end
- [ ] T045 Manual testing: Verify table view renders correctly with sorting
- [ ] T046 Manual testing: Verify post-list view renders correctly with author info
- [ ] T047 Manual testing: Verify mobile responsive layout (table card view, post-list)
- [ ] T048 Manual testing: Verify dark mode works for both components

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 3 (Phase 3)**: Depends on Foundational - BLOCKS US1 and US2 (provides mapping layer)
- **User Story 1 (Phase 4)**: Depends on US3 (mapping layer)
- **User Story 2 (Phase 5)**: Depends on US3 (mapping layer) - can run in parallel with US1
- **User Story 4 (Phase 6)**: Can start after Foundational - independent of US1/US2/US3
- **User Story 5 (Phase 7)**: Can start after Foundational - independent of frontend changes
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```
Setup → Foundational → US3 (mapping) → US1 (table) ↘
                                     → US2 (post-list) → Polish
                     → US4 (AI prompts) ↗
                     → US5 (MCP server) ↗
```

### Within Each User Story

- Core implementation before integration
- Story complete before moving to next priority
- All tasks in a story must complete before checkpoint

### Parallel Opportunities

**Setup Phase (T001-T006)**:
```bash
# Run T002, T003, T004, T006 in parallel after T001 completes
Task: "Install clsx and tailwind-merge"
Task: "Create cn() utility function"
Task: "Configure tsconfig.json paths alias"
Task: "Install shadcn/ui checkbox component"
```

**Foundational Phase (T007-T010)**:
```bash
# Run T008, T010 in parallel with T007, T009
Task: "Install Manifest Table component"
Task: "Install Manifest BlogPostList component"
```

**User Stories 1 & 2 (after US3)**:
```bash
# Can run US1 and US2 in parallel since they work on different parts of the same file
# But coordinate to avoid conflicts in LayoutRenderer.tsx
```

**User Stories 4 & 5 (after Foundational)**:
```bash
# Can run entirely in parallel - different packages
Task: "Update AI prompts" (backend)
Task: "Update MCP templates" (backend)
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 3 (mapping layer)
4. Complete Phase 4: User Story 1 (table)
5. Complete Phase 5: User Story 2 (post-list)
6. **STOP and VALIDATE**: Test table and post-list views in editor
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US3 (mapping) → Test mapping functions
3. Add US1 (table) → Test table rendering → Can demo tables!
4. Add US2 (post-list) → Test post-list rendering → Can demo both layouts!
5. Add US4 (AI prompts) → Test AI-generated data
6. Add US5 (MCP server) → Test published app rendering → Full feature complete!

### Suggested MVP Scope

**For fastest initial delivery**, complete only:
- Phase 1: Setup (T001-T006)
- Phase 2: Foundational (T007-T010)
- Phase 3: User Story 3 - Mapping (T011-T016)
- Phase 4: User Story 1 - Table (T017-T021)

This gives you working Manifest Table rendering in the editor preview.

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 48 |
| **Setup Tasks** | 6 |
| **Foundational Tasks** | 4 |
| **US3 (Mapping) Tasks** | 6 |
| **US1 (Table) Tasks** | 5 |
| **US2 (Post-List) Tasks** | 5 |
| **US4 (AI Prompts) Tasks** | 6 |
| **US5 (MCP Server) Tasks** | 8 |
| **Polish Tasks** | 8 |
| **Parallel Opportunities** | 12 tasks marked [P] |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US3 is implemented first despite same priority because US1 and US2 depend on it
