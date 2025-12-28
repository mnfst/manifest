# Tasks: Chat-Style Component Renderer

**Input**: Design documents from `/specs/008-chat-style-renderer/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md, research.md, quickstart.md

**Tests**: Not required (POC phase - testing deferred per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app monorepo**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Backend entity changes and shared types that all user stories depend on

- [ ] T001 [P] Add logoUrl column to AppEntity in packages/backend/src/entities/app.entity.ts
- [ ] T002 [P] Add logoUrl field to App interface in packages/shared/src/types/app.ts
- [ ] T003 [P] Add logoUrl to UpdateAppRequest interface in packages/shared/src/types/app.ts
- [ ] T004 [P] Create platform.ts with PlatformStyle, ThemeMode, and PreviewPreferences types in packages/shared/src/types/platform.ts
- [ ] T005 Export platform types from shared index in packages/shared/src/index.ts
- [ ] T006 Verify type-check passes for all packages with `npm run type-check`

---

## Phase 2: Foundational (Core Components)

**Purpose**: Reusable preview components that multiple user stories depend on

**⚠️ CRITICAL**: User Story phases depend on these components being complete

- [ ] T007 [P] Create preview directory structure at packages/frontend/src/components/preview/
- [ ] T008 [P] Create chatgpt.ts platform style configuration in packages/frontend/src/components/preview/styles/chatgpt.ts
- [ ] T009 [P] Create claude.ts platform style configuration in packages/frontend/src/components/preview/styles/claude.ts
- [ ] T010 Create AppAvatar component with logo/fallback rendering in packages/frontend/src/components/preview/AppAvatar.tsx
- [ ] T011 Create usePreviewPreferences hook with localStorage persistence in packages/frontend/src/hooks/usePreviewPreferences.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Switch Between Chat Platform Styles (Priority: P1) 🎯 MVP

**Goal**: Users can switch between ChatGPT and Claude visual styles to preview how their component will appear in different chat platforms

**Independent Test**: Select "ChatGPT" from platform selector → preview shows ChatGPT styling with app logo/name. Select "Claude" → preview switches to Claude styling. Refresh page → selected style persists.

### Implementation for User Story 1

- [ ] T012 [US1] Create PlatformStyleSelector component with ChatGPT/Claude toggle buttons in packages/frontend/src/components/preview/PlatformStyleSelector.tsx
- [ ] T013 [US1] Create ChatStyleWrapper component that applies platform-specific styling in packages/frontend/src/components/preview/ChatStyleWrapper.tsx
- [ ] T014 [US1] Add platform style selector to ViewEditor toolbar in packages/frontend/src/pages/ViewEditor.tsx
- [ ] T015 [US1] Integrate ChatStyleWrapper around LayoutRenderer in ViewEditor in packages/frontend/src/pages/ViewEditor.tsx
- [ ] T016 [US1] Connect usePreviewPreferences hook for platform style persistence in packages/frontend/src/pages/ViewEditor.tsx
- [ ] T017 [US1] Manually verify: ChatGPT/Claude switching works, style persists after refresh

**Checkpoint**: User Story 1 complete - platform style switching is fully functional

---

## Phase 4: User Story 2 - Toggle Light/Dark Mode (Priority: P1)

**Goal**: Users can toggle between light and dark mode independently of the platform style selection

**Independent Test**: With ChatGPT style selected, toggle dark mode → entire preview shows dark colors. Switch to Claude → dark mode preference maintained. Toggle to light → both platform styles show light mode.

### Implementation for User Story 2

- [ ] T018 [US2] Update platform style configurations to include light/dark variants in packages/frontend/src/components/preview/styles/chatgpt.ts
- [ ] T019 [US2] Update platform style configurations to include light/dark variants in packages/frontend/src/components/preview/styles/claude.ts
- [ ] T020 [US2] Update ChatStyleWrapper to apply themeMode styling in packages/frontend/src/components/preview/ChatStyleWrapper.tsx
- [ ] T021 [US2] Connect theme mode to usePreviewPreferences persistence in packages/frontend/src/pages/ViewEditor.tsx
- [ ] T022 [US2] Ensure existing dark mode toggle updates preference hook state in packages/frontend/src/pages/ViewEditor.tsx
- [ ] T023 [US2] Manually verify: Light/dark toggle works independently, persists with platform style changes

**Checkpoint**: User Story 2 complete - theme mode works independently of platform style

---

## Phase 5: User Story 3 - Clean Component Presentation (Priority: P2)

**Goal**: Remove redundant view name, tool name headers and extra borders so the preview looks like a real chat message

**Independent Test**: Load any view in the editor → no view name or tool name appears directly above the component. No extra border wraps the component. Template name visible in toolbar.

### Implementation for User Story 3

- [ ] T024 [US3] Remove view info header section (view name, tool name display) from ViewEditor in packages/frontend/src/pages/ViewEditor.tsx
- [ ] T025 [US3] Remove extra border class from preview container in packages/frontend/src/pages/ViewEditor.tsx
- [ ] T026 [US3] Add template name badge to toolbar area in packages/frontend/src/pages/ViewEditor.tsx
- [ ] T027 [US3] Manually verify: No view/tool name above component, no extra border, template name in toolbar

**Checkpoint**: User Story 3 complete - clean, immersive preview without legacy UI elements

---

## Phase 6: User Story 4 - App Identity Display (Priority: P2)

**Goal**: Display app logo and name above the rendered component similar to how ChatGPT shows custom app branding

**Independent Test**: App with logo and name → both appear in chat-style header. App without logo → shows initial-based fallback avatar. Logo fails to load → graceful fallback to initial avatar.

### Implementation for User Story 4

- [ ] T028 [US4] Add app identity header to ChatStyleWrapper showing logo and name in packages/frontend/src/components/preview/ChatStyleWrapper.tsx
- [ ] T029 [US4] Integrate AppAvatar component into ChatStyleWrapper header in packages/frontend/src/components/preview/ChatStyleWrapper.tsx
- [ ] T030 [US4] Implement hash-based color generation for fallback avatars in packages/frontend/src/components/preview/AppAvatar.tsx
- [ ] T031 [US4] Add onError handler to AppAvatar for logo load failures in packages/frontend/src/components/preview/AppAvatar.tsx
- [ ] T032 [US4] Pass app prop (name, logoUrl) to ChatStyleWrapper in ViewEditor in packages/frontend/src/pages/ViewEditor.tsx
- [ ] T033 [US4] Manually verify: App identity displays correctly, fallback works for missing/failed logos

**Checkpoint**: User Story 4 complete - app branding displays in chat-style header

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation across all user stories

- [ ] T034 Run full type-check with `npm run type-check`
- [ ] T035 Run lint with `npm run lint` and fix any issues
- [ ] T036 Validate all acceptance scenarios from spec.md manually
- [ ] T037 Test edge cases: no app name, logo load failure, invalid localStorage values
- [ ] T038 Verify performance: style switch <1s, theme toggle <500ms

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (types must exist before components)
- **Phase 3-6 (User Stories)**: All depend on Phase 2 completion
- **Phase 7 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (needs ChatStyleWrapper to add theme support)
- **User Story 3 (P2)**: Depends on US1 (ViewEditor already refactored for ChatStyleWrapper)
- **User Story 4 (P2)**: Depends on US1 (needs ChatStyleWrapper for app identity header)

### Within Each Phase

- Tasks marked [P] can run in parallel within their phase
- Non-[P] tasks should run sequentially within their phase

### Parallel Opportunities

**Phase 1 Parallel Group:**
```
T001 [P] Add logoUrl to AppEntity
T002 [P] Add logoUrl to App interface
T003 [P] Add logoUrl to UpdateAppRequest
T004 [P] Create platform.ts types
```

**Phase 2 Parallel Group:**
```
T007 [P] Create preview directory
T008 [P] Create chatgpt.ts styles
T009 [P] Create claude.ts styles
```

---

## Parallel Example: Phase 1 Setup

```bash
# All these tasks can run in parallel (different files):
Task T001: "Add logoUrl column to AppEntity in packages/backend/src/entities/app.entity.ts"
Task T002: "Add logoUrl field to App interface in packages/shared/src/types/app.ts"
Task T003: "Add logoUrl to UpdateAppRequest interface in packages/shared/src/types/app.ts"
Task T004: "Create platform.ts with PlatformStyle, ThemeMode, and PreviewPreferences types"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (backend + shared types)
2. Complete Phase 2: Foundational (core components)
3. Complete Phase 3: User Story 1 (platform style switching)
4. **STOP and VALIDATE**: Test platform switching independently
5. Demo if ready - core feature is functional

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test → **MVP deployed!** (platform styles work)
3. Add User Story 2 → Test → Light/dark mode complete
4. Add User Story 3 → Test → Clean presentation complete
5. Add User Story 4 → Test → Full feature complete

### Recommended Order

Given the dependencies:
1. **Phase 1-2**: Setup and Foundational (required for all)
2. **US1 first**: Core platform switching (MVP)
3. **US2 second**: Enhances US1 with theme mode
4. **US3 + US4**: Can run in parallel after US1/US2 (both modify ViewEditor but different sections)

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [USn] label maps task to specific user story for traceability
- POC mode: No automated tests required
- TypeORM auto-sync handles database schema changes
- Commit after each task or logical group
- localStorage keys prefixed with `generator:` to avoid conflicts
