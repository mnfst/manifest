# Feature Specification: App Detail Page Improvements

**Feature Branch**: `012-app-detail-improvements`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Improve the app detail page with share modal, single-column flow cards, remove flow icons, add app icons with upload capability and default pixel art icons"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share App via Modal (Priority: P1)

A user who has published an app wants to share the app's landing page URL and MCP server endpoint with their users. Instead of seeing these links inline on the page, they click a "share" icon in the app detail header, which opens a modal containing both sharing options.

**Why this priority**: This consolidates sharing functionality into a cleaner UI pattern, reducing visual clutter on the main page while making the share action more intentional and discoverable.

**Independent Test**: Can be fully tested by publishing an app, clicking the share icon, and verifying both URLs are displayed in the modal with copy functionality.

**Acceptance Scenarios**:

1. **Given** an app is published, **When** the user views the app detail page, **Then** they see a share icon in the header area
2. **Given** an app is published and the user clicks the share icon, **When** the modal opens, **Then** they see both the landing page URL and MCP server endpoint with copy buttons
3. **Given** an app is in draft status, **When** the user views the app detail page, **Then** the share icon is either hidden or disabled with appropriate feedback
4. **Given** the share modal is open, **When** the user clicks a copy button, **Then** the corresponding URL is copied to clipboard with visual confirmation

---

### User Story 2 - View Flows in Single-Column Layout (Priority: P2)

A user browsing their app's flows sees each flow card displayed one per line (full width) instead of in a multi-column grid, making it easier to scan flow names and descriptions.

**Why this priority**: Improves readability and visual hierarchy of flows, making it easier to manage apps with many flows.

**Independent Test**: Can be fully tested by creating an app with multiple flows and verifying they display in a single-column layout.

**Acceptance Scenarios**:

1. **Given** an app has one or more flows, **When** the user views the app detail page, **Then** each flow card occupies the full width of the content area
2. **Given** an app has multiple flows, **When** the user scrolls through the flow list, **Then** flows are stacked vertically with consistent spacing

---

### User Story 3 - Simplified Flow Cards Without Icons (Priority: P2)

A user viewing flow cards sees a cleaner, simpler design without the flow-specific icons, reducing visual noise and emphasizing the flow name and description.

**Why this priority**: Paired with single-column layout, this creates a more streamlined interface focused on content rather than decorative elements.

**Independent Test**: Can be fully tested by viewing any flow card and verifying no icon/badge is displayed.

**Acceptance Scenarios**:

1. **Given** a flow exists in an app, **When** the user views the flow card, **Then** no icon or colored badge is displayed for the flow
2. **Given** multiple flows exist, **When** comparing flow cards, **Then** all cards have consistent appearance without individual icons

---

### User Story 4 - App Icons with Default Pixel Art (Priority: P3)

When a user creates a new app, the system automatically assigns a random icon from a set of 8 colorful pixel art defaults. The app icon is displayed prominently on the app detail page.

**Why this priority**: Provides visual identity for apps immediately upon creation, making them easier to distinguish in lists and navigation.

**Independent Test**: Can be fully tested by creating multiple new apps and verifying each receives a random default icon from the 8 available options.

**Acceptance Scenarios**:

1. **Given** a user creates a new app, **When** the app is created, **Then** one of 8 default pixel art icons is randomly assigned to the app
2. **Given** an app has an icon assigned, **When** the user views the app detail page, **Then** the app icon is displayed prominently (minimum 128x128 pixels display size)
3. **Given** the 8 default icons, **When** examining them, **Then** each has a distinct color theme and pixel art design

---

### User Story 5 - Upload Custom App Icon (Priority: P3)

A user in edit mode can upload a custom icon for their app by hovering over the app icon area and clicking to upload. The icon must be a square image at least 128x128 pixels.

**Why this priority**: Allows users to personalize their apps with custom branding, but builds on the default icon system established in P3.

**Independent Test**: Can be fully tested by entering edit mode, hovering over the app icon, uploading a valid image, and verifying it replaces the default.

**Acceptance Scenarios**:

1. **Given** the user is in edit mode on the app detail page, **When** they hover over the app icon, **Then** an upload prompt/overlay appears indicating they can click to change the icon
2. **Given** the upload prompt is visible, **When** the user clicks and selects an image file (128x128 or larger, square), **Then** the image is uploaded and displayed as the app icon
3. **Given** the user attempts to upload an image smaller than 128x128 pixels, **When** validation occurs, **Then** an error message is displayed and the upload is rejected
4. **Given** the user attempts to upload a non-square image, **When** validation occurs, **Then** an error message is displayed and the upload is rejected
5. **Given** the user is not in edit mode, **When** they hover over the app icon, **Then** no upload prompt appears

---

### Edge Cases

- What happens when copying a URL fails (clipboard API not available)?
  - Display an error message and show the URL in a selectable text field as fallback
- What happens when icon upload fails (network error, server error)?
  - Display an error message and retain the previous icon
- What happens when the uploaded image file is corrupted or invalid format?
  - Display a validation error before attempting upload
- What happens when an app with a custom icon is deleted and recreated?
  - New app receives a random default icon; custom icons are not preserved

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a share icon in the app detail header when the app is published
- **FR-002**: System MUST open a modal when the share icon is clicked, containing the landing page URL and MCP server endpoint
- **FR-003**: System MUST provide copy-to-clipboard functionality for both URLs in the share modal
- **FR-004**: System MUST hide or disable the share icon when the app is in draft status
- **FR-005**: System MUST display flow cards in a single-column layout (one flow per line)
- **FR-006**: System MUST NOT display icons on individual flow cards
- **FR-007**: System MUST store 8 default pixel art icons as static assets
- **FR-008**: System MUST randomly assign one of the 8 default icons when creating a new app
- **FR-009**: System MUST display the app icon on the app detail page at minimum 128x128 pixels
- **FR-010**: System MUST show an upload prompt when hovering over the app icon in edit mode
- **FR-011**: System MUST validate uploaded icons are square images of at least 128x128 pixels
- **FR-012**: System MUST reject uploads that do not meet the size/aspect requirements with clear error messages
- **FR-013**: System MUST persist the app icon (default or custom) in app data
- **FR-014**: System MUST support common image formats for icon uploads (PNG, JPG, GIF, WebP)

### Key Entities

- **App**: Extended with `iconUrl` attribute to store the path/URL to the app's icon (default or custom uploaded)
- **Default Icons**: 8 static pixel art images stored in frontend assets, each with distinct color theme (stored as paths/identifiers that can be referenced)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access sharing URLs within 2 clicks from the app detail page (click share icon, then copy)
- **SC-002**: 100% of newly created apps display a default icon without additional user action
- **SC-003**: Users can successfully upload a custom icon in under 30 seconds (from click to display)
- **SC-004**: Flow list displays correctly with single-column layout on all screen sizes above mobile breakpoint
- **SC-005**: Share modal displays correctly and copy functionality works on all supported browsers
- **SC-006**: Icon validation provides immediate feedback (under 1 second) for invalid uploads

## Assumptions

- Edit mode already exists or is clearly defined in the current UI (user can toggle between view and edit states)
- The backend already supports file uploads or a similar mechanism can be implemented
- The 8 default pixel art icons will be created as 128x128 PNG files with transparent backgrounds
- The current App entity's `logoUrl` field will be repurposed for the app icon, or a new `iconUrl` field will be added
