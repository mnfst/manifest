# Tasks: App Detail Page Improvements

**Input**: Design documents from `/specs/012-app-detail-improvements/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not required (POC mode - manual testing per constitution)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and asset creation

- [x] T001 Create icons directory in packages/frontend/public/icons/
- [x] T002 [P] Create pixel art icon icon-red.png (128x128, #EF4444) in packages/frontend/public/icons/
- [x] T003 [P] Create pixel art icon icon-orange.png (128x128, #F97316) in packages/frontend/public/icons/
- [x] T004 [P] Create pixel art icon icon-yellow.png (128x128, #EAB308) in packages/frontend/public/icons/
- [x] T005 [P] Create pixel art icon icon-green.png (128x128, #22C55E) in packages/frontend/public/icons/
- [x] T006 [P] Create pixel art icon icon-blue.png (128x128, #3B82F6) in packages/frontend/public/icons/
- [x] T007 [P] Create pixel art icon icon-purple.png (128x128, #A855F7) in packages/frontend/public/icons/
- [x] T008 [P] Create pixel art icon icon-pink.png (128x128, #EC4899) in packages/frontend/public/icons/
- [x] T009 [P] Create pixel art icon icon-gray.png (128x128, #6B7280) in packages/frontend/public/icons/
- [x] T010 Create uploads/icons/ directory in packages/backend/ for custom uploads

**Checkpoint**: Default icons ready, upload directory prepared

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend setup for static file serving and shared type updates

**⚠️ CRITICAL**: These tasks must complete before user story implementation

- [x] T011 Add IconUploadResponse type to packages/shared/src/types/app.ts
- [x] T012 Add DEFAULT_ICONS constant array to packages/backend/src/app/app.service.ts
- [x] T013 Configure static file serving for uploads directory in packages/backend/src/main.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Share App via Modal (Priority: P1) 🎯 MVP

**Goal**: Consolidate sharing URLs into a modal triggered by a share icon in the header

**Independent Test**: Publish an app, click share icon in header, verify modal shows both URLs with copy buttons

### Implementation for User Story 1

- [x] T014 [US1] Create ShareModal component in packages/frontend/src/components/app/ShareModal.tsx
- [x] T015 [US1] Add share modal state and handlers to packages/frontend/src/pages/AppDetail.tsx
- [x] T016 [US1] Add share icon button to app detail header in packages/frontend/src/pages/AppDetail.tsx
- [x] T017 [US1] Implement copy-to-clipboard with visual feedback in ShareModal component
- [x] T018 [US1] Remove inline share URLs section from packages/frontend/src/pages/AppDetail.tsx
- [x] T019 [US1] Handle share icon visibility based on app status (hidden/disabled for draft)

**Checkpoint**: Share modal fully functional - can be tested independently

---

## Phase 4: User Story 2 - Single-Column Flow Layout (Priority: P2)

**Goal**: Display flow cards one per line instead of grid layout

**Independent Test**: Create app with multiple flows, verify single-column stacked layout

### Implementation for User Story 2

- [x] T020 [US2] Modify grid layout from 2-column to single-column in packages/frontend/src/components/flow/FlowList.tsx

**Checkpoint**: Flow list displays in single column - can be tested independently

---

## Phase 5: User Story 3 - Simplified Flow Cards (Priority: P2)

**Goal**: Remove flow card icons for cleaner design

**Independent Test**: View any flow card and verify no icon/badge is displayed

### Implementation for User Story 3

- [x] T021 [US3] Remove icon section (gradient badge) from packages/frontend/src/components/flow/FlowCard.tsx
- [x] T022 [US3] Adjust FlowCard layout spacing after icon removal in packages/frontend/src/components/flow/FlowCard.tsx

**Checkpoint**: Flow cards display without icons - can be tested independently

---

## Phase 6: User Story 4 - Default App Icons (Priority: P3)

**Goal**: Randomly assign one of 8 default icons when creating a new app

**Independent Test**: Create multiple new apps, verify each receives a random default icon displayed at 128x128

### Implementation for User Story 4

- [x] T023 [US4] Add getRandomDefaultIcon helper function to packages/backend/src/app/app.service.ts
- [x] T024 [US4] Modify AppService.create() to assign random icon to logoUrl in packages/backend/src/app/app.service.ts
- [x] T025 [US4] Add app icon display section to header in packages/frontend/src/pages/AppDetail.tsx
- [x] T026 [US4] Style app icon display (128x128 minimum, rounded corners) in AppDetail.tsx

**Checkpoint**: New apps get random default icons - can be tested independently

---

## Phase 7: User Story 5 - Custom Icon Upload (Priority: P3)

**Goal**: Allow users to upload custom app icons with hover-to-reveal upload prompt

**Independent Test**: Hover over app icon, click to upload valid image (128x128 square), verify it replaces default

### Implementation for User Story 5

- [x] T027 [US5] Create AppIconUpload component with hover overlay in packages/frontend/src/components/app/AppIconUpload.tsx
- [x] T028 [US5] Implement client-side image dimension validation (128x128 min, square) in AppIconUpload.tsx
- [x] T029 [US5] Add uploadIcon method to API client in packages/frontend/src/lib/api.ts
- [x] T030 [US5] Add POST /api/apps/:id/icon endpoint with FileInterceptor in packages/backend/src/app/app.controller.ts
- [x] T031 [US5] Implement uploadIcon service method in packages/backend/src/app/app.service.ts
- [x] T032 [US5] Add multer disk storage configuration for icon uploads in packages/backend/src/app/app.controller.ts
- [x] T033 [US5] Add file type and size validation in upload endpoint in packages/backend/src/app/app.controller.ts
- [x] T034 [US5] Integrate AppIconUpload component into AppDetail page in packages/frontend/src/pages/AppDetail.tsx
- [x] T035 [US5] Handle upload errors with user-friendly messages in AppIconUpload component
- [x] T036 [US5] Update app icon display after successful upload in AppDetail.tsx

**Checkpoint**: Custom icon upload fully functional - can be tested independently

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and edge case handling

- [x] T037 Add error fallback for clipboard API failure in ShareModal (show selectable text field)
- [x] T038 Add loading state for icon upload in AppIconUpload component
- [x] T039 Run quickstart.md validation checklist manually
- [x] T040 Code cleanup: Remove any unused imports across modified files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T010)
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion (T011-T013)
  - User stories can proceed in parallel or sequentially in priority order
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational - No dependencies on other stories
- **User Story 4 (P3)**: Can start after Foundational - No dependencies on other stories
- **User Story 5 (P3)**: Depends on User Story 4 completion (needs icon display to exist before adding upload)

### Within Each User Story

- Models/types before services
- Services before endpoints
- Backend before frontend integration
- Core implementation before error handling

### Parallel Opportunities

- T002-T009: All 8 default icons can be created in parallel
- T011, T012, T013: Foundational tasks can run in parallel
- US1, US2, US3, US4: Can be worked on in parallel after Foundational
- T027, T030: Frontend and backend icon upload can be developed in parallel

---

## Parallel Example: Setup Phase Icons

```bash
# Launch all icon creation tasks together:
Task: "Create pixel art icon icon-red.png (128x128, #EF4444) in packages/frontend/public/icons/"
Task: "Create pixel art icon icon-orange.png (128x128, #F97316) in packages/frontend/public/icons/"
Task: "Create pixel art icon icon-yellow.png (128x128, #EAB308) in packages/frontend/public/icons/"
Task: "Create pixel art icon icon-green.png (128x128, #22C55E) in packages/frontend/public/icons/"
Task: "Create pixel art icon icon-blue.png (128x128, #3B82F6) in packages/frontend/public/icons/"
Task: "Create pixel art icon icon-purple.png (128x128, #A855F7) in packages/frontend/public/icons/"
Task: "Create pixel art icon icon-pink.png (128x128, #EC4899) in packages/frontend/public/icons/"
Task: "Create pixel art icon icon-gray.png (128x128, #6B7280) in packages/frontend/public/icons/"
```

## Parallel Example: User Stories 1-4

```bash
# After Foundational phase, these stories can start together:
Task: "[US1] Create ShareModal component in packages/frontend/src/components/app/ShareModal.tsx"
Task: "[US2] Modify grid layout in packages/frontend/src/components/flow/FlowList.tsx"
Task: "[US3] Remove icon section from packages/frontend/src/components/flow/FlowCard.tsx"
Task: "[US4] Add getRandomDefaultIcon helper in packages/backend/src/app/app.service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (create icons, directories)
2. Complete Phase 2: Foundational (types, constants, static serving)
3. Complete Phase 3: User Story 1 (Share Modal)
4. **STOP and VALIDATE**: Test share modal independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Share Modal) → Test → MVP!
3. Add User Stories 2+3 (Flow cards) → Test → Cleaner UI
4. Add User Story 4 (Default icons) → Test → App visual identity
5. Add User Story 5 (Icon upload) → Test → Full customization
6. Polish phase → Production ready

### Recommended Order (Sequential)

For single developer: P1 → P2 → P2 → P3 → P3 (Stories 1, 2, 3, 4, 5)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- POC mode: Manual testing acceptable per constitution
