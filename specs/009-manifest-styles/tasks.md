# Tasks: Manifest Styles Adaptation

**Input**: Design documents from `/specs/009-manifest-styles/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Not required (POC phase - manual visual testing)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/frontend/` at repository root
- Tailwind config and index.html at `packages/frontend/`
- Components in `packages/frontend/src/components/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Font loading and design token foundation

- [x] T001 Add Google Fonts preconnect and Inter/Fira Code font links in packages/frontend/index.html
- [x] T002 Add navigation color CSS variables (--nav-bg, --nav-hover, --nav-active, --nav-foreground) in packages/frontend/src/index.css
- [x] T003 [P] Update existing CSS variables for Manifest palette (--background, --foreground, --border, --radius) in packages/frontend/src/index.css

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tailwind configuration that all components depend on

**⚠️ CRITICAL**: No component styling can begin until this phase is complete

- [x] T004 Add nav color mappings (nav, nav-hover, nav-active, nav-foreground) to packages/frontend/tailwind.config.js
- [x] T005 [P] Add fontFamily configuration (sans: Inter, mono: Fira Code stack) to packages/frontend/tailwind.config.js

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Consistent Visual Identity (Priority: P1) 🎯 MVP

**Goal**: Establish Manifest brand identity with proper fonts, colors, and button styling across the application

**Independent Test**: Load the application and verify:
- Inter font renders for body text
- Main content background is off-white (#f8f9fa)
- Buttons have 0.375rem border-radius and subtle shadows

### Implementation for User Story 1

- [x] T006 [US1] Update body/html base styles to use Inter font and off-white background in packages/frontend/src/index.css
- [x] T007 [US1] Update Button component base styles with rounded-md and shadow-sm hover:shadow in packages/frontend/src/components/ui/button.tsx
- [x] T008 [US1] Add responsive font scaling using clamp() function in packages/frontend/src/index.css

**Checkpoint**: At this point, User Story 1 should be fully functional - fonts and button styling visible across all pages

---

## Phase 4: User Story 2 - Distinctive Navigation Areas (Priority: P1)

**Goal**: Style sidebar and header with vibrant violet background and white text for clear navigation identification

**Independent Test**: Load the application and verify:
- Sidebar has violet (#6b21a8) background with white text
- Header has violet background with white text
- Logo and navigation items are clearly visible

### Implementation for User Story 2

- [x] T009 [P] [US2] Update Sidebar component with bg-nav and text-nav-foreground classes in packages/frontend/src/components/layout/Sidebar.tsx
- [x] T010 [P] [US2] Update Header component with bg-nav and text-nav-foreground classes in packages/frontend/src/components/layout/Header.tsx
- [x] T011 [US2] Update logo styling for visibility on dark background in packages/frontend/src/components/layout/Sidebar.tsx
- [x] T012 [US2] Add border-white/10 for subtle separators within navigation in packages/frontend/src/components/layout/Sidebar.tsx

**Checkpoint**: At this point, User Story 2 should be fully functional - sidebar and header visually distinct with violet theme

---

## Phase 5: User Story 3 - Interactive Element Feedback (Priority: P2)

**Goal**: Add hover and active state styling for sidebar items following Manifest design patterns

**Independent Test**: Interact with sidebar navigation and verify:
- Hover shows lighter violet (#7c3aed) background
- Active/selected item shows even lighter violet (#8b5cf6) background
- All text remains readable during state changes

### Implementation for User Story 3

- [x] T013 [US3] Update SidebarItem to use hover:bg-nav-hover for hover states in packages/frontend/src/components/layout/SidebarItem.tsx
- [x] T014 [US3] Update SidebarItem to use bg-nav-active for active/selected states in packages/frontend/src/components/layout/SidebarItem.tsx
- [x] T015 [US3] Update SidebarItem text color to text-nav-foreground for all states in packages/frontend/src/components/layout/SidebarItem.tsx
- [x] T016 [US3] Add font-medium to active state for additional emphasis in packages/frontend/src/components/layout/SidebarItem.tsx

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and edge case handling

- [x] T017 [P] Verify WCAG AA contrast compliance for all text on violet backgrounds
- [x] T018 [P] Test text truncation/wrapping behavior in sidebar with long navigation labels
- [x] T019 Run quickstart.md visual testing checklist
- [x] T020 Review all pages for styling consistency

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel (different files)
  - US3 depends on US2 (modifies same SidebarItem component)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after User Story 2 - Modifies SidebarItem which is updated in US2

### Within Each User Story

- CSS variables → Tailwind config → Component updates
- Core styling before interaction states
- Commit after each task or logical group

### Parallel Opportunities

- T002 and T003 can run in parallel (different sections of index.css)
- T004 and T005 can run in parallel (different sections of tailwind.config.js)
- T009 and T010 can run in parallel (Sidebar.tsx and Header.tsx are different files)
- T017 and T018 can run in parallel (independent validation tasks)

---

## Parallel Example: User Story 2

```bash
# Launch sidebar and header styling in parallel:
Task: "Update Sidebar component with bg-nav and text-nav-foreground classes in packages/frontend/src/components/layout/Sidebar.tsx"
Task: "Update Header component with bg-nav and text-nav-foreground classes in packages/frontend/src/components/layout/Header.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup (fonts, CSS variables)
2. Complete Phase 2: Foundational (Tailwind config)
3. Complete Phase 3: User Story 1 (fonts, background, buttons)
4. Complete Phase 4: User Story 2 (sidebar and header styling)
5. **STOP and VALIDATE**: Visual inspection against Manifest design
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Fonts and buttons visible → Demo brand typography
3. Add User Story 2 → Navigation styled → Demo full visual identity (MVP!)
4. Add User Story 3 → Hover/active states → Demo complete interaction design
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are both Priority P1 - implement both for complete MVP
- US3 enhances US2 with interaction states
- Manual visual testing per POC constitution
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
