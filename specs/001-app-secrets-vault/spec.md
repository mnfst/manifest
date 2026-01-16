# Feature Specification: App Secrets Vault

**Feature Branch**: `001-app-secrets-vault`
**Created**: 2026-01-16
**Status**: Draft
**Input**: User description: "Add a secrets vault option for apps to manage secret vars and keys without users seeing them when building. Restructure settings navigation to separate user settings from app settings."

## Clarifications

### Session 2026-01-16

- Q: Who should be able to manage (view, add, edit, delete) secrets for an app? → A: All collaborators (same access as other app settings)
- Q: How should "User Settings" be presented when clicked from the avatar dropdown? → A: Full page at `/settings` route

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access User Settings via Dropdown Menu (Priority: P1)

A user wants to manage their personal account settings (profile, API keys) without confusing it with app-specific settings. They click on their avatar in the sidebar footer and select "User Settings" from the dropdown menu, which navigates to a full page at `/settings` showing Account and API Keys tabs.

**Why this priority**: This is foundational for the navigation restructure - users must be able to access their personal settings through a clear, dedicated path before app settings can be separated.

**Independent Test**: Can be fully tested by clicking the user avatar dropdown and verifying "User Settings" option opens a user settings view with Account and API Keys tabs.

**Acceptance Scenarios**:

1. **Given** a logged-in user viewing any page, **When** they click on their avatar in the sidebar, **Then** a dropdown menu appears with "User Settings" and "Sign Out" options
2. **Given** the user avatar dropdown is open, **When** the user clicks "User Settings", **Then** the user is navigated to `/settings` page showing Account and API Keys tabs
3. **Given** the user is in User Settings, **When** they click the API Keys tab, **Then** they can view and manage their API keys

---

### User Story 2 - Navigate to App Settings Page (Priority: P1)

A user managing an app wants to access app-specific settings. They click the Settings link in the sidebar while viewing an app, which navigates them to `/:appId/settings` - a new page dedicated to app configuration.

**Why this priority**: This establishes the new app-scoped settings navigation pattern that enables secrets management.

**Independent Test**: Can be fully tested by clicking Settings in the sidebar while viewing an app and verifying navigation to `/app/{appId}/settings`.

**Acceptance Scenarios**:

1. **Given** a user viewing an app (`/app/{appId}` or any sub-route), **When** they click Settings in the sidebar, **Then** they are navigated to `/app/{appId}/settings`
2. **Given** a user on the App Settings page, **When** they view the page header, **Then** they see the app name and "Settings" as the page title
3. **Given** the user is on App Settings, **When** they navigate to a different app, **Then** the Settings link updates to point to the new app's settings

---

### User Story 3 - View Secret Variables (Priority: P1)

A user wants to review the secret variables configured for their app. On the App Settings page, they click the Secrets tab and see a list of all secret key-value pairs. The keys are visible, but values are masked by default (shown as dots/asterisks).

**Why this priority**: Core functionality - users must be able to see what secrets exist before they can manage them.

**Independent Test**: Can be fully tested by navigating to App Settings > Secrets tab and verifying the secrets list displays with masked values.

**Acceptance Scenarios**:

1. **Given** a user on the App Settings page, **When** they click the Secrets tab, **Then** they see a list of secret variables with visible keys and masked values
2. **Given** the Secrets tab is active with existing secrets, **When** the user views the list, **Then** each row shows: key name, masked value (e.g., "********"), eye icon, copy icon, and three-dot menu
3. **Given** no secrets exist for the app, **When** the user views the Secrets tab, **Then** they see an empty state with guidance to add their first secret

---

### User Story 4 - Reveal Secret Value (Priority: P2)

A user needs to verify or copy a secret value. They click the eye icon next to a secret, and the masked value reveals the actual secret text temporarily.

**Why this priority**: Essential for secret verification, but secondary to viewing the list.

**Independent Test**: Can be fully tested by clicking the eye icon on a secret row and verifying the value changes from masked to revealed.

**Acceptance Scenarios**:

1. **Given** a secret with a masked value, **When** the user clicks the eye icon, **Then** the actual secret value is displayed
2. **Given** a revealed secret value, **When** the user clicks the eye icon again, **Then** the value is masked again
3. **Given** a revealed secret value, **When** the user clicks outside or navigates away, **Then** the value automatically masks again for security

---

### User Story 5 - Copy Secret to Clipboard (Priority: P2)

A user needs to use a secret value elsewhere. They click the copy icon next to a secret, and the value is copied to their clipboard with visual feedback.

**Why this priority**: Common utility action, but not core to the feature.

**Independent Test**: Can be fully tested by clicking the copy icon and verifying clipboard content and visual feedback.

**Acceptance Scenarios**:

1. **Given** a secret row, **When** the user clicks the copy icon, **Then** the secret value (not the masked text) is copied to clipboard
2. **Given** the copy action is triggered, **When** the copy completes, **Then** brief visual feedback appears (e.g., "Copied!" tooltip or icon change)

---

### User Story 6 - Add New Secret (Priority: P1)

A user needs to add a new secret variable to their app. At the top of the secrets list, they see an input row with fields for key name and value, plus an "Add" button. They enter the key and value and click Add to save the secret.

**Why this priority**: Core CRUD operation required for the feature to be useful.

**Independent Test**: Can be fully tested by filling in the add secret form and verifying the new secret appears in the list.

**Acceptance Scenarios**:

1. **Given** the Secrets tab is active, **When** the user views the top of the list, **Then** they see input fields for "VARIABLE_NAME" and "VALUE or ${REF}" with an Add button
2. **Given** valid key and value are entered, **When** the user clicks Add, **Then** the secret is saved and appears in the list below
3. **Given** a duplicate key name is entered, **When** the user clicks Add, **Then** an error message indicates the key already exists
4. **Given** empty key or value fields, **When** the user clicks Add, **Then** the button is disabled or shows validation error

---

### User Story 7 - Edit Existing Secret (Priority: P2)

A user needs to update a secret's value. They click the three-dot menu on a secret row, select "Edit", and can modify the key or value.

**Why this priority**: Important for maintenance, but less frequent than viewing or adding.

**Independent Test**: Can be fully tested by clicking Edit from the menu, modifying values, and verifying the update persists.

**Acceptance Scenarios**:

1. **Given** a secret row, **When** the user clicks the three-dot menu, **Then** a dropdown appears with "Edit" and "Delete" options
2. **Given** the Edit option is selected, **When** the edit mode activates, **Then** the row becomes editable with the current values pre-filled
3. **Given** the user has modified the secret, **When** they save the changes, **Then** the updated values are persisted and displayed

---

### User Story 8 - Delete Secret (Priority: P2)

A user needs to remove a secret that is no longer needed. They click the three-dot menu and select "Delete", then confirm the deletion.

**Why this priority**: Important for cleanup, but destructive actions are less frequent.

**Independent Test**: Can be fully tested by clicking Delete from the menu, confirming, and verifying the secret is removed.

**Acceptance Scenarios**:

1. **Given** a secret row, **When** the user clicks Delete from the three-dot menu, **Then** a confirmation prompt appears
2. **Given** the delete confirmation is shown, **When** the user confirms, **Then** the secret is permanently deleted and removed from the list
3. **Given** the delete confirmation is shown, **When** the user cancels, **Then** the secret remains unchanged

---

### Edge Cases

- What happens when secret value contains special characters (quotes, newlines, unicode)? System stores and displays them correctly.
- What happens when copying a long secret value? Full value is copied regardless of display truncation.
- How does system handle concurrent edits to the same secret? Last write wins with optimistic UI update.
- What happens if API key contains characters that look like template syntax `${...}`? Stored as literal text, not interpreted.
- What if user tries to create a secret with an extremely long key name? Validation enforces reasonable limits (e.g., 256 characters).

## Requirements *(mandatory)*

### Functional Requirements

**Navigation Restructure:**

- **FR-001**: System MUST remove the "General" tab from the current Settings page (it's empty/placeholder)
- **FR-002**: System MUST rename "Edit Account" to "User Settings" in the user avatar dropdown menu
- **FR-003**: "User Settings" MUST navigate to `/settings` page showing Account and API Keys tabs (current settings content minus General tab)
- **FR-004**: Settings link in sidebar MUST navigate to `/:appId/settings` when an app is selected
- **FR-005**: System MUST create a new App Settings page at route `/:appId/settings`

**Secrets Management:**

- **FR-006**: App Settings page MUST include a "Secrets" tab
- **FR-007**: Secrets tab MUST display a list of all secret variables for the current app
- **FR-008**: Each secret row MUST display: key name (visible), value (masked by default), eye icon, copy icon, three-dot menu
- **FR-009**: Clicking eye icon MUST toggle between masked and revealed value
- **FR-010**: Clicking copy icon MUST copy the actual secret value to clipboard
- **FR-011**: Three-dot menu MUST contain "Edit" and "Delete" actions
- **FR-012**: System MUST provide an input row at top for adding new secrets (key field, value field, Add button)
- **FR-013**: System MUST validate that secret keys are unique within an app
- **FR-014**: System MUST persist secrets securely in the database (encrypted at rest is recommended but implementation detail)
- **FR-015**: Edit action MUST allow modifying both key and value of existing secrets
- **FR-016**: Delete action MUST require confirmation before removing a secret
- **FR-020**: All app collaborators MUST have equal access to view and manage secrets (no role-based restrictions)

**UI/UX:**

- **FR-017**: Secrets UI MUST follow Railway-style design (reference screenshot: key-value rows, minimal chrome, clean aesthetic)
- **FR-018**: Empty state MUST guide users to add their first secret
- **FR-019**: System MUST provide visual feedback for copy action (toast/tooltip)

### Key Entities *(include if feature involves data)*

- **AppSecret**: A key-value pair associated with an app. Key attributes: app reference, key name (string), encrypted value, created/updated timestamps.
- **App**: Existing entity, now has a one-to-many relationship with AppSecret.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access their personal settings (Account, API Keys) through the avatar dropdown within 2 clicks
- **SC-002**: Users can navigate to app-specific settings from the sidebar with 1 click when viewing an app
- **SC-003**: Users can add a new secret variable and see it in the list within 10 seconds
- **SC-004**: Users can reveal a masked secret value with a single click
- **SC-005**: Users can copy a secret value to clipboard with a single click and receive immediate visual confirmation
- **SC-006**: 100% of secret values remain masked by default until user explicitly reveals them
- **SC-007**: Users can complete full CRUD operations (Create, Read, Update, Delete) on secrets without page reload
- **SC-008**: Settings navigation is unambiguous - users clearly understand difference between User Settings and App Settings
