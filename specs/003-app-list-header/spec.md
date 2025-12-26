# Feature Specification: App List Home Page and Header Navigation

**Feature Branch**: `003-app-list-header`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "I want to change the way users get their content. As it is a POC, let's pretend that we are logged in but everyone sees everything. In the header, add a mention to the current app we are editing. Clicking on that name will show a dropdown menu with other apps. For now you just list everything without restriction. On the top right you show a dummy name and avatar as if we were connected as this person. The page accessible at '/' root level should be the app list. And in this list add a new button 'Create new app' that shows the form to create the app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App List Home Page (Priority: P1)

Users land on the home page and see a list of all existing apps in the system. This replaces the previous app creation form as the primary landing experience.

**Why this priority**: This is the foundational change - the home page becomes the central hub for accessing all apps, making app discovery the primary user action.

**Independent Test**: Navigate to root URL ("/"), verify app list is displayed with all existing apps, verify each app card is clickable and navigates to the app dashboard.

**Acceptance Scenarios**:

1. **Given** apps exist in the system, **When** user navigates to "/", **Then** user sees a grid/list of app cards showing app name, description, and last modified
2. **Given** no apps exist in the system, **When** user navigates to "/", **Then** user sees an empty state message encouraging them to create their first app
3. **Given** user is on the home page, **When** user clicks on an app card, **Then** user is navigated to `/app/:appId` dashboard

---

### User Story 2 - Create New App Button (Priority: P2)

From the app list page, users can click a "Create new app" button that reveals the app creation form, allowing them to add new apps to the system.

**Why this priority**: Essential for the POC to allow adding new apps after the home page change. Without this, users cannot create apps.

**Independent Test**: On home page, click "Create new app" button, verify form appears, fill form and submit, verify new app appears in list.

**Acceptance Scenarios**:

1. **Given** user is on the home page, **When** user clicks "Create new app" button, **Then** the app creation form is displayed (modal or inline)
2. **Given** app creation form is visible, **When** user fills in name and description and submits, **Then** new app is created and appears in the app list
3. **Given** app creation form is visible, **When** user clicks cancel or outside the form, **Then** form is hidden and user returns to app list view

---

### User Story 3 - App Switcher in Header (Priority: P3)

When editing an app (on any page within `/app/:appId/*`), the header displays the current app name. Clicking it opens a dropdown menu listing all other apps for quick navigation.

**Why this priority**: Improves navigation UX by allowing quick switching between apps without returning to home page. Not blocking for basic functionality.

**Independent Test**: Navigate to an app dashboard, verify app name appears in header, click on app name, verify dropdown shows other apps, click another app, verify navigation occurs.

**Acceptance Scenarios**:

1. **Given** user is viewing an app at `/app/:appId`, **When** page loads, **Then** header displays the current app name
2. **Given** user is on an app page, **When** user clicks on the app name in header, **Then** dropdown menu opens showing all other apps
3. **Given** dropdown is open, **When** user clicks on another app, **Then** user is navigated to that app's dashboard
4. **Given** dropdown is open, **When** user clicks outside the dropdown, **Then** dropdown closes
5. **Given** user navigates from one app page to another, **When** they go to `/app/:appId/flow/:flowId`, **Then** header still shows the correct current app name

---

### User Story 4 - Dummy User Avatar (Priority: P4)

The header displays a dummy user name and avatar on the top right, simulating a logged-in user experience for the POC.

**Why this priority**: Purely cosmetic for POC authenticity. Does not affect any functionality.

**Independent Test**: Navigate to any page, verify user avatar and name appear in top-right corner of header.

**Acceptance Scenarios**:

1. **Given** user is on any page, **When** page loads, **Then** a dummy avatar (circular image or initial) and name are visible in the top-right header
2. **Given** user is on any page, **When** user hovers over avatar, **Then** no action occurs (not interactive in POC)

---

### Edge Cases

- What happens when the current app being viewed is deleted by another session? Display error or redirect to home.
- How does the app switcher dropdown handle a large number of apps? Show scrollable list (max height).
- What happens if app name is very long in header? Truncate with ellipsis.
- How does the system handle clicking "Create new app" when form is already visible? No-op or toggle closed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a list of all apps on the root path ("/")
- **FR-002**: System MUST show app name, description, and visual identifier (slug or ID) for each app in the list
- **FR-003**: Users MUST be able to click on an app card to navigate to its dashboard
- **FR-004**: System MUST provide a "Create new app" button on the home page
- **FR-005**: Users MUST be able to create a new app via the form triggered by the "Create new app" button
- **FR-006**: System MUST display a header with the current app name when on any `/app/:appId/*` route
- **FR-007**: Users MUST be able to click the app name in header to open a dropdown listing all apps
- **FR-008**: Users MUST be able to select an app from the dropdown to navigate to its dashboard
- **FR-009**: System MUST display a dummy user avatar and name in the top-right of the header
- **FR-010**: System MUST show an empty state on home page when no apps exist

### Key Entities

- **App**: Existing entity - no changes required. Used for listing and navigation.
- **User (dummy)**: Not a real entity - hardcoded display only for POC. Name and avatar are static.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all apps from the home page immediately upon loading
- **SC-002**: Users can create a new app in under 3 clicks from the home page
- **SC-003**: Users can switch between apps in under 2 clicks from any app page
- **SC-004**: All navigation paths (home → app → flow → view) remain functional
- **SC-005**: No regression in existing app creation and editing functionality
