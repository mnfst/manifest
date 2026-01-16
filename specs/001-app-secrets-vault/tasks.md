# Tasks: App Secrets Vault

**Input**: Design documents from `/specs/001-app-secrets-vault/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: DEFERRED (POC constitution - no automated tests required)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `packages/backend/src/`
- **Frontend**: `packages/frontend/src/`
- **Shared**: `packages/shared/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared types and export them

- [x] T001 [P] Create AppSecret shared types in packages/shared/src/types/secret.ts
- [x] T002 Export secret types from packages/shared/src/types/index.ts

---

## Phase 2: Foundational (Backend Secrets Module)

**Purpose**: Core backend infrastructure for secrets CRUD that ALL user stories depend on

**⚠️ CRITICAL**: User stories 3-8 depend on this backend being complete

- [x] T003 Create AppSecret entity in packages/backend/src/secret/secret.entity.ts
- [x] T004 Create SecretService with CRUD methods in packages/backend/src/secret/secret.service.ts
- [x] T005 Create SecretController with API endpoints in packages/backend/src/secret/secret.controller.ts
- [x] T006 Create SecretModule and wire dependencies in packages/backend/src/secret/secret.module.ts
- [x] T007 Import SecretModule in packages/backend/src/app.module.ts
- [x] T008 Add secret API methods to frontend client in packages/frontend/src/lib/api.ts

**Checkpoint**: Backend secrets API ready - frontend stories can now proceed

---

## Phase 3: User Story 1 - Access User Settings via Dropdown (Priority: P1) 🎯 MVP

**Goal**: Rename "Edit Account" to "User Settings" and remove General tab from Settings page

**Independent Test**: Click avatar dropdown → see "User Settings" → click it → see Account and API Keys tabs (no General)

### Implementation for User Story 1

- [x] T009 [US1] Rename "Edit Account" to "User Settings" in packages/frontend/src/components/layout/UserAvatar.tsx
- [x] T010 [US1] Remove General tab from tabs array in packages/frontend/src/pages/SettingsPage.tsx
- [x] T011 [US1] Remove GeneralTab import and rendering in packages/frontend/src/pages/SettingsPage.tsx

**Checkpoint**: User Settings accessible via dropdown with Account + API Keys tabs only

---

## Phase 4: User Story 2 - Navigate to App Settings Page (Priority: P1)

**Goal**: Sidebar Settings link navigates to `/app/:appId/settings` when app selected

**Independent Test**: View app → click Settings in sidebar → navigate to `/app/{appId}/settings` with app name header

### Implementation for User Story 2

- [x] T012 [P] [US2] Create AppSettingsPage component in packages/frontend/src/pages/AppSettingsPage.tsx
- [x] T013 [US2] Add `/app/:appId/settings` route in packages/frontend/src/App.tsx
- [x] T014 [US2] Update Sidebar Settings link to use `/app/:appId/settings` when app selected in packages/frontend/src/components/layout/Sidebar.tsx

**Checkpoint**: App Settings page accessible at `/app/:appId/settings` with app name displayed

---

## Phase 5: User Story 3 - View Secret Variables (Priority: P1)

**Goal**: Display secrets list with masked values in App Settings Secrets tab

**Independent Test**: Navigate to App Settings → click Secrets tab → see list of secrets with masked values

### Implementation for User Story 3

- [x] T015 [P] [US3] Create SecretRow component (key, masked value, icons, menu) in packages/frontend/src/components/settings/SecretRow.tsx
- [x] T016 [US3] Create SecretsTab component with list and empty state in packages/frontend/src/components/settings/SecretsTab.tsx
- [x] T017 [US3] Add Secrets tab to AppSettingsPage in packages/frontend/src/pages/AppSettingsPage.tsx
- [x] T018 [US3] Update tab types for app settings in packages/frontend/src/types/tabs.ts

**Checkpoint**: Secrets tab shows list with masked values (or empty state)

---

## Phase 6: User Story 6 - Add New Secret (Priority: P1)

**Goal**: Add new secret via input form at top of secrets list

**Independent Test**: Enter key and value in form → click Add → secret appears in list

### Implementation for User Story 6

- [x] T019 [US6] Add secret creation form (key input, value input, Add button) to SecretsTab in packages/frontend/src/components/settings/SecretsTab.tsx
- [x] T020 [US6] Implement form validation (empty fields, duplicate key) in SecretsTab in packages/frontend/src/components/settings/SecretsTab.tsx
- [x] T021 [US6] Add error handling for duplicate key in SecretService in packages/backend/src/secret/secret.service.ts

**Checkpoint**: Can add new secrets with validation and error feedback

---

## Phase 7: User Story 4 - Reveal Secret Value (Priority: P2)

**Goal**: Toggle secret value visibility via eye icon

**Independent Test**: Click eye icon → value revealed → click again → value masked

### Implementation for User Story 4

- [x] T022 [US4] Add reveal/mask toggle state to SecretRow in packages/frontend/src/components/settings/SecretRow.tsx
- [x] T023 [US4] Implement eye icon click handler to toggle visibility in packages/frontend/src/components/settings/SecretRow.tsx

**Checkpoint**: Eye icon toggles between masked and revealed values

---

## Phase 8: User Story 5 - Copy Secret to Clipboard (Priority: P2)

**Goal**: Copy secret value with visual feedback

**Independent Test**: Click copy icon → value copied to clipboard → see "Copied!" feedback

### Implementation for User Story 5

- [x] T024 [US5] Implement copy to clipboard on copy icon click in packages/frontend/src/components/settings/SecretRow.tsx
- [x] T025 [US5] Add visual feedback (tooltip/icon change) after copy in packages/frontend/src/components/settings/SecretRow.tsx

**Checkpoint**: Copy icon copies value and shows feedback

---

## Phase 9: User Story 7 - Edit Existing Secret (Priority: P2)

**Goal**: Edit secret key and value via three-dot menu

**Independent Test**: Click menu → Edit → modify values → save → changes persisted

### Implementation for User Story 7

- [x] T026 [US7] Add three-dot menu with Edit option to SecretRow in packages/frontend/src/components/settings/SecretRow.tsx
- [x] T027 [US7] Implement edit mode state (isEditing, editKey, editValue) in SecretRow in packages/frontend/src/components/settings/SecretRow.tsx
- [x] T028 [US7] Implement save/cancel handlers for edit mode in packages/frontend/src/components/settings/SecretRow.tsx

**Checkpoint**: Can edit secrets via menu with inline editing

---

## Phase 10: User Story 8 - Delete Secret (Priority: P2)

**Goal**: Delete secret via three-dot menu with confirmation

**Independent Test**: Click menu → Delete → confirm → secret removed from list

### Implementation for User Story 8

- [x] T029 [US8] Add Delete option to three-dot menu in SecretRow in packages/frontend/src/components/settings/SecretRow.tsx
- [x] T030 [US8] Implement delete confirmation dialog in packages/frontend/src/components/settings/SecretRow.tsx
- [x] T031 [US8] Implement delete handler with API call in packages/frontend/src/components/settings/SecretRow.tsx

**Checkpoint**: Can delete secrets with confirmation prompt

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation

- [x] T032 Verify Railway-style design matches reference screenshot
- [x] T033 Run serve-app.sh and manually test all acceptance scenarios from spec.md
- [x] T034 Verify navigation is unambiguous (User Settings vs App Settings)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all secrets-related stories (US3-US8)
- **User Story 1 (Phase 3)**: No dependencies on Foundational - frontend-only changes
- **User Story 2 (Phase 4)**: No dependencies on Foundational - frontend-only changes
- **User Stories 3-8**: All depend on Foundational (Phase 2) completion
- **Polish (Phase 11)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Setup (Phase 1) - Independent, frontend-only
- **US2 (P1)**: Can start after Setup (Phase 1) - Independent, frontend-only
- **US3 (P1)**: Depends on Foundational (Phase 2) - Core secrets viewing
- **US6 (P1)**: Depends on US3 (needs SecretsTab) - Add functionality
- **US4 (P2)**: Depends on US3 (needs SecretRow) - Reveal toggle
- **US5 (P2)**: Depends on US3 (needs SecretRow) - Copy functionality
- **US7 (P2)**: Depends on US3 (needs SecretRow) - Edit mode
- **US8 (P2)**: Depends on US3 (needs SecretRow) - Delete functionality

### Parallel Opportunities

- T001 can run in parallel with T003-T007 (different packages)
- T009, T010, T011 (US1) can run in parallel with T012, T013, T014 (US2) - different files
- T015 (SecretRow skeleton) can run in parallel with T016 setup
- US4, US5, US7, US8 can run in parallel after US3 base is complete (all modify SecretRow but different features)

---

## Parallel Example: Initial Setup

```bash
# Launch shared types and backend entity in parallel:
Task: "Create AppSecret shared types in packages/shared/src/types/secret.ts"
Task: "Create AppSecret entity in packages/backend/src/secret/secret.entity.ts"

# Launch US1 and US2 in parallel (both frontend-only):
Task: "Rename Edit Account to User Settings in packages/frontend/src/components/layout/UserAvatar.tsx"
Task: "Create AppSettingsPage component in packages/frontend/src/pages/AppSettingsPage.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3, 6)

1. Complete Phase 1: Setup (shared types)
2. Complete Phase 2: Foundational (backend module)
3. Complete Phase 3: US1 (User Settings dropdown)
4. Complete Phase 4: US2 (App Settings page)
5. Complete Phase 5: US3 (View secrets)
6. Complete Phase 6: US6 (Add secrets)
7. **STOP and VALIDATE**: Full CRUD for viewing and adding secrets
8. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Backend ready
2. Add US1 + US2 → Navigation complete
3. Add US3 + US6 → Core secrets functionality (MVP!)
4. Add US4 + US5 → Better UX (reveal, copy)
5. Add US7 + US8 → Full CRUD (edit, delete)
6. Polish → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 have no backend dependencies - can start immediately
- US3-US8 all require backend (Phase 2) to be complete
- US4, US5, US7, US8 all build on the SecretRow component from US3
- POC: No automated tests required (deferred per constitution)
- Run `.specify/scripts/bash/serve-app.sh` after implementation for manual testing
